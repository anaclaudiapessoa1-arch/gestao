// Treinamentos: trilhas prontas, sugeridas pelos números; registro de quem
// participou e nota do teste; e o efeito no indicador (antes × depois).
import { useState } from "react";
import { useBase, useCRM } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Abas } from "../components/ui.jsx";
import { Estudio } from "../components/Estudio.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { Slides } from "../components/Slides.jsx";
import { npsCRM, licitacoesCRM } from "../services/crm.js";
import { TRILHAS, trilhaPorId } from "../lib/trilhas.js";
import { hojeBR, dataCurta, mesAtual, somarMeses, mesDeData, mesNome, pct } from "../lib/format.js";
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
      <Abas valor={aba} aoMudar={setAba} abas={[["apresentacoes", "Apresentações de treinamento"], ["trilhas", "Trilhas do comercial"]]} />
      {aba === "trilhas" ? <Trilhas /> : (
        <>
          <Cabecalho sobre="Treinamentos" titulo="Apresentações de treinamento" sub="Integração de novos colaboradores pronta e um modelo para criar treinamentos novos no estilo MinasLab." />
          <Estudio categoria="treinamento" />
        </>
      )}
    </>
  );
}

function Trilhas() {
  const { resumo, equipe, dados } = useBase();
  const nps = useCRM("nps", npsCRM);
  const lic = useCRM("licitacoes", licitacoesCRM);
  const sug = motivos({ resumo, equipe, dados, nps: nps.dados?.respostas, lics: lic.dados?.licitacoes });
  const ordem = [...TRILHAS].sort((a, b) => (sug[b.id] ? 1 : 0) - (sug[a.id] ? 1 : 0));
  const [sel, setSel] = useState(ordem[0].id);
  const [modo, setModo] = useState("guia");
  const t = trilhaPorId(sel);
  const aplicacoes = dados.treinamentos.filter((x) => x.trilhaId === sel).sort((a, b) => String(b.data).localeCompare(String(a.data)));

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

          {modo === "slides" && (
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
                <thead><tr><th>Data</th><th>Participantes</th><th>Nota média</th><th>Efeito no indicador</th></tr></thead>
                <tbody>{aplicacoes.map((a) => {
                  const ef = eficacia(t, a, { resumo, dados });
                  const notas = (a.participantes || []).map((p) => p.nota).filter((n) => n != null && n !== "");
                  return (
                    <tr key={a.id}>
                      <td className="tnum">{dataCurta(a.data)}</td>
                      <td className="peq">{(a.participantes || []).filter((p) => p.presente).map((p) => equipe.find((m) => m.id === p.pessoaId)?.nome.split(" ")[0] || "—").join(", ")}</td>
                      <td className="tnum">{notas.length ? `${Math.round(notas.reduce((s, n) => s + Number(n), 0) / notas.length)}%` : "—"}</td>
                      <td className="peq">{ef.texto || `${ef.rotulo}: ${ef.antes} → ${ef.depois}`}</td>
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
  const { equipe, gravar } = useBase();
  const [data, setData] = useState(hojeBR());
  const [part, setPart] = useState(() => Object.fromEntries(equipe.map((p) => [p.id, { presente: true, nota: "" }])));
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState("");
  const salvar = async () => {
    try {
      await gravar("treinamentos", { trilhaId: trilha.id, data, obs, participantes: Object.entries(part).map(([pessoaId, v]) => ({ pessoaId, presente: v.presente, nota: v.nota === "" ? null : Number(v.nota) })) });
      setMsg("Aplicação registrada."); setObs("");
    } catch (e) { setMsg(e.message); }
  };
  return (
    <Card>
      <h3>Registrar aplicação</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        <div className="campo" style={{ maxWidth: 180 }}><label htmlFor="t-data">Data</label><input id="t-data" type="date" className="entrada" value={data} onChange={(e) => setData(e.target.value)} /></div>
        <table><thead><tr><th>Pessoa</th><th>Presente</th><th>Nota do teste (%)</th></tr></thead><tbody>
          {equipe.map((p) => (
            <tr key={p.id}>
              <td>{p.nome}</td>
              <td><input type="checkbox" aria-label={`${p.nome} presente`} checked={part[p.id]?.presente ?? false} onChange={(e) => setPart({ ...part, [p.id]: { ...part[p.id], presente: e.target.checked } })} style={{ width: 18, height: 18 }} /></td>
              <td><input className="entrada num" type="number" min="0" max="100" aria-label={`Nota de ${p.nome}`} value={part[p.id]?.nota ?? ""} onChange={(e) => setPart({ ...part, [p.id]: { ...part[p.id], nota: e.target.value } })} /></td>
            </tr>
          ))}
        </tbody></table>
        <div className="campo"><label htmlFor="t-obs">Observações</label><textarea id="t-obs" className="entrada" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}><button type="button" className="btn" onClick={salvar}>Salvar</button>{msg && <span className="peq">{msg}</span>}</div>
        <div className="suave peq">Fica como registro de treinamento por pessoa (evidência de competência para a ISO/IEC 17025).</div>
      </div>
    </Card>
  );
}
