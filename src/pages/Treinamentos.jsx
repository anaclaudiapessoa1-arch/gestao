// Treinamentos: trilhas prontas, sugeridas pelos números; registro de quem
// participou e nota do teste; e o efeito no indicador (antes × depois).
import { useState } from "react";
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Abas } from "../components/ui.jsx";
import { Estudio } from "../components/Estudio.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { Slides } from "../components/Slides.jsx";
import { Apresentador } from "../components/Deck.jsx";
import { slidesDoModelo, modeloPorId } from "../lib/modelosApresentacao.js";
import { npsCRM, licitacoesCRM } from "../services/crm.js";
import { TRILHAS, trilhaPorId } from "../lib/trilhas.js";
import { pessoasParaTreinamento } from "../lib/treinamentosPessoa.js";
import { matrizReciclagem, OPCOES_PERIODO, ID_CONFIG, periodosEmVigor } from "../lib/reciclagem.js";
import { hojeBR, dataCurta, mesAtual, somarMeses, mesDeData, mesNome, pct, nomeProprio } from "../lib/format.js";

const norm = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
import { totaisMes, realizado, metasDe } from "../lib/calculos.js";

/** Por que cada trilha está sugerida agora (ou null). */
function motivos({ resumo, equipe, dados, nps, lics }) {
  const m = mesAtual();
  const ant = somarMeses(m, -1);
  const out = {};
  const t = totaisMes(resumo, ant);
  const tAtual = totaisMes(resumo, m);
  const pctSem = Math.max(t.pctSemResponsavel || 0, tAtual.pctSemResponsavel || 0);
  if (pctSem > 5) out["crm-sem-furos"] = `${pct(pctSem)} das propostas sem responsável (meta: abaixo de 5%).`;
  const abaixo = equipe.filter((p) => { const me = metasDe(p); const r = realizado(resumo, p, ant); return me.aprovacao && r.taxa != null && r.taxa < me.aprovacao; });
  if (abaixo.length) out["follow-up"] = `Aprovação abaixo da meta em ${mesNome(ant)}: ${abaixo.map((p) => p.nome.split(" ")[0]).join(", ")}.`;
  const desde = somarMeses(m, -2);
  for (const tr of TRILHAS.filter((x) => x.gatilho.startsWith("ocorrencia:"))) {
    const tipo = tr.gatilho.split(":")[1];
    const n = dados.ocorrencias.filter((o) => o.tipo === tipo && o.mes >= desde).length;
    if (n) out[tr.id] = `${n} ocorrência(s) de “${tipo}” nos últimos 3 meses.`;
  }
  const det = [...(nps || []), ...dados.nps].filter((r) => Number(r.nota) <= 6).length;
  if (det) out.atendimento = `${det} cliente(s) com nota de 0 a 6.`;
  const perdidas = (lics || []).filter((l) => String(l.status).toUpperCase() === "PERDIDA").length;
  if (perdidas) out.licitacoes = `${perdidas} licitação(ões) perdida(s).`;
  const semFb = equipe.filter((p) => !dados.feedbacks.some((f) => f.pessoaId === p.id && f.mes >= ant));
  const rec = matrizReciclagem({ trilhas: TRILHAS, registros: dados.treinamentos, pessoas: equipe, hoje: hojeBR() });
  for (const t of rec.periodicas) {
    const venc = rec.pendencias.filter((x) => x.trilha.id === t.id && x.status !== "nunca");
    const nunca = rec.pendencias.filter((x) => x.trilha.id === t.id && x.status === "nunca");
    const partes = [venc.length && `reciclagem vencida ou vencendo: ${venc.map((x) => x.pessoa.nome.split(" ")[0]).join(", ")}`, nunca.length && `nunca fizeram: ${nunca.map((x) => x.pessoa.nome.split(" ")[0]).join(", ")}`].filter(Boolean);
    if (partes.length) { const txt = partes.join("; ") + "."; out[t.id] = out[t.id] ? `${out[t.id]} ${txt.charAt(0).toUpperCase()}${txt.slice(1)}` : txt.charAt(0).toUpperCase() + txt.slice(1); }
  }
  if (semFb.length) out.gestora = `Sem conversa individual registrada desde ${mesNome(ant)}: ${semFb.map((p) => p.nome.split(" ")[0]).join(", ")}.`;
  return out;
}

