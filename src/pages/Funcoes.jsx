// Funções (cargos): a descrição do cargo vira estratégia, metas padrão,
// critérios técnicos da avaliação, rotina semanal, competências do PDI e
// trilhas de treinamento. Cada pessoa da equipe é ligada a uma função.

import { useState } from "react";
import { useBase } from "../hooks/base.jsx";
import { Card, Chip, Cabecalho, Modal } from "../components/ui.jsx";
import { Orientacao } from "../components/Orientacao.jsx";
import { TRILHAS, trilhaPorId } from "../lib/trilhas.js";
import { numero } from "../lib/format.js";

const linhas = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
const slug = (s) => String(s).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// Modelos tirados da planilha de avaliação que existia antes do sistema.
const MODELOS = [
  {
    nome: "Propostas e atendimento",
    missao: "Transformar pedidos de clientes em propostas certas, rápidas e acompanhadas até a decisão.",
    responsabilidades: "Elaborar e enviar propostas\nManter o CRM atualizado (responsável, interações, ligações)\nAtendimento e negociação com o cliente\nAgendamentos e coletas\nPós-venda",
    outrasMetas: "CRM atualizado diariamente\nFollow-up de toda proposta em até 7 dias",
    criterios: "Organização — CRM, documentos e propostas em ordem\nComunicação — retorno ao cliente, alinhamento com a equipe\nAtendimento ao cliente — negociação, pós-venda\nConformidade ISO 17025 — registros, POPs, rastreabilidade",
    competencias: "Negociação e tratamento de objeções\nConhecimento técnico dos ensaios\nOrganização do CRM",
    rotina: "Segunda: revisar propostas abertas há mais de 7 dias\nTodo dia: registrar ligações e interações no CRM\nSexta: conferir propostas da semana sem responsável",
    estrategia: "Volume com qualidade: proposta certa na primeira vez e acompanhamento até a decisão. Foco do trimestre: follow-up em 7 dias e zero proposta sem responsável.",
    trilhas: ["crm-sem-furos", "follow-up", "proposta-sem-erro", "spin"],
  },
  {
    nome: "Licitações, pedidos e estoque",
    missao: "Garantir que a MinasLab dispute as licitações certas, sem perder por documento, e que pedidos e estoque não travem a operação.",
    responsabilidades: "Licitações: análise de edital, documentação, prazos\nPedidos e estoque\nSuporte às propostas\nAtendimento",
    outrasMetas: "Planilhas atualizadas\nLigações de prospecção\nChecklist semanal cumprido",
    criterios: "Organização — estoque, documentos, planilhas\nComunicação — repasse de informações, alinhamento com a equipe\nAtendimento ao cliente — agilidade, cordialidade, resolução\nConformidade ISO 17025 — registros, POPs, rastreabilidade",
    competencias: "Leitura de edital e habilitação\nControle de prazos",
    rotina: "Segunda: conferir prazos de licitações da semana\nQuarta: conferir validade de certidões\nSexta: checklist semanal de pedidos e estoque",
    estrategia: "Disputar menos licitações e ganhar mais: escolher bem o edital, zero perda por documento e registrar o motivo de cada perda.",
    trilhas: ["licitacoes", "crm-sem-furos", "atendimento"],
  },
  {
    nome: "Suporte operacional",
    missao: "Fazer a amostra e a informação chegarem certas ao laboratório, da primeira vez.",
    responsabilidades: "Atendimento\nEnvio de frascos e materiais\nProtocolo e recebimento de amostras\nPlanilhas de controle",
    outrasMetas: "Planilhas atualizadas\nChecklist semanal cumprido\nLigações quando solicitado",
    criterios: "Organização — ambiente, materiais e registros\nComunicação — repasse de informações, alinhamento com a equipe\nAtendimento ao cliente — agilidade, cordialidade, resolução\nConformidade ISO 17025 — registros, POPs, rastreabilidade",
    competencias: "Conferência de OS e protocolo\nComunicação com o laboratório",
    rotina: "Todo dia: conferir OS abertas contra a proposta\nSexta: checklist semanal",
    estrategia: "Zero retrabalho em OS: conferência antes de liberar e um só canal de aviso ao laboratório.",
    trilhas: ["os-correta", "atendimento"],
  },
];

