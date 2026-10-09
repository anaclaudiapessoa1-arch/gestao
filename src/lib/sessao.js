// Sessão do Comercial. O login é o mesmo do painel MinasLab (ml-sync, ação
// "entrar"): mesmas contas, mesmo crachá de 12h. Esconder telas aqui é
// conforto; quem tranca de verdade é o servidor, que confere o crachá e o
// papel em toda chamada.

import { SYNC } from "./api.js";

const K_TOKEN = "gc_token";
const K_SESSAO = "gc_sessao";
const K_MOTIVO = "gc_motivo";
const INATIVIDADE_MS = 12 * 60 * 60 * 1000;

export const SEM_REDE = "Não consegui falar com o servidor. Confira a internet e tente de novo.";

export function mensagemDoStatus(status) {
  if (status === 401) return "Sua sessão expirou. Entre de novo.";
  if (status === 403) return "Você não tem acesso a esta parte.";
  if (status === 404) return "Este serviço ainda não foi publicado no servidor.";
  if (status === 429) return "Muitas tentativas seguidas. Espere alguns minutos.";
  if (status >= 500) return "O servidor falhou agora. Tente de novo em instantes.";
  return "Não consegui concluir. Tente de novo.";
}

const ouvintes = new Set();
const avisar = () => ouvintes.forEach((fn) => fn());
export function aoMudarSessao(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function ler(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function gravar(k, v) {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ }
}

export const getToken = () => ler(K_TOKEN);

export function getSessao() {
  try {
    const s = JSON.parse(ler(K_SESSAO) || "null");
    if (!s?.usuario) return null;
    if (Date.now() - (s.visto || 0) > INATIVIDADE_MS) {
      sair("Você ficou muito tempo sem usar. Entre de novo.");
      return null;
    }
    gravar(K_SESSAO, JSON.stringify({ ...s, visto: Date.now() }));
    return s;
  } catch {
    return null;
  }
}

export function sair(motivo = "") {
  gravar(K_TOKEN, null);
  gravar(K_SESSAO, null);
  gravar(K_MOTIVO, motivo || null);
  avisar();
}

export function motivoSaida() {
  const m = ler(K_MOTIVO);
  if (m) gravar(K_MOTIVO, null);
  return m || "";
}

export async function login(usuario, senha) {
  let resp;
  try {
    resp = await fetch(SYNC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "entrar", usuario, senha }),
    });
  } catch {
    throw new Error(SEM_REDE);
  }
  const corpo = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(corpo?.erro || mensagemDoStatus(resp.status));
  // O Comercial é da gestão: a porta do servidor já recusa os dados a quem
  // não é direção; aqui só evitamos abrir uma casca vazia.
  if (corpo.papel !== "direcao") {
    throw new Error("O Comercial é restrito à direção. Peça acesso na tela de Acessos do painel.");
  }
  gravar(K_TOKEN, corpo.token);
  gravar(K_SESSAO, JSON.stringify({ usuario: corpo.usuario, nome: corpo.nome, papel: corpo.papel, visto: Date.now() }));
  avisar();
  return corpo;
}

// Toda chamada com crachá passa por aqui: crachá vencido derruba a sessão
// com o motivo dito, em vez de a tela virar login sem explicação.
export async function comCracha(url, corpo) {
  const token = getToken();
  let resp;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error(SEM_REDE);
  }
  const dados = await resp.json().catch(() => null);
  if (resp.status === 401 && dados?.semSessao) {
    sair("Sua sessão expirou (o crachá vale 12 horas). Entre de novo.");
    throw new Error("Sua sessão expirou. Entre de novo.");
  }
  if (!resp.ok) {
    const erro = new Error(dados?.erro || mensagemDoStatus(resp.status));
    erro.status = resp.status;
    throw erro;
  }
  return dados;
}