/** O indicador da trilha antes e depois da aplicação (quando dá para medir). */
function eficacia(trilha, aplicacao, { resumo, dados }) {
  const mesApl = mesDeData(new Date(`${aplicacao.data}T15:00:00Z`));
  const antes = somarMeses(mesApl, -1);
  const depois = somarMeses(mesApl, 1);
  if (depois > mesAtual()) return { texto: `O efeito aparece em ${mesNome(depois)}.` };
  if (trilha.gatilho === "semResponsavel") return { antes: pct(totaisMes(resumo, antes).pctSemResponsavel), depois: pct(totaisMes(resumo, depois).pctSemResponsavel), rotulo: "sem responsável" };
  if (trilha.gatilho === "aprovacao") return { antes: pct(totaisMes(resumo, antes).taxa), depois: pct(totaisMes(resumo, depois).taxa), rotulo: "aprovação da equipe" };
  if (trilha.gatilho.startsWith("ocorrencia:")) {
    const tipo = trilha.gatilho.split(":")[1];
    const n = (m) => dados.ocorrencias.filter((o) => o.tipo === tipo && o.mes === m).length;
    return { antes: String(n(antes)), depois: String(n(depois)), rotulo: `ocorrências de ${tipo.toLowerCase()}` };
  }
  return { texto: "Acompanhe pelo indicador da trilha." };
}

export default function Treinamentos() {
  const [aba, setAba] = useState("apresentacoes");
  return (
    <>
      <Abas valor={aba} aoMudar={setAba} abas={[["apresentacoes", "Apresentações de treinamento"], ["trilhas", "Trilhas do comercial"], ["reciclagem", "Periodicidade e reciclagem"]]} />
      {aba === "reciclagem" ? <Reciclagem irParaTrilha={() => setAba("trilhas")} /> : aba === "trilhas" ? <Trilhas /> : (
        <>
          <Cabecalho sobre="Treinamentos" titulo="Apresentações de treinamento" sub="Integração de novos colaboradores pronta e um modelo para criar treinamentos novos no estilo MinasLab." />
          <Estudio categoria="treinamento" />
        </>
      )}
    </>
  );
}

