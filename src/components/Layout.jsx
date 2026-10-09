import { useState } from "react";
import { navegar } from "../lib/rota.js";
import { sair, getSessao } from "../lib/sessao.js";
import { useBase } from "../hooks/base.jsx";
import { mesAtual, mesCurto } from "../lib/format.js";
import {
  IcGrafico, IcLupa, IcBussola, IcFunil, IcPessoas, IcMedalha, IcAviso, IcAlvo, IcEngrenagem,
  IcCarteira, IcEstrela, IcMartelo, IcApresentacao, IcLivro, IcMenu, IcBalanca, IcPasta, IcTrofeu,
} from "./icones.jsx";

// O menu do sistema inteiro, nos cinco blocos da especificação.
export const MENU = [
  { grupo: "Resultado", itens: [
    { id: "cockpit", nome: "Cockpit do dia", Ic: IcBussola },
    { id: "visao", nome: "Visão do mês", Ic: IcGrafico },
    { id: "funil", nome: "Funil", Ic: IcFunil },
    { id: "dado", nome: "Qualidade do dado", Ic: IcLupa },
  ] },
  { grupo: "Pessoas", itens: [
    { id: "pessoas", nome: "Pessoas e feedback", Ic: IcPessoas },
    { id: "avaliacao", nome: "Avaliação e bônus", Ic: IcMedalha },
    { id: "destaque", nome: "Destaque do mês", Ic: IcTrofeu },
    { id: "ocorrencias", nome: "Ocorrências", Ic: IcAviso },
  ] },
  { grupo: "Clientes", itens: [
    { id: "carteira", nome: "Carteira", Ic: IcCarteira },
    { id: "satisfacao", nome: "Satisfação", Ic: IcEstrela },
    { id: "licitacoes", nome: "Licitações", Ic: IcMartelo },
  ] },
  { grupo: "Gestão", itens: [
    { id: "estrategias", nome: "Estratégias e objetivos", Ic: IcAlvo },
    { id: "decisoes", nome: "Decisões", Ic: IcBalanca },
    { id: "funcoes", nome: "Funções e cargos", Ic: IcPasta },
    { id: "equipe", nome: "Equipe e metas", Ic: IcEngrenagem },
  ] },
  { grupo: "Desenvolvimento", itens: [
    { id: "reunioes", nome: "Reuniões e apresentações", Ic: IcApresentacao },
    { id: "treinamentos", nome: "Treinamentos", Ic: IcLivro },
  ] },
];

// Mês a mês, ano a ano: o mês atual sai da data de hoje, então novembro,
// dezembro e os anos seguintes aparecem sozinhos. Meses futuros ficam apagados.
export function SeletorMes() {
  const { mes, setMes } = useBase();
  const atual = mesAtual();
  const ano = Number(mes.slice(0, 4));
  const anoAtual = Number(atual.slice(0, 4));
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
  const irAno = (a) => {
    const alvo = `${a}-${mes.slice(5)}`;
    setMes(alvo > atual ? atual : alvo);
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <div className="pilulas" role="group" aria-label="Ano">
        <button type="button" className="pilula" aria-label="Ano anterior" onClick={() => irAno(ano - 1)} disabled={ano <= 2024}>‹</button>
        <span className="pilula ativa" style={{ cursor: "default" }}>{ano}</span>
        <button type="button" className="pilula" aria-label="Próximo ano" onClick={() => irAno(ano + 1)} disabled={ano >= anoAtual}>›</button>
      </div>
      <div className="pilulas" role="group" aria-label="Mês">
        {meses.map((m) => (
          <button key={m} type="button" className={`pilula${m === mes ? " ativa" : ""}`} aria-pressed={m === mes} disabled={m > atual} onClick={() => setMes(m)}>
            {mesCurto(m)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Layout({ tela, children }) {
  const [aberto, setAberto] = useState(false);
  const sessao = getSessao();
  const { erroCRM } = useBase();
  const ir = (id) => { setAberto(false); navegar(id); };

  return (
    <div className="casca">
      <div className="topo-movel">
        <button type="button" aria-label="Abrir menu" onClick={() => setAberto(true)}><IcMenu size={22} /></button>
        <b style={{ fontFamily: "Poppins" }}>Comercial</b>
      </div>
      {aberto && <div className="modal-fundo" style={{ zIndex: 25, background: "rgba(0,0,0,.3)" }} onClick={() => setAberto(false)} />}
      <nav className={`menu${aberto ? " aberto" : ""}`} aria-label="Comercial">
        <div className="logo">
          <span className="marca-icone"><IcGrafico size={20} /></span>
          <span><b>Comercial</b><span>MinasLab · Gestão do setor</span></span>
        </div>
        {MENU.map((g) => (
          <div key={g.grupo}>
            <div className="menu-grupo">{g.grupo}</div>
            {g.itens.map(({ id, nome, Ic, fase }) => (
              fase ? (
                <div key={id} className="menu-item" aria-disabled="true" title={`Chega na ${fase.toLowerCase()} do roteiro`}>
                  <Ic /> {nome} <span className="fase">{fase}</span>
                </div>
              ) : (
                <button key={id} type="button" className={`menu-item${tela === id ? " ativo" : ""}`} aria-current={tela === id ? "page" : undefined} onClick={() => ir(id)}>
                  <Ic /> {nome}
                </button>
              )
            ))}
          </div>
        ))}
        <div className="menu-rodape">
          <span>{sessao?.nome || sessao?.usuario}</span>
          <button type="button" onClick={() => sair()}>Sair</button>
        </div>
      </nav>
      <main className="conteudo">
        <div className="miolo">
          {erroCRM && <div className="aviso alerta">{erroCRM}</div>}
          {children}
        </div>
      </main>
    </div>
  );
}
