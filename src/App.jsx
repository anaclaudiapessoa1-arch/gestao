import { useEffect, useState } from "react";
import { aoMudarSessao, getSessao } from "./lib/sessao.js";
import { useRota } from "./lib/rota.js";
import { BaseProvider, useBase } from "./hooks/base.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import VisaoMes from "./pages/VisaoMes.jsx";
import QualidadeDado from "./pages/QualidadeDado.jsx";
import Pessoas from "./pages/Pessoas.jsx";
import Avaliacao from "./pages/Avaliacao.jsx";
import Ocorrencias from "./pages/Ocorrencias.jsx";
import Estrategias from "./pages/Estrategias.jsx";
import Equipe from "./pages/Equipe.jsx";

const TELAS = { visao: VisaoMes, dado: QualidadeDado, pessoas: Pessoas, avaliacao: Avaliacao, ocorrencias: Ocorrencias, estrategias: Estrategias, equipe: Equipe };

function Telas() {
  const { tela, param } = useRota();
  const { carregando, erro, recarregar } = useBase();
  const Tela = TELAS[tela] || VisaoMes;
  return (
    <Layout tela={TELAS[tela] ? tela : "visao"}>
      {erro ? (
        <div className="aviso ruim">
          {erro} <button type="button" className="btn mini claro" style={{ marginLeft: 8 }} onClick={recarregar}>Tentar de novo</button>
        </div>
      ) : carregando ? (
        <div className="carregando">Carregando os dados do Comercial…</div>
      ) : (
        <Tela param={param} />
      )}
    </Layout>
  );
}

export default function App() {
  const [sessao, setSessao] = useState(() => getSessao());
  useEffect(() => aoMudarSessao(() => setSessao(getSessao())), []);
  if (!sessao) return <Login />;
  return (
    <BaseProvider key={sessao.usuario}>
      <Telas />
    </BaseProvider>
  );
}
