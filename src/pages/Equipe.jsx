import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Modal, iniciais } from "../components/ui.jsx";
import { getSessao } from "../lib/sessao.js";
import { mesAtual, mesesAte, somarMeses, numero, brl } from "../lib/format.js";
import { mediaAnterior, realizado } from "../lib/calculos.js";

const norm = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export default function Equipe() {
  const { equipe, dados, resumo, gravar, config, elenco } = useBase();
  const [editando, setEditando] = useState(null);
  const [msg, setMsg] = useState("");
  const inativos = dados.equipe.filter((m) => m.ativo === false);

  // Quem teve propostas no CRM nos últimos 3 meses e ainda não está na equipe.
  const vinculados = new Set(dados.equipe.map((m) => m.crmProfileId).filter(Boolean));
  const eu = norm(getSessao()?.nome);
  const candidatos = Object.entries(resumo?.pessoas || {})
    .filter(([id, p]) => !vinculados.has(id) && p.ativo && norm(p.nome) !== eu)
    .map(([id, p]) => ({ id, nome: p.nome, n: mesesAte(somarMeses(mesAtual(), -1), 3).reduce((s, m) => s + realizado(resumo, { crmProfileId: id }, m).enviadas, 0) }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);

  const adicionarCandidatos = async () => {
    setMsg("");
    try {
      let ordem = equipe.length;
      for (const c of candidatos) {
        const metas = {};
        // Vínculo com o RH pelo primeiro e último nome; na dúvida, fica sem.
        const [pri, ...resto] = norm(c.nome).split(" ");
        const ult = resto.at(-1);
        const rh = elenco.filter((p) => { const n = norm(p.nome).split(" "); return n[0] === pri && (!ult || n.includes(ult)); });
        await gravar("equipe", { nome: c.nome, crmProfileId: c.id, rhPessoaId: rh.length === 1 ? rh[0].id : "", funcao: "Comercial", metas, ativo: true, ordem: ordem++ });
      }
      setMsg(`${candidatos.length} pessoa(s) adicionada(s). Confira funções e metas.`);
    } catch (e) {
      setMsg(e.message);
    }
  };

  return (
    <>
      <Cabecalho sobre="Equipe e metas" titulo="Quem é avaliado e com quais metas" sub="Cada pessoa é ligada ao seu usuário do CRM (de onde vêm os números) e ao cadastro do RH.">
        <button type="button" className="btn" onClick={() => setEditando({ ativo: true, metas: {} })}>Adicionar pessoa</button>
      </Cabecalho>

      {candidatos.length > 0 && (
        <div className="aviso marca" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <span>Com propostas no CRM nos últimos 3 meses e fora da equipe: <b>{candidatos.map((c) => `${c.nome} (${c.n})`).join(", ")}</b>.</span>
          <button type="button" className="btn mini" onClick={adicionarCandidatos}>Adicionar à equipe</button>
        </div>
      )}
      {msg && <div className="aviso marca">{msg}</div>}

      <Card semPad>
        <div className="tabela-caixa">
          <table>
            <thead><tr><th>Pessoa</th><th>Vínculos</th><th>Propostas/mês</th><th>Aprovação mín.</th><th>Ligações/dia</th><th /></tr></thead>
            <tbody>
              {equipe.length === 0 && <tr><td colSpan={6} className="suave">Ninguém na equipe ainda.</td></tr>}
              {equipe.map((m) => (
                <tr key={m.id}>
                  <td><div style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="avatar">{iniciais(m.nome)}</span><span><b style={{ display: "block", fontWeight: 600 }}>{m.nome}</b><span className="suave peq">{m.funcao}</span></span></div></td>
                  <td><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><Chip tom={m.crmProfileId ? "ok" : "alerta"}>{m.crmProfileId ? "CRM" : "Sem CRM"}</Chip><Chip tom={m.rhPessoaId ? "ok" : "neutro"}>{m.rhPessoaId ? "RH" : "Sem RH"}</Chip></div></td>
                  <td className="tnum">{m.metas?.propostas || "—"}</td>
                  <td className="tnum">{m.metas?.aprovacao ? `${m.metas.aprovacao}%` : "—"}</td>
                  <td className="tnum">{m.metas?.ligacoes || "—"}</td>
                  <td style={{ textAlign: "right" }}><button type="button" className="btn claro mini" onClick={() => setEditando(m)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {inativos.length > 0 && <div className="suave peq">Fora da equipe: {inativos.map((m) => m.nome).join(", ")} (abra Editar em “Adicionar pessoa” com o mesmo vínculo para reativar).</div>}

      <Regras config={config} />
      {editando && <EditorPessoa inicial={editando} aoFechar={() => setEditando(null)} />}
    </>
  );
}

function EditorPessoa({ inicial, aoFechar }) {
  const { resumo, elenco, gravar, dados } = useBase();
  const [m, setM] = useState({ nome: "", funcao: "", crmProfileId: "", rhPessoaId: "", ...inicial, metas: { ...(inicial.metas || {}) } });
  const [erro, setErro] = useState("");
  const perfis = Object.entries(resumo?.pessoas || {}).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const sugestao = m.crmProfileId ? mediaAnterior(resumo, { crmProfileId: m.crmProfileId }, mesAtual()) : null;
  const setMeta = (k) => (e) => setM((x) => ({ ...x, metas: { ...x.metas, [k]: e.target.value } }));

  const salvar = async () => {
    if (!m.nome.trim()) { setErro("Informe o nome."); return; }
    if (m.crmProfileId && dados.equipe.some((o) => o.id !== m.id && o.crmProfileId === m.crmProfileId && o.ativo !== false)) {
      setErro("Este usuário do CRM já está ligado a outra pessoa da equipe."); return;
    }
    const metas = { propostas: numero(m.metas.propostas), aprovacao: numero(m.metas.aprovacao), ligacoes: numero(m.metas.ligacoes) };
    try { await gravar("equipe", { ...m, nome: m.nome.trim(), metas }); aoFechar(); } catch (e) { setErro(e.message); }
  };

  return (
    <Modal titulo={inicial.id ? `Editar ${inicial.nome}` : "Adicionar pessoa"} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="campo"><label htmlFor="p-nome">Nome</label><input id="p-nome" className="entrada" value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} /></div>
        <div className="campo"><label htmlFor="p-func">Função</label><input id="p-func" className="entrada" value={m.funcao || ""} placeholder="Ex.: Propostas e atendimento" onChange={(e) => setM({ ...m, funcao: e.target.value })} /></div>
        <div className="campo">
          <label htmlFor="p-crm">Usuário no CRM (de onde vêm os números)</label>
          <select id="p-crm" className="entrada" value={m.crmProfileId || ""} onChange={(e) => {
            const id = e.target.value;
            setM((x) => ({ ...x, crmProfileId: id, nome: x.nome || resumo?.pessoas?.[id]?.nome || "" }));
          }}>
            <option value="">— sem vínculo —</option>
            {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.ativo ? "" : " (inativo)"}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="p-rh">Cadastro no RH</label>
          <select id="p-rh" className="entrada" value={m.rhPessoaId || ""} onChange={(e) => setM({ ...m, rhPessoaId: e.target.value })}>
            <option value="">— sem vínculo —</option>
            {elenco.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
        <div className="rotulo" style={{ marginTop: 4 }}>Metas mensais (deixe em branco o que não se aplica)</div>
        {sugestao != null && <div className="suave peq">Média dos últimos 6 meses: {Math.round(sugestao)} propostas. Sugestão de meta (+10%): {Math.round(sugestao * 1.1)}.</div>}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="campo"><label htmlFor="p-m1">Propostas/mês</label><input id="p-m1" className="entrada num" type="number" min="0" value={m.metas.propostas ?? ""} onChange={setMeta("propostas")} /></div>
          <div className="campo"><label htmlFor="p-m2">Aprovação mín. (%)</label><input id="p-m2" className="entrada num" type="number" min="0" max="100" value={m.metas.aprovacao ?? ""} onChange={setMeta("aprovacao")} /></div>
          <div className="campo"><label htmlFor="p-m3">Ligações/dia</label><input id="p-m3" className="entrada num" type="number" min="0" value={m.metas.ligacoes ?? ""} onChange={setMeta("ligacoes")} /></div>
        </div>
        {inicial.id && (
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
            <input type="checkbox" checked={m.ativo !== false} onChange={(e) => setM({ ...m, ativo: e.target.checked })} /> Faz parte da equipe
          </label>
        )}
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" onClick={salvar}>Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

function Regras({ config }) {
  const { gravar } = useBase();
  const [c, setC] = useState(config);
  const [msg, setMsg] = useState("");
  const set = (grupo, k) => (e) => setC((x) => ({ ...x, [grupo]: { ...x[grupo], [k]: e.target.value } }));
  const somaPesos = ["metas", "tec", "comp"].reduce((s, k) => s + (numero(c.pesos[k]) || 0), 0);
  const salvar = async () => {
    if (somaPesos !== 100) { setMsg("Os pesos precisam somar 100%."); return; }
    const n = (v) => numero(v) ?? 0;
    try {
      await gravar("config", {
        id: "geral",
        bonus: { f1: n(c.bonus.f1), v1: n(c.bonus.v1), f2: n(c.bonus.f2), v2: n(c.bonus.v2) },
        pesos: { metas: n(c.pesos.metas), tec: n(c.pesos.tec), comp: n(c.pesos.comp) },
        desconto: n(c.desconto), descontoMax: n(c.descontoMax),
      });
      setMsg("Regras salvas.");
    } catch (e) { setMsg(e.message); }
  };
  const Num = ({ id, rot, valor, onChange, step = "1" }) => (
    <div className="campo"><label htmlFor={id}>{rot}</label><input id={id} className="entrada num" type="number" step={step} value={valor} onChange={onChange} /></div>
  );
  return (
    <Card>
      <h2>Regras de avaliação e bônus</h2>
      <div className="suave peq" style={{ marginTop: 4 }}>Valem para todos. Por envolver remuneração, valide com a contabilidade antes de comunicar à equipe.</div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 16 }}>
        {Num({ id: "r-f1", rot: "Faixa 1: nota ≥", valor: c.bonus.f1, onChange: set("bonus", "f1"), step: "0.5" })}
        {Num({ id: "r-v1", rot: `Valor (${brl(numero(c.bonus.v1))})`, valor: c.bonus.v1, onChange: set("bonus", "v1") })}
        {Num({ id: "r-f2", rot: "Faixa 2: nota ≥", valor: c.bonus.f2, onChange: set("bonus", "f2"), step: "0.5" })}
        {Num({ id: "r-v2", rot: `Valor (${brl(numero(c.bonus.v2))})`, valor: c.bonus.v2, onChange: set("bonus", "v2") })}
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 16 }}>
        {Num({ id: "r-pm", rot: "Peso metas (%)", valor: c.pesos.metas, onChange: set("pesos", "metas") })}
        {Num({ id: "r-pt", rot: "Peso técnicos (%)", valor: c.pesos.tec, onChange: set("pesos", "tec") })}
        {Num({ id: "r-pc", rot: "Peso comportamentais (%)", valor: c.pesos.comp, onChange: set("pesos", "comp") })}
        {Num({ id: "r-d", rot: "Desconto por ocorrência", valor: c.desconto, onChange: (e) => setC({ ...c, desconto: e.target.value }), step: "0.5" })}
        {Num({ id: "r-dm", rot: "Desconto máximo", valor: c.descontoMax, onChange: (e) => setC({ ...c, descontoMax: e.target.value }), step: "0.5" })}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
        <button type="button" className="btn" onClick={salvar}>Salvar regras</button>
        <span className="peq" style={{ color: somaPesos === 100 ? "var(--suave)" : "var(--ruim)" }}>Pesos somam {somaPesos}%</span>
        {msg && <span className="peq">{msg}</span>}
      </div>
    </Card>
  );
}
