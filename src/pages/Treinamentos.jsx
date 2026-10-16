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
import { matrizReciclagem, OPCOES_PERIODO, OPCOES_PRAZO_NOVO, ID_CONFIG, planoEmVigor, agenda } from "../lib/reciclagem.js";
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
      <Abas valor={aba} aoMudar={setAba} abas={[["apresentacoes", "Apresentações de treinamento"], ["trilhas", "Trilhas do comercial"], ["reciclagem", "Plano e calendário"]]} />
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
  const aplicacoes = dados.treinamentos.filter((x) => x.trilhaId && x.tipo !== "agenda" && x.trilhaId === sel).sort((a, b) => String(b.data).localeCompare(String(a.data)));

  return (
    <>
      <Cabecalho sobre="Treinamentos" titulo={`${Object.keys(sug).length} treinamento(s) sugerido(s) pelos números`} sub="Cada trilha vem com slides, roteiro de quem conduz, exercício e teste rápido." />
      <Orientacao tela="treinamentos" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 8 }}>
          {ordem.map((x) => {
            const n = dados.treinamentos.filter((a) => a.tipo !== "agenda" && a.trilhaId === x.id).length;
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
            <ResumoPlano trilhaId={t.id} />
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

/** Cargos, reciclagem, prazo para novos e próxima data de uma trilha (no guia). */
function ResumoPlano({ trilhaId }) {
  const { dados } = useBase();
  const plano = planoEmVigor(dados.treinamentos);
  const cargos = (plano.cargos[trilhaId] || []).map((id) => dados.funcoes.find((f) => f.id === id)?.nome).filter(Boolean);
  const per = plano.periodos[trilhaId] || 0;
  const novo = plano.prazoNovo[trilhaId] || 0;
  const prox = agenda(dados.treinamentos, { desde: hojeBR() }).find((a) => a.trilhaId === trilhaId);
  return (
    <div className="peq" style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
      <Chip tom="neutro">Cargos: {cargos.length ? cargos.join(", ") : "toda a equipe"}</Chip>
      <Chip tom="neutro">{per ? `Reciclagem: ${OPCOES_PERIODO.find(([v]) => v === per)?.[1].toLowerCase() || `a cada ${per} meses`}` : "Sem reciclagem"}</Chip>
      {novo > 0 && <Chip tom="neutro">Novos: até {novo} dias após a entrada</Chip>}
      {prox && <Chip tom="marca">Próxima aplicação: {dataCurta(prox.data)}{prox.hora ? ` às ${prox.hora}` : ""}</Chip>}
    </div>
  );
}

/** Plano de cada trilha (cargos, reciclagem, novos), calendário e situação de cada pessoa. */
const ROT = { "em-dia": ["ok", "Em dia"], vence: ["alerta", "Vence em breve"], vencido: ["ruim", "Vencido"], nunca: ["neutro", "Nunca fez"], pendente: ["alerta", "Novo: fazer"], "nao-se-aplica": ["neutro", "Não se aplica"] };
function Reciclagem({ irParaTrilha }) {
  const { equipeAtual: equipe, dados, gravar } = useBase();
  const [msg, setMsg] = useState("");
  const [abrirCargos, setAbrirCargos] = useState(null);
  const hoje = hojeBR();
  const plano = planoEmVigor(dados.treinamentos);
  const m = matrizReciclagem({ trilhas: TRILHAS, registros: dados.treinamentos, pessoas: equipe, hoje });
  const funcoes = dados.funcoes || [];
  const salvar = async (parte) => {
    setMsg("");
    try { await gravar("treinamentos", { id: ID_CONFIG, tipo: "periodicidade", periodos: plano.periodos, cargos: plano.cargos, prazoNovo: plano.prazoNovo, ...parte }); setMsg("Plano salvo."); }
    catch (e) { setMsg(e.message); }
  };
  const mudarCargo = (tid, fid) => {
    const atual = plano.cargos[tid] || [];
    salvar({ cargos: { ...plano.cargos, [tid]: atual.includes(fid) ? atual.filter((x) => x !== fid) : [...atual, fid] } });
  };
  const celula = (c) => {
    if (!c) return null;
    const [tom, rot] = ROT[c.status] || ["neutro", ""];
    if (c.status === "nao-se-aplica") return <span className="suave peq">—</span>;
    return <div><Chip tom={tom}>{rot}</Chip>{c.vence && <div className="suave peq" style={{ marginTop: 2 }}>{c.status === "vencido" ? "venceu" : "até"} {dataCurta(c.vence)}</div>}</div>;
  };
  const semFuncao = equipe.filter((p) => !p.funcaoId).length;
  return (
    <>
      <Cabecalho sobre="Treinamentos" titulo="Plano e calendário de treinamentos" sub="Para cada treinamento: quais cargos precisam fazer, de quanto em quanto tempo reciclar, o prazo para quem acabou de entrar e as datas de aplicação. O sistema avisa 30 dias antes de vencer." />
      <div className="grade grade-kpi">
        <Card><div className="suave peq">Reciclagens vencidas</div><div style={{ fontSize: 28, fontWeight: 700, color: m.totais.vencido ? "var(--ruim)" : undefined }}>{m.totais.vencido}</div></Card>
        <Card><div className="suave peq">Vencem nos próximos 30 dias</div><div style={{ fontSize: 28, fontWeight: 700, color: m.totais.vence ? "var(--alerta)" : undefined }}>{m.totais.vence}</div></Card>
        <Card><div className="suave peq">Obrigatórios ainda não feitos</div><div style={{ fontSize: 28, fontWeight: 700 }}>{m.totais.nunca}</div></Card>
        <Card><div className="suave peq">Aplicações agendadas</div><div style={{ fontSize: 28, fontWeight: 700 }}>{agenda(dados.treinamentos, { desde: hoje }).length}</div></Card>
      </div>

      <Card semPad>
        <div className="card-cab"><h2>Plano de cada treinamento</h2>{msg && <span className="peq suave">{msg}</span>}</div>
        <div className="tabela-caixa"><table>
          <thead><tr><th>Treinamento</th><th>Cargos que precisam fazer</th><th>Reciclagem</th><th>Quem acabou de entrar</th></tr></thead>
          <tbody>{TRILHAS.map((t) => {
            const cs = plano.cargos[t.id] || [];
            return (
              <tr key={t.id}>
                <td>{t.nome}<div className="peq suave">{t.publico}</div></td>
                <td style={{ minWidth: 220 }}>
                  <div className="peq">{cs.length ? cs.map((id) => funcoes.find((f) => f.id === id)?.nome || "função apagada").join(", ") : <span className="suave">Toda a equipe do setor</span>}</div>
                  <button type="button" className="btn claro mini" style={{ marginTop: 4 }} onClick={() => setAbrirCargos(abrirCargos === t.id ? null : t.id)} aria-expanded={abrirCargos === t.id}>{abrirCargos === t.id ? "Fechar" : "Escolher cargos"}</button>
                  {abrirCargos === t.id && (
                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                      {funcoes.length === 0 && <span className="suave peq">Cadastre as funções em Funções e cargos.</span>}
                      {funcoes.map((f) => <label key={f.id} className="peq" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={cs.includes(f.id)} onChange={() => mudarCargo(t.id, f.id)} />{f.nome}</label>)}
                    </div>
                  )}
                </td>
                <td><select className="entrada" style={{ maxWidth: 220 }} aria-label={`Reciclagem de ${t.nome}`} value={plano.periodos[t.id] ?? 0} onChange={(e) => salvar({ periodos: { ...plano.periodos, [t.id]: Number(e.target.value) } })}>
                  {OPCOES_PERIODO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select></td>
                <td><select className="entrada" style={{ maxWidth: 180 }} aria-label={`Prazo para novos em ${t.nome}`} value={plano.prazoNovo[t.id] ?? 0} onChange={(e) => salvar({ prazoNovo: { ...plano.prazoNovo, [t.id]: Number(e.target.value) } })}>
                  {OPCOES_PRAZO_NOVO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select></td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <div className="suave peq" style={{ padding: "0 20px 16px" }}>Sem cargo marcado, o treinamento vale para toda a equipe do setor. O cargo de cada pessoa vem de Equipe e metas{semFuncao ? ` (${semFuncao} pessoa(s) ainda sem função)` : ""}. O prazo para quem acabou de entrar conta a partir da data de entrada. A ISO/IEC 17025 (6.2) pede definir e monitorar a competência por função: este plano e os registros de aplicação são a evidência.</div>
      </Card>

      <Calendario />

      <Card semPad>
        <div className="card-cab"><h2>Situação da equipe</h2><span className="suave peq">{equipe.length} pessoa(s) · {m.periodicas.length} treinamento(s) no plano</span></div>
        {m.periodicas.length === 0 || equipe.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>{equipe.length ? "Defina o plano de algum treinamento acima." : "Cadastre a equipe do setor em Equipe e metas."}</div> : (
          <div className="tabela-caixa"><table>
            <thead><tr><th>Pessoa</th>{m.periodicas.map((t) => <th key={t.id} style={{ minWidth: 130 }}>{t.nome}</th>)}</tr></thead>
            <tbody>{m.linhas.map((l) => <tr key={l.pessoa.id}><td>{l.pessoa.nome}</td>{m.periodicas.map((t) => <td key={t.id}>{celula(l.celulas[t.id])}</td>)}</tr>)}</tbody>
          </table></div>
        )}
      </Card>

      {m.pendencias.length > 0 && (
        <Card semPad>
          <div className="card-cab"><h2>O que aplicar primeiro</h2><button type="button" className="btn claro mini" onClick={irParaTrilha}>Ir para as trilhas e registrar</button></div>
          <div className="tabela-caixa"><table>
            <thead><tr><th>Pessoa</th><th>Treinamento</th><th>Situação</th><th>Última aplicação</th><th>Agendado</th></tr></thead>
            <tbody>{m.pendencias.slice(0, 30).map((x) => <tr key={`${x.pessoa.id}-${x.trilha.id}`}><td>{x.pessoa.nome}</td><td>{x.trilha.nome}</td><td>{celula(x)}</td><td className="tnum">{x.ultima ? dataCurta(x.ultima) : "—"}</td><td className="tnum">{x.agendada ? dataCurta(x.agendada.data) : <span className="suave">não</span>}</td></tr>)}</tbody>
          </table></div>
        </Card>
      )}
    </>
  );
}

/** Calendário de aplicação: datas agendadas por treinamento. */
function Calendario() {
  const { dados, gravar, remover } = useBase();
  const hoje = hojeBR();
  const vazio = { trilhaId: TRILHAS[0].id, data: "", hora: "", local: "", responsavel: "", obs: "" };
  const [f, setF] = useState(vazio);
  const [msg, setMsg] = useState("");
  const [passadas, setPassadas] = useState(false);
  const lista = agenda(dados.treinamentos, { desde: passadas ? "" : hoje });
  const porMes = lista.reduce((acc, a) => { const k = String(a.data).slice(0, 7); (acc[k] ||= []).push(a); return acc; }, {});
  const agendar = async (e) => {
    e.preventDefault();
    if (!f.data) { setMsg("Escolha a data."); return; }
    setMsg("");
    try {
      const t = trilhaPorId(f.trilhaId);
      await gravar("treinamentos", { id: `ag-${Date.now().toString(36)}`, tipo: "agenda", ...f, titulo: t?.nome || "" });
      setF({ ...vazio, trilhaId: f.trilhaId }); setMsg("Aplicação agendada.");
    } catch (e2) { setMsg(e2.message); }
  };
  const campo = (k, rot, props = {}) => <label className="campo" style={{ flex: props.flex || "1 1 140px" }}><span>{rot}</span><input className="entrada" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} /></label>;
  return (
    <Card semPad>
      <div className="card-cab"><h2>Calendário de aplicação</h2><label className="peq suave" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={passadas} onChange={(e) => setPassadas(e.target.checked)} />Mostrar datas passadas</label></div>
      <form onSubmit={agendar} style={{ padding: "0 20px 12px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <label className="campo" style={{ flex: "2 1 220px" }}><span>Treinamento</span><select className="entrada" value={f.trilhaId} onChange={(e) => setF({ ...f, trilhaId: e.target.value })}>{TRILHAS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
        {campo("data", "Data", { type: "date", flex: "1 1 150px" })}
        {campo("hora", "Hora", { type: "time", flex: "0 1 110px" })}
        {campo("local", "Local")}
        {campo("responsavel", "Quem aplica")}
        {campo("obs", "Observação", { flex: "2 1 200px" })}
        <button type="submit" className="btn">Agendar</button>
        {msg && <span className="peq suave">{msg}</span>}
      </form>
      {lista.length === 0 ? <div className="vazio" style={{ padding: "0 20px 20px" }}>Nenhuma aplicação agendada.</div> : (
        <div className="tabela-caixa"><table>
          <thead><tr><th>Data</th><th>Treinamento</th><th>Local</th><th>Quem aplica</th><th>Observação</th><th /></tr></thead>
          <tbody>{Object.entries(porMes).flatMap(([mes, itens]) => [
            <tr key={mes}><td colSpan={6} style={{ background: "var(--fundo-2, #f4f6f8)", fontWeight: 600 }}>{mesNome(mes)} {mes.slice(0, 4)}</td></tr>,
            ...itens.map((a) => (
              <tr key={a.id}>
                <td className="tnum">{dataCurta(a.data)}{a.hora ? ` · ${a.hora}` : ""}{a.data < hoje && <div className="suave peq">passou</div>}</td>
                <td>{trilhaPorId(a.trilhaId)?.nome || a.titulo}</td>
                <td className="peq">{a.local || "—"}</td>
                <td className="peq">{a.responsavel || "—"}</td>
                <td className="peq">{a.obs || ""}</td>
                <td><button type="button" className="btn perigo mini" onClick={() => window.confirm("Tirar esta data do calendário?") && remover("treinamentos", a.id)}>Apagar</button></td>
              </tr>
            )),
          ])}</tbody>
        </table></div>
      )}
      <div className="suave peq" style={{ padding: "0 20px 16px" }}>Depois de aplicar, registre quem participou em Trilhas → Registrar aplicação; é esse registro que conta para a reciclagem e aparece no perfil da pessoa.</div>
    </Card>
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
