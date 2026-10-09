import { useState } from "react";
import { navegar } from "../lib/rota.js";
import { sair, getSessao } from "../lib/sessao.js";
import { useBase } from "../hooks/base.jsx";
import { mesesAte, mesAtual, mesCurto } from "../lib/format.js";
import {
  IcGrafico, IcLupa, IcBussola, IcFunil, IcPessoas, IcMedalha, IcAviso, IcAlvo, IcEngrenagem,
  IcCarteira, IcEstrela, IcMartelo, IcApresentacao, IcLivro, IcMenu,
} from "./icones.jsx";

// O menu mostra o sistema inteiro: o que já funciona e, apagado, o que vem
// nas próximas fases do roteiro (especificação, seção Roteiro).
export const MENU = [
  { grupo: "Resultado", itens: [
    { id: "visao", nome: "Visão do mês", Ic: IcGrafico },
    { id: "dado", nome: "Qualidade do dado", Ic: IcLupa },
    { id: "cockpit", nome: "Cockpit do dia", Ic: IcBussola, fase: "Fase 2" },
    { id: "funil", nome: "Funil", Ic: IcFunil, fase: "Fase 2" },
  ] },
  { grupo: "Pessoas", itens: [
    { id: "pessoas", nome: "Pessoas e feedback", Ic: IcPessoas },
    { id: "avaliacao", nome: "Avaliação e bônus", Ic: IcMedalha },
    { id: "ocorrencias", nome: "Ocorrências", Ic: IcAviso },
  ] },
  { grupo: "Gestão", itens: [
    { id: "estrategias", nome: "Estratégias", Ic: IcAlvo },
    { id: "equipe", nome: "Equipe e metas", Ic: IcEngrenagem },
  ] },
  { grupo: "Clientes", itens: [
    { id: "carteira", nome: "Carteira", Ic: IcCarteira, fase: "Fase 3" },
    { id: "satisfacao", nome: "Satisfação", Ic: IcEstrela, fase: "Fase 3" },
    { id: "licitacoes", nome: "Licitações", Ic: IcMartelo, fase: "Fase 3" },
  ] },
  { grupo: "Desenvolvimento", itens: [
    { id: "reunioes", nome: "Reuniões prontas", Ic: IcApresentacao, fase: "Fase 2" },
    { id: "treinamentos", nome: "Treinamentos", Ic: IcLivro, fase: "Em breve" },
  ] },
];

export function SeletorMes({ quantos = 9 }) {
  const { mes, setMes } = useBase();
  const meses = mesesAte(mesAtual(), quantos);
  return (
    <div className="pilulas" role="group" aria-label="Mês">
      {meses.map((m) => (
        <button key={m} type="button" className={`pilula${m === mes ? " ativa" : ""}`} aria-pressed={m === mes} onClick={() => setMes(m)}>
          {mesCurto(m)}{m.slice(0, 4) !== mesAtual().slice(0, 4) ? ` ${m.slice(2, 4)}` : ""}
        </button>
      ))}
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
        <div className="marca">
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