export function paraRegistro(f) {
  const criterios = linhas(f.criteriosTexto).map((l) => {
    const [nome, ...desc] = l.split(/\s+[—–-]\s+/);
    return { id: slug(nome) || "crit", nome: nome.trim(), desc: desc.join(" — ").trim() };
  });
  return {
    id: f.id, nome: f.nome.trim(), descricao: f.descricao || "", missao: f.missao || "",
    responsabilidades: f.responsabilidades || "", outrasMetas: f.outrasMetas || "",
    metasPadrao: { propostas: numero(f.metasPadrao?.propostas), aprovacao: numero(f.metasPadrao?.aprovacao), ligacoes: numero(f.metasPadrao?.ligacoes) },
    criterios, competencias: f.competencias || "", rotina: f.rotina || "", estrategia: f.estrategia || "", trilhas: f.trilhas || [],
  };
}

const paraForm = (r) => ({ ...r, metasPadrao: { ...(r.metasPadrao || {}) }, trilhas: r.trilhas || [], criteriosTexto: (r.criterios || []).map((c) => (c.desc ? `${c.nome} — ${c.desc}` : c.nome)).join("\n") });

export default function Funcoes() {
  const { dados, equipe, gravar, remover } = useBase();
  const [editando, setEditando] = useState(null);
  const [msg, setMsg] = useState("");
  const funcoes = [...dados.funcoes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const aplicarMetas = async (f) => {
    const pessoas = equipe.filter((m) => m.funcaoId === f.id);
    if (!pessoas.length) { setMsg("Ninguém ligado a esta função ainda (Equipe e metas)."); return; }
    if (!window.confirm(`Aplicar as metas padrão de “${f.nome}” a ${pessoas.length} pessoa(s)? As metas atuais delas serão trocadas.`)) return;
    for (const m of pessoas) await gravar("equipe", { ...m, metas: { ...f.metasPadrao } });
    setMsg(`Metas aplicadas a ${pessoas.map((m) => m.nome).join(", ")}.`);
  };

  return (
    <>
      <Cabecalho sobre="Funções e cargos" titulo="Estratégia por função" sub="Cole a descrição do cargo e transforme em metas, critérios de avaliação, rotina, competências e treinamentos.">
        <button type="button" className="btn" onClick={() => setEditando({ nome: "", metasPadrao: {}, trilhas: [] })}>Nova função</button>
      </Cabecalho>
      <Orientacao tela="funcoes" />
      {msg && <div className="aviso marca">{msg}</div>}

      {funcoes.length === 0 && (
        <Card>
          <h2>Comece por um modelo</h2>
          <p className="suave peq">Montados a partir da planilha de avaliação. Ajuste com a descrição de cargo de vocês.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MODELOS.map((m) => <button key={m.nome} type="button" className="btn claro" onClick={() => setEditando({ ...m, metasPadrao: {}, criteriosTexto: m.criterios })}>{m.nome}</button>)}
          </div>
        </Card>
      )}

      <div className="grade" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        {funcoes.map((f) => {
          const pessoas = equipe.filter((m) => m.funcaoId === f.id);
          const mp = f.metasPadrao || {};
          return (
            <Card key={f.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <h2>{f.nome}</h2>
                <Chip tom={pessoas.length ? "marca" : "neutro"}>{pessoas.length} pessoa(s)</Chip>
              </div>
              {f.missao && <div className="peq"><b>Missão:</b> {f.missao}</div>}
              {f.estrategia && <div className="aviso marca peq">{f.estrategia}</div>}
              <div className="peq suave">Metas padrão: {mp.propostas ? `${mp.propostas} propostas` : "—"} · {mp.aprovacao ? `${mp.aprovacao}% aprovação` : "—"} · {mp.ligacoes ? `${mp.ligacoes} ligações/dia` : "—"}</div>
              {linhas(f.outrasMetas).length > 0 && <div className="peq"><b>Outras metas:</b> {linhas(f.outrasMetas).join(" · ")}</div>}
              <div className="peq"><b>Critérios técnicos:</b> {(f.criterios || []).map((c) => c.nome).join(", ") || "padrão"}</div>
              {linhas(f.rotina).length > 0 && (
                <div className="peq"><b>Rotina:</b><ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{linhas(f.rotina).map((r) => <li key={r}>{r}</li>)}</ul></div>
              )}
              {(f.trilhas || []).length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{f.trilhas.map((t) => <Chip key={t}>{trilhaPorId(t)?.nome || t}</Chip>)}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
                <button type="button" className="btn claro mini" onClick={() => setEditando(paraForm(f))}>Editar</button>
                <button type="button" className="btn claro mini" onClick={() => aplicarMetas(f)}>Aplicar metas às pessoas</button>
                <button type="button" className="btn perigo mini" onClick={() => window.confirm(pessoas.length ? `${pessoas.length} pessoa(s) estão nesta função e voltarão aos critérios padrão. Apagar?` : "Apagar esta função?") && remover("funcoes", f.id)}>Apagar</button>
              </div>
            </Card>
          );
        })}
      </div>
      {funcoes.length > 0 && (
        <div className="suave peq">Modelos disponíveis: {MODELOS.map((m) => <button key={m.nome} type="button" className="btn claro mini" style={{ marginLeft: 6 }} onClick={() => setEditando({ ...m, metasPadrao: {}, criteriosTexto: m.criterios })}>{m.nome}</button>)}</div>
      )}
      {editando && <Editor inicial={editando} aoFechar={() => setEditando(null)} />}
    </>
  );
}

function Editor({ inicial, aoFechar }) {
  const { gravar } = useBase();
  const [f, setF] = useState({ criteriosTexto: "", ...inicial });
  const [erro, setErro] = useState("");
  const campo = (k) => ({ value: f[k] || "", onChange: (e) => setF((x) => ({ ...x, [k]: e.target.value })) });
  const meta = (k) => ({ value: f.metasPadrao?.[k] ?? "", onChange: (e) => setF((x) => ({ ...x, metasPadrao: { ...x.metasPadrao, [k]: e.target.value } })) });
  const alternar = (id) => setF((x) => ({ ...x, trilhas: x.trilhas?.includes(id) ? x.trilhas.filter((t) => t !== id) : [...(x.trilhas || []), id] }));
  const salvar = async () => {
    if (!f.nome?.trim()) { setErro("Dê um nome à função."); return; }
    try { await gravar("funcoes", paraRegistro(f)); aoFechar(); } catch (e) { setErro(e.message); }
  };
  const area = (id, rot, k, rows = 3, dica) => (
    <div className="campo"><label htmlFor={id}>{rot}</label>{dica && <span className="suave peq">{dica}</span>}<textarea id={id} className="entrada" rows={rows} {...campo(k)} /></div>
  );
  return (
    <Modal titulo={inicial.id ? `Editar ${inicial.nome}` : "Nova função"} aoFechar={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="campo"><label htmlFor="f-nome">Nome da função</label><input id="f-nome" className="entrada" {...campo("nome")} /></div>
        {area("f-desc", "Descrição do cargo", "descricao", 5, "Cole aqui a descrição oficial do cargo. Ela fica guardada como referência.")}
        {area("f-missao", "Missão (uma frase)", "missao", 2)}
        {area("f-resp", "Responsabilidades", "responsabilidades", 4, "Uma por linha.")}
        <div className="rotulo">Metas padrão da função</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="campo"><label htmlFor="f-m1">Propostas/mês</label><input id="f-m1" className="entrada num" type="number" min="0" {...meta("propostas")} /></div>
          <div className="campo"><label htmlFor="f-m2">Aprovação mín. (%)</label><input id="f-m2" className="entrada num" type="number" min="0" max="100" {...meta("aprovacao")} /></div>
          <div className="campo"><label htmlFor="f-m3">Ligações/dia</label><input id="f-m3" className="entrada num" type="number" min="0" {...meta("ligacoes")} /></div>
        </div>
        {area("f-outras", "Outras metas de atividade", "outrasMetas", 3, "Uma por linha (ex.: checklist semanal cumprido).")}
        {area("f-crit", "Critérios técnicos da avaliação", "criteriosTexto", 4, "Um por linha, no formato “Nome — descrição”. Substituem os quatro critérios padrão para quem tem esta função.")}
        {area("f-comp", "Competências a desenvolver (PDI)", "competencias", 3, "Uma por linha.")}
        {area("f-rot", "Rotina semanal", "rotina", 3, "Uma por linha.")}
        {area("f-est", "Estratégia da função", "estrategia", 3, "Como esta função ganha o jogo: foco do trimestre e o que não fazer.")}
        <div className="rotulo">Treinamentos recomendados</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TRILHAS.map((t) => (
            <button key={t.id} type="button" className={`pilula${f.trilhas?.includes(t.id) ? " ativa" : ""}`} aria-pressed={!!f.trilhas?.includes(t.id)} onClick={() => alternar(t.id)}>{t.nome}</button>
          ))}
        </div>
        {erro && <div className="aviso ruim">{erro}</div>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn claro" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="btn" onClick={salvar}>Salvar</button>
        </div>
      </div>
    </Modal>
  );
}
