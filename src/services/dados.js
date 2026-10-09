// Dados próprios do Comercial, guardados pela porta do painel (ml-sync) nas
// coleções rh_comercial_*. O prefixo rh_ faz o servidor restringir tudo à
// direção — leitura e escrita — sem nenhuma mudança no backend.
//
// Regras herdadas do ml-sync: exclusão é lápide (nunca DELETE), e toda
// gravação devolve o registro como ficou (conferimos o efeito, não a falta
// de erro).

import { SYNC } from "../lib/api.js";
import { comCracha } from "../lib/sessao.js";
import { novoId } from "../lib/format.js";

export const COLECOES = {
  equipe: "rh_comercial_equipe",
  config: "rh_comercial_config",
  ocorrencias: "rh_comercial_ocorrencias",
  avaliacoes: "rh_comercial_avaliacoes",
  feedbacks: "rh_comercial_feedbacks",
  estrategias: "rh_comercial_estrategias",
  funcoes: "rh_comercial_funcoes",
  pdi: "rh_comercial_pdi",
  treinamentos: "rh_comercial_treinamentos",
  reunioes: "rh_comercial_reunioes",
  decisoes: "rh_comercial_decisoes",
  objetivos: "rh_comercial_objetivos",
  acoes: "rh_comercial_acoes",
  nps: "rh_comercial_nps",
  destaque: "rh_comercial_destaque",          // avaliação da liderança (Destaque do Mês)
  apresentacoes: "rh_comercial_apresentacoes", // apresentações editáveis (estúdio)
};

const chamar = (action, corpo = {}) => comCracha(SYNC, { action, ...corpo });

/** Lê todas as coleções do Comercial numa viagem só. */
export async function carregarTudo() {
  const nomes = Object.values(COLECOES);
  const r = await chamar("listarVarias", { colecoes: nomes });
  if (r.recusadas?.length) {
    throw new Error("O servidor recusou os dados do Comercial para esta conta. O acesso é só da direção.");
  }
  const out = {};
  for (const [chave, nome] of Object.entries(COLECOES)) out[chave] = r.colecoes?.[nome] ?? [];
  return out;
}

export async function salvar(chave, registro) {
  const colecao = COLECOES[chave];
  const reg = { ...registro };
  if (!reg.id) reg.id = novoId(chave.slice(0, 3));
  if (!reg.criadoEm) reg.criadoEm = new Date().toISOString();
  const r = await chamar("upsert", { colecao, registro: reg });
  if (!r?.registro?.id) throw new Error("O servidor não confirmou a gravação. Recarregue e confira.");
  return r.registro;
}

export async function apagar(chave, id) {
  const r = await chamar("delete", { colecao: COLECOES[chave], id });
  if (!r?.ok) throw new Error("O servidor não confirmou a exclusão.");
  return true;
}

/** Colaboradores ativos do RH: só id, nome e apelido (porta estreita do painel). */
export async function elencoRH() {
  const r = await chamar("elenco");
  return r?.pessoas ?? [];
}
