// O estado do Comercial num lugar só: dados próprios (ml-sync), números do
// CRM (ml-comercial), colaboradores do RH e o mês escolhido. As telas leem
// daqui e gravam por aqui; depois de gravar, a lista local é atualizada com o
// registro que o SERVIDOR devolveu.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { carregarTudo, salvar, apagar, elencoRH } from "../services/dados.js";
import { resumoCRM } from "../services/crm.js";
import { mesAtual } from "../lib/format.js";
import { configCompleta } from "../lib/calculos.js";

const Ctx = createContext(null);

const VAZIO = { equipe: [], config: [], ocorrencias: [], avaliacoes: [], feedbacks: [], estrategias: [] };

export function BaseProvider({ children }) {
  const [dados, setDados] = useState(VAZIO);
  const [resumo, setResumo] = useState(null);
  const [elenco, setElenco] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [erroCRM, setErroCRM] = useState("");
  const [mes, setMes] = useState(mesAtual());

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    const [d, r, e] = await Promise.allSettled([carregarTudo(), resumoCRM(13), elencoRH()]);
    if (d.status === "fulfilled") setDados({ ...VAZIO, ...d.value });
    else setErro(d.reason?.message || "Não consegui carregar os dados do Comercial.");
    if (r.status === "fulfilled") { setResumo(r.value); setErroCRM(""); }
    else setErroCRM(r.reason?.status === 404
      ? "A função que lê o CRM (ml-comercial) ainda não foi publicada no Supabase. Os números do CRM aparecem assim que ela for ligada."
      : r.reason?.message || "Não consegui ler o CRM agora.");
    if (e.status === "fulfilled") setElenco(e.value);
    setCarregando(false);
  }, []);

  useEffect(() => { recarregar(); }, [recarregar]);

  const gravar = useCallback(async (chave, registro) => {
    const salvo = await salvar(chave, registro);
    setDados((d) => ({ ...d, [chave]: [...d[chave].filter((x) => x.id !== salvo.id), salvo] }));
    return salvo;
  }, []);

  const remover = useCallback(async (chave, id) => {
    await apagar(chave, id);
    setDados((d) => ({ ...d, [chave]: d[chave].filter((x) => x.id !== id) }));
  }, []);

  const valor = useMemo(() => {
    const equipe = [...dados.equipe].filter((m) => m.ativo !== false).sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    const config = configCompleta(dados.config.find((c) => c.id === "geral"));
    const ocorrenciasDe = (pessoaId, m = mes) => dados.ocorrencias.filter((o) => o.mes === m && o.pessoaId === pessoaId);
    return { dados, equipe, config, resumo, elenco, carregando, erro, erroCRM, mes, setMes, recarregar, gravar, remover, ocorrenciasDe };
  }, [dados, resumo, elenco, carregando, erro, erroCRM, mes, recarregar, gravar, remover]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useBase = () => useContext(Ctx);