function Trilhas() {
  const { resumo, equipeAtual: equipe, dados, remover } = useBase();
  const nps = useCRM("nps", npsCRM);
  const lic = useCRM("licitacoes", licitacoesCRM);
  const sug = motivos({ resumo, equipe, dados, nps: nps.dados?.respostas, lics: lic.dados?.licitacoes });
  const ordem = [...TRILHAS].sort((a, b) => (sug[b.id] ? 1 : 0) - (sug[a.id] ? 1 : 0));
  const [sel, setSel] = useState(ordem[0].id);
  const [modo, setModo] = useState("guia");
  const t = trilhaPorId(sel);
  const aplicacoes = dados.treinamentos.filter((x) => x.trilhaId && x.trilhaId === sel).sort((a, b) => String(b.data).localeCompare(String(a.data)));

  return (
    <>
      <Cabecalho sobre="Treinamentos" titulo={`${Object.keys(sug).length} treinamento(s) sugerido(s) pelos números`} sub="Cada trilha vem com slides, roteiro de quem conduz, exercício e teste rápido." />
      <Orientacao tela="treinamentos" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 8 }}>
          {ordem.map((x) => {
            const n = dados.treinamentos.filter((a) => a.trilhaId === x.id).length;
            return (
              <button key={x.id} type="button" onClick={() => { setSel(x.id); setModo("guia"); }} className="card" style={{ textAlign: "left", padding: 14, cursor: "pointer", border: x.id === sel ? "2px solid var(--marca)" : undefined, background: x.id === sel ? "var(--marca-50)" : undefined, font: "inherit", color: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontWeight: 600 }}>{x.nome}</b>{sug[x.id] ? <Chip tom="marca">Sugerido</Chip> : n ? <Chip tom="ok">Aplicado {n}×</Chip> : null}</div>
                <div className="suave peq">{x.publico} · {x.minutos} min</div>
                {sug[x.id] && <div className="peq" style={{ color: "var(--marca-900)", marginTop: 4 }}>{sug[x.id]}</div>}
              </button>
            );
          })}
        </div>

        <div style={{ flex: "3 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                {sug[t.id] && <Chip tom="marca">Sugerido pelos dados</Chip>}
                <h2 style={{ fontSize: 22, marginTop: 6 }}>{t.nome}</h2>
                <div className="suave">{t.objetivo}</div>
              </div>
              <div className="pilulas">
                {[["guia", "Guia"], ["slides", "Slides"], ["registro", "Registrar aplicação"]].map(([id, nome]) => <button key={id} type="button" className={`pilula${modo === id ? " ativa" : ""}`} onClick={() => setModo(id)}>{nome}</button>)}
              </div>
            </div>
            {sug[t.id] && <div className="aviso marca" style={{ marginTop: 12 }}><b>Por que agora:</b> {sug[t.id]}</div>}
            <div className="peq suave" style={{ marginTop: 10 }}>Indicador que deve melhorar: <b>{t.indicador}</b> · Para: {t.publico} · {t.minutos} min</div>
          </Card>

          {modo === "guia" && (
            <div className="grade grade-2" style={{ alignItems: "start" }}>
              <Card>
                <h3>Roteiro</h3>
                <table style={{ marginTop: 6 }}><tbody>{t.roteiro.map((r) => <tr key={r.min}><td className="tnum suave" style={{ width: 64 }}>{r.min}</td><td className="peq">{r.passo}</td></tr>)}</tbody></table>
                <h3 style={{ marginTop: 16 }}>Exercício</h3>
                <p className="peq" style={{ marginBottom: 0 }}>{t.exercicio}</p>
              </Card>
              <Card>
                <h3>Teste rápido</h3>
                {t.perguntas.map((q, k) => <Pergunta key={`${t.id}-${k}`} q={q} n={k + 1} />)}
              </Card>
            </div>
          )}

          {modo === "slides" && t.modelo && <SlidesDoModelo key={t.id} modelo={t.modelo} />}
          {modo === "slides" && !t.modelo && (
            <Slides titulo={`Treinamento · ${t.nome}`} slides={[
              { titulo: t.nome, corpo: <div><div style={{ fontSize: "1.3em" }}>{t.objetivo}</div><div className="suave" style={{ marginTop: 12 }}>{t.publico} · {t.minutos} minutos</div></div>, roteiro: t.roteiro[0]?.passo, minutos: 2 },
              ...t.slides.map((x, k) => ({ titulo: `${k + 1}. ${x.split(":")[0].split(".")[0].slice(0, 60)}`, corpo: <div style={{ fontSize: "1.3em", lineHeight: 1.5 }}>{x}</div>, minutos: 3 })),
              { titulo: "Exercício", corpo: <div style={{ fontSize: "1.2em" }}>{t.exercicio}</div>, roteiro: "Dê tempo para todos fazerem; circule ajudando.", minutos: 10 },
              { titulo: "Teste rápido", corpo: <ol>{t.perguntas.map((q) => <li key={q.p} style={{ marginBottom: 8 }}>{q.p}<div className="suave peq">{q.opcoes.join(" · ")}</div></li>)}</ol>, roteiro: "Cada um responde no papel; depois corrijam juntos. Registre as notas em Registrar aplicação.", minutos: 5 },
            ]} />
          )}

          {modo === "registro" && <Registro trilha={t} />}

          <Card semPad>
            <div className="card-cab"><h3>Aplicações</h3><span className="suave peq">{aplicacoes.length}</span></div>
            {aplicacoes.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Ainda não aplicado.</div> : (
              <div className="tabela-caixa"><table>
                <thead><tr><th>Data</th><th>Participantes</th><th>Nota média</th><th>Efeito no indicador</th><th /></tr></thead>
                <tbody>{aplicacoes.map((a) => {
                  const ef = eficacia(t, a, { resumo, dados });
                  const notas = (a.participantes || []).map((p) => p.nota).filter((n) => n != null && n !== "");
                  return (
                    <tr key={a.id}>
                      <td className="tnum">{dataCurta(a.data)}</td>
                      <td className="peq">{(a.participantes || []).filter((p) => p.presente).map((p) => nomeProprio(p.nome || equipe.find((m) => m.id === p.pessoaId)?.nome || "—").split(" ")[0]).join(", ")}</td>
                      <td className="tnum">{notas.length ? `${Math.round(notas.reduce((s, n) => s + Number(n), 0) / notas.length)}%` : "—"}</td>
                      <td className="peq">{ef.texto || `${ef.rotulo}: ${ef.antes} → ${ef.depois}`}</td>
                      <td><button type="button" className="btn perigo mini" onClick={() => window.confirm("Apagar este registro de aplicação? Ele sai também do perfil dos participantes.") && remover("treinamentos", a.id)}>Apagar</button></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/** Trilha com apresentação própria (ex.: análise crítica, estilo colorido). */
function SlidesDoModelo({ modelo }) {
  const [slides] = useState(() => slidesDoModelo(modelo));
  const [i, setI] = useState(0);
  const m = modeloPorId(modelo);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Apresentador slides={slides} ctx={{ tema: m?.tema, valores: { mes: "", ano: "" } }} i={i} setI={setI} />
      <div className="suave peq">Para editar os slides, baixar em PowerPoint ou gerar a ata, crie a apresentação pela aba <b>Apresentações de treinamento</b> com o modelo “{m?.nome}”.</div>
    </div>
  );
}

/** Periodicidade de cada trilha e situação de reciclagem de cada pessoa. */
const ROT = { "em-dia": ["ok", "Em dia"], vence: ["alerta", "Vence em breve"], vencido: ["ruim", "Vencido"], nunca: ["neutro", "Nunca fez"] };
function Reciclagem({ irParaTrilha }) {
  const { equipeAtual: equipe, dados, gravar } = useBase();
  const [msg, setMsg] = useState("");
  const hoje = hojeBR();
  const per = periodosEmVigor(dados.treinamentos);
  const m = matrizReciclagem({ trilhas: TRILHAS, registros: dados.treinamentos, pessoas: equipe, hoje });
  const mudar = async (id, meses) => {
    setMsg("");
    try { await gravar("treinamentos", { id: ID_CONFIG, tipo: "periodicidade", periodos: { ...per, [id]: Number(meses) } }); setMsg("Periodicidade salva."); }
    catch (e) { setMsg(e.message); }
  };
  const celula = (c) => {
    if (!c) return null;
    const [tom, rot] = ROT[c.status] || ["neutro", ""];
    return <div><Chip tom={tom}>{rot}</Chip>{c.vence && <div className="suave peq" style={{ marginTop: 2 }}>{c.status === "vencido" ? "venceu" : "vence"} {dataCurta(c.vence)}</div>}</div>;
  };
  return (
    <>
      <Cabecalho sobre="Treinamentos" titulo="Periodicidade e reciclagem" sub="Defina de quanto em quanto tempo cada treinamento deve ser refeito. O sistema conta a partir da última aplicação registrada de cada pessoa e avisa 30 dias antes de vencer." />
      <div className="grade grade-kpi">
        <Card><div className="suave peq">Reciclagens vencidas</div><div style={{ fontSize: 28, fontWeight: 700, color: m.totais.vencido ? "var(--ruim)" : undefined }}>{m.totais.vencido}</div></Card>
        <Card><div className="suave peq">Vencem nos próximos 30 dias</div><div style={{ fontSize: 28, fontWeight: 700, color: m.totais.vence ? "var(--alerta)" : undefined }}>{m.totais.vence}</div></Card>
        <Card><div className="suave peq">Treinamentos obrigatórios nunca feitos</div><div style={{ fontSize: 28, fontWeight: 700 }}>{m.totais.nunca}</div></Card>
      </div>

      <Card semPad>
        <div className="card-cab"><h2>Situação da equipe</h2><span className="suave peq">{equipe.length} pessoa(s) · {m.periodicas.length} treinamento(s) com reciclagem</span></div>
        {m.periodicas.length === 0 || equipe.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>{equipe.length ? "Defina a periodicidade de algum treinamento abaixo." : "Cadastre a equipe do setor em Equipe e metas."}</div> : (
          <div className="tabela-caixa"><table>
            <thead><tr><th>Pessoa</th>{m.periodicas.map((t) => <th key={t.id} style={{ minWidth: 130 }}>{t.nome}<div className="suave peq" style={{ textTransform: "none", fontWeight: 400 }}>{OPCOES_PERIODO.find(([v]) => v === per[t.id])?.[1] || `a cada ${per[t.id]} meses`}</div></th>)}</tr></thead>
            <tbody>{m.linhas.map((l) => <tr key={l.pessoa.id}><td>{l.pessoa.nome}</td>{m.periodicas.map((t) => <td key={t.id}>{celula(l.celulas[t.id])}</td>)}</tr>)}</tbody>
          </table></div>
        )}
      </Card>

      {m.pendencias.length > 0 && (
        <Card semPad>
          <div className="card-cab"><h2>O que aplicar primeiro</h2><button type="button" className="btn claro mini" onClick={irParaTrilha}>Ir para as trilhas e registrar</button></div>
          <div className="tabela-caixa"><table>
            <thead><tr><th>Pessoa</th><th>Treinamento</th><th>Situação</th><th>Última aplicação</th></tr></thead>
            <tbody>{m.pendencias.slice(0, 30).map((x) => <tr key={`${x.pessoa.id}-${x.trilha.id}`}><td>{x.pessoa.nome}</td><td>{x.trilha.nome}</td><td>{celula(x)}</td><td className="tnum">{x.ultima ? dataCurta(x.ultima) : "—"}</td></tr>)}</tbody>
          </table></div>
        </Card>
      )}

      <Card semPad>
        <div className="card-cab"><h2>Periodicidade de cada treinamento</h2>{msg && <span className="peq suave">{msg}</span>}</div>
        <div className="tabela-caixa"><table>
          <thead><tr><th>Treinamento</th><th>Para</th><th>Refazer</th></tr></thead>
          <tbody>{TRILHAS.map((t) => (
            <tr key={t.id}>
              <td>{t.nome}</td>
              <td className="peq suave">{t.publico}</td>
              <td><select className="entrada" style={{ maxWidth: 240 }} aria-label={`Periodicidade de ${t.nome}`} value={per[t.id] ?? 0} onChange={(e) => mudar(t.id, e.target.value)}>
                {OPCOES_PERIODO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select></td>
            </tr>
          ))}</tbody>
        </table></div>
        <div className="suave peq" style={{ padding: "0 20px 16px" }}>Os valores iniciais são sugestões (anual para os treinamentos ligados à ISO/IEC 17025 e ao CRM). Treinamentos com reciclagem valem para toda a equipe do setor. A ISO/IEC 17025 (6.2) pede monitorar a competência do pessoal: esta tela e os registros de aplicação são a evidência.</div>
      </Card>
    </>
  );
}

function Pergunta({ q, n }) {
  const [ver, setVer] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <div className="peq" style={{ fontWeight: 600 }}>{n}. {q.p}</div>
      <ol type="a" className="peq" style={{ margin: "4px 0 0", paddingLeft: 22 }}>
        {q.opcoes.map((o, k) => <li key={o} style={{ color: ver && k === q.certa ? "var(--ok)" : undefined, fontWeight: ver && k === q.certa ? 600 : 400 }}>{o}</li>)}
      </ol>
      <button type="button" className="btn claro mini" style={{ marginTop: 6 }} onClick={() => setVer((v) => !v)}>{ver ? "Esconder resposta" : "Ver resposta"}</button>
    </div>
  );
}

function Registro({ trilha }) {
  const { equipeAtual: equipe, elenco, gravar } = useBase();
  const pessoas = pessoasParaTreinamento(equipe, elenco);
  const [data, setData] = useState(hojeBR());
  const [sel, setSel] = useState({}); // id -> nota ("" = sem nota)
  const [busca, setBusca] = useState("");
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState("");
  const marcados = pessoas.filter((p) => p.id in sel);
  const visiveis = pessoas.filter((p) => !busca || norm(p.nome).includes(norm(busca)));
  const alternar = (id) => setSel((x) => { const n = { ...x }; if (id in n) delete n[id]; else n[id] = ""; return n; });
  const salvar = async () => {
    if (!marcados.length) { setMsg("Marque quem participou."); return; }
    try {
      await gravar("treinamentos", {
        trilhaId: trilha.id, titulo: trilha.nome, data, obs,
        participantes: marcados.map((p) => ({ pessoaId: p.id, rhPessoaId: p.rhPessoaId || "", nome: p.nome, presente: true, nota: sel[p.id] === "" ? null : Number(sel[p.id]) })),
      });
      setMsg(`Aplicação registrada para ${marcados.length} pessoa(s). Já aparece no perfil de cada uma.`); setObs(""); setSel({});
    } catch (e) { setMsg(e.message); }
  };
  return (
    <Card>
      <h3>Registrar aplicação</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="campo" style={{ maxWidth: 180 }}><label htmlFor="t-data">Data</label><input id="t-data" type="date" className="entrada" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="campo" style={{ flex: "1 1 200px" }}><label htmlFor="t-busca">Buscar colaborador</label><input id="t-busca" className="entrada" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome" /></div>
          <button type="button" className="btn claro mini" onClick={() => setSel((x) => ({ ...Object.fromEntries(pessoas.filter((p) => p.daEquipe).map((p) => [p.id, ""])), ...x }))}>Marcar a equipe do setor</button>
          <button type="button" className="btn claro mini" onClick={() => setSel({})}>Limpar</button>
        </div>
        <div className="suave peq">{marcados.length} selecionado(s) de {pessoas.length}. Aparecem todos os colaboradores ativos da MinasLab; a equipe do setor vem primeiro.</div>
        <div className="tabela-caixa" style={{ maxHeight: 420, overflow: "auto" }}>
          <table><thead><tr><th style={{ width: 40 }} /><th>Colaborador</th><th>Nota do teste (%)</th></tr></thead><tbody>
            {visiveis.map((p) => (
              <tr key={p.id} style={p.id in sel ? { background: "var(--marca-50)" } : undefined}>
                <td><input type="checkbox" aria-label={`${p.nome} participou`} checked={p.id in sel} onChange={() => alternar(p.id)} style={{ width: 18, height: 18 }} /></td>
                <td onClick={() => alternar(p.id)} style={{ cursor: "pointer" }}>{nomeProprio(p.nome)}{p.daEquipe && <span className="suave peq"> · equipe do setor</span>}</td>
                <td>{p.id in sel && <input className="entrada num" type="number" min="0" max="100" style={{ width: 100 }} aria-label={`Nota de ${p.nome}`} value={sel[p.id]} onChange={(e) => setSel({ ...sel, [p.id]: e.target.value })} />}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <div className="campo"><label htmlFor="t-obs">Observações</label><textarea id="t-obs" className="entrada" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><button type="button" className="btn" onClick={salvar}>Salvar ({marcados.length})</button>{msg && <span className="peq">{msg}</span>}</div>
        <div className="suave peq">Fica como registro de treinamento por pessoa, com data e nota (evidência de competência para a ISO/IEC 17025), e aparece em Pessoas e feedback › Treinamentos.</div>
      </div>
    </Card>
  );
}
