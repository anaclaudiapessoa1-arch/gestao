// ============================================================================
// ml-comercial — a porta de dados do Comercial MinasLab (repositório gestao).
//
// SÓ LEITURA do CRM. As únicas escritas são as do Destaque do Mês em
// ml_registros: a votação da equipe (rh_comercial_pesquisas) e a avaliação da
// liderança por link (rh_comercial_convites → rh_comercial_destaque).
// Devolve números já somados (propostas por mês e por
// responsável) e a lista de propostas sem responsável. Nunca escreve no CRM,
// nunca devolve dado pessoal de cliente além do nome da empresa.
//
// AUTORIZAÇÃO: o mesmo crachá do painel MinasLab (JWT HS256 assinado pelo
// ml-sync com ML_JWT_SECRET). Conferências, em toda chamada:
//   1) assinatura  2) validade  3) sis === "minaslab"  4) papel === "direcao"
//   5) a conta segue ativa em ml_contas
// verify_jwt = false de propósito (o preflight CORS chega sem token); a
// autorização é feita aqui dentro. Deploy com --no-verify-jwt.
//
// PROJETO COMPARTILHADO ("Projetos Léo"): o nome leva o prefixo ml_ como o
// resto da MinasLab. Esta função não cria tabela nenhuma.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { agregarPropostas, mesBR, probabilidadesPorIdade, chanceDaIdade, carteiraClientes } from "./agregar.mjs";
import { CRITERIOS_LIDERANCA, MOTIVOS_ELIMINATORIOS, DIAS_CONVITE, conviteValido, validarAvaliacao } from "./lideranca.mjs";
import { PERGUNTAS_EQUIPE, PERGUNTAS_GESTAO, validarVoto, aplicarVoto, resultado, gerarCodigos, normalizarCodigo, codigoValido } from "./pesquisa.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("ML_JWT_SECRET") ?? "";
const SIS = "minaslab";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resp = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ------------------------------------------------- crachá (mesmo do ml-sync)
const enc = new TextEncoder();
const dec = new TextDecoder();
function bytesFromB64url(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function verificarJwt(token: string): Promise<Record<string, unknown> | null> {
  const partes = String(token || "").split(".");
  if (partes.length !== 3 || !JWT_SECRET) return null;
  try {
    const chave = await crypto.subtle.importKey("raw", enc.encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("HMAC", chave, bytesFromB64url(partes[2]), enc.encode(`${partes[0]}.${partes[1]}`));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(bytesFromB64url(partes[1])));
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const CACHE_ATIVA = new Map<string, { ate: number; ativa: boolean }>();
async function contaSegueAtiva(usuario: string): Promise<boolean> {
  const agora = Date.now();
  const c = CACHE_ATIVA.get(usuario);
  if (c && c.ate > agora) return c.ativa;
  try {
    const { data, error } = await sb.from("ml_contas").select("ativo").eq("usuario", usuario).maybeSingle();
    if (error) throw error;
    const ativa = data ? data.ativo === true : true; // conta-mestra de bootstrap não existe no banco
    CACHE_ATIVA.set(usuario, { ate: agora + 60_000, ativa });
    return ativa;
  } catch {
    return true; // banco fora não tranca a casa; o crachá continua conferido
  }
}

// ------------------------------------------------- leituras
const CAMPOS_AGREGADO = "responsavel_comercial_id,status,valor,data_envio,data_aceite,created_at,ativo,deleted_at";

async function lerTudo(tabela: string, campos: string, filtro?: (q: any) => any) {
  const linhas: any[] = [];
  for (let de = 0; ; de += 1000) {
    let q = sb.from(tabela).select(campos).order("id", { ascending: true }).range(de, de + 999);
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw error;
    linhas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

async function nomesClientes(ids: unknown[]) {
  const unicos = [...new Set(ids.filter(Boolean) as string[])];
  const nomes: Record<string, string> = {};
  for (let i = 0; i < unicos.length; i += 200) {
    const { data, error } = await sb.from("clientes").select("id,razao_social,nome_fantasia").in("id", unicos.slice(i, i + 200));
    if (error) throw error;
    for (const c of data ?? []) nomes[c.id] = String(c.nome_fantasia || c.razao_social || "").replace(/\s+/g, " ").trim();
  }
  return nomes;
}

function mesAtualBR() {
  return mesBR(new Date().toISOString())!;
}
function somarMeses(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}


// ------------------------------------------------- votação do Destaque do Mês
// Duas ações PÚBLICAS (sem crachá): votoAbrir e votoEnviar. Só funcionam com
// o id de uma votação ABERTA e um código de uso único ainda não usado. O voto
// é somado nos totais (pesquisa.mjs) e nada que identifique quem votou é
// gravado. As demais ações (criar, listar, encerrar) exigem o crachá da direção.
const COL_PESQ = "rh_comercial_pesquisas";
const T_REG = "ml_registros";

async function hmacCodigo(pesquisa: string, codigo: string) {
  const chave = await crypto.subtle.importKey("raw", enc.encode(`pesquisa:${JWT_SECRET}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", chave, enc.encode(`${pesquisa}:${codigo}`)));
  return btoa(String.fromCharCode(...sig)).replace(/=+$/, "").slice(0, 32);
}

function bytesAleatorios(n: number) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}
function codigosNovos(n: number) {
  let pool = bytesAleatorios(n * 12 + 64);
  let base = 0;
  return gerarCodigos(n, (i: number) => {
    if (i - base >= pool.length) { base = i; pool = bytesAleatorios(256); }
    return pool[i - base];
  });
}
function embaralhar<T>(xs: T[]) {
  const a = [...xs];
  const r = bytesAleatorios(a.length * 4);
  for (let i = a.length - 1; i > 0; i--) {
    const j = new DataView(r.buffer).getUint32((i % a.length) * 4) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// COFRE: somas, marcas de "já votou" e códigos válidos ficam criptografados
// (AES-GCM, chave derivada do segredo do servidor). Assim nem quem lê o banco
// ou a coleção pelo painel vê as notas parciais durante a votação; o
// resultado só sai por esta função, depois de encerrar.
let chaveCofre: CryptoKey | null = null;
async function cofreChave() {
  if (!chaveCofre) {
    const h = await crypto.subtle.digest("SHA-256", enc.encode(`cofre:${JWT_SECRET}`));
    chaveCofre = await crypto.subtle.importKey("raw", h, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  return chaveCofre;
}
const paraB64 = (u8: Uint8Array) => { let t = ""; for (let i = 0; i < u8.length; i += 8192) t += String.fromCharCode(...u8.subarray(i, i + 8192)); return btoa(t); };
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function fecharCofre(seg: unknown) {
  const iv = bytesAleatorios(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cofreChave(), enc.encode(JSON.stringify(seg))));
  return `${paraB64(iv)}.${paraB64(ct)}`;
}
async function abrirCofre(reg: any) {
  if (!reg?.cofre) return { somas: reg?.somas || {}, usados: reg?.usados || {}, validos: reg?.validos || [] };
  const [iv, ct] = String(reg.cofre).split(".");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(iv) }, await cofreChave(), deB64(ct));
  return JSON.parse(dec.decode(pt));
}
/** Registro em memória (com somas/usados/validos) → registro gravado (com cofre). */
async function selar(reg: any) {
  const { somas, usados, validos, ...resto } = reg;
  return { ...resto, cofre: await fecharCofre({ somas: somas || {}, usados: usados || {}, validos: validos || [] }) };
}
async function abrirRegistro(gravado: any) {
  const { cofre, ...resto } = gravado || {};
  return { ...resto, ...(await abrirCofre(gravado)) };
}

async function lerPesquisa(id: string) {
  const { data, error } = await sb.from(T_REG).select("registro,atualizado_em,apagado").eq("colecao", COL_PESQ).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || data.apagado) return null;
  return { reg: await abrirRegistro(data.registro), versao: data.atualizado_em as string };
}

/** Grava só se ninguém gravou no meio (versão = atualizado_em lido). */
async function gravarPesquisa(id: string, regAberto: any, versao: string | null) {
  const agora = new Date().toISOString();
  const reg = await selar(regAberto);
  if (versao === null) {
    const { error } = await sb.from(T_REG).insert({ colecao: COL_PESQ, id, registro: reg, apagado: false, atualizado_em: agora });
    if (error) throw error;
    return true;
  }
  const { data, error } = await sb.from(T_REG).update({ registro: reg, atualizado_em: agora }).eq("colecao", COL_PESQ).eq("id", id).eq("atualizado_em", versao).select("id");
  if (error) throw error;
  return (data ?? []).length === 1;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Dois modos:
//  - "codigo": cada voto usa um código de uso único (sorteado em tirinhas);
//  - "aberto": link sem código; a pessoa diz quem é (só para travar o voto
//    repetido e tirar o próprio nome). O servidor guarda apenas um HMAC de
//    "esta pessoa já votou", separado das somas: dá para saber QUE votou,
//    nunca O QUE votou.
async function votar(action: string, body: Record<string, unknown>) {
  const id = String(body.pesquisa ?? "").slice(0, 40);
  if (!/^p[a-z0-9]{6,30}$/.test(id)) { await espera(400); return resp({ erro: "Link de votação inválido." }, 400); }

  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const lida = await lerPesquisa(id);
    if (!lida || lida.reg.status !== "aberta") return resp({ erro: "Esta votação não está aberta." }, 404);
    const { reg, versao } = lida;
    const aberto = reg.modo === "aberto";
    const votantes = [...(reg.avaliados || []), ...(reg.lideres || [])];
    let h = "";
    let eu = "";
    if (!aberto) {
      const codigo = normalizarCodigo(body.codigo);
      if (!codigoValido(codigo)) { await espera(400); return resp({ erro: "Esta votação pede o código de 8 letras e números.", precisaCodigo: true }, 400); }
      h = await hmacCodigo(id, codigo);
      if (!(reg.validos || []).includes(h)) { await espera(400); return resp({ erro: "Código não encontrado. Confira as letras e os números.", precisaCodigo: true }, 403); }
    }

    // Abrir não diz se o código ou a pessoa já votou: a resposta é igual para
    // todos, para ninguém usar o link para descobrir quem já votou.
    if (action === "votoAbrir") {
      const unicos = new Map(votantes.map((p: any) => [p.id, { id: p.id, nome: p.nome }]));
      return resp({
        titulo: reg.titulo, mes: reg.mes, modo: aberto ? "aberto" : "codigo", minimo: reg.minimo || 3,
        avaliados: (reg.avaliados || []).map((p: any) => ({ id: p.id, nome: p.nome })),
        lideres: (reg.lideres || []).map((p: any) => ({ id: p.id, nome: p.nome })),
        votantes: [...unicos.values()],
        perguntasEquipe: PERGUNTAS_EQUIPE, perguntasGestao: PERGUNTAS_GESTAO,
      });
    }

    if (aberto) {
      eu = String(body.eu ?? "");
      if (!votantes.some((p: any) => p.id === eu)) return resp({ erro: "Escolha o seu nome na lista." }, 400);
      h = await hmacCodigo(id, `pessoa:${eu}`);
    }
    // A cédula é conferida ANTES de dizer se já votou: quem só quer sondar
    // (cédula vazia) recebe sempre o mesmo erro.
    const v = validarVoto(reg, body.voto, eu);
    if (v.erro) return resp({ erro: v.erro }, 400);
    if (reg.usados?.[h]) return resp({ erro: aberto ? "Você já votou nesta votação. Se não foi você, fale com a gestão." : "Este código já foi usado. Cada código vale um voto." }, 409);

    const novo = {
      ...reg,
      somas: aplicarVoto(reg.somas, v.limpo, () => bytesAleatorios(1)[0] / 256),
      usados: { ...(reg.usados || {}), [h]: 1 },
      totalVotos: (reg.totalVotos || 0) + 1,
    };
    if (await gravarPesquisa(id, novo, versao)) return resp({ ok: true });
    await espera(80 + Math.floor(bytesAleatorios(1)[0] * 2)); // alguém votou no mesmo instante: lê de novo
  }
  return resp({ erro: "Muita gente votando agora. Tente enviar de novo." }, 503);
}

function semSegredos(reg: any) {
  return {
    id: reg.id, titulo: reg.titulo, mes: reg.mes, status: reg.status, minimo: reg.minimo, modo: reg.modo === "aberto" ? "aberto" : "codigo",
    criadaEm: reg.criadaEm, encerradaEm: reg.encerradaEm || "", criadaPor: reg.criadaPor || "",
    avaliados: reg.avaliados || [], lideres: reg.lideres || [],
    codigos: reg.codigos || [], totalVotos: reg.totalVotos || 0,
    resultado: reg.status === "encerrada" ? resultado(reg) : null,
  };
}

function listaPessoas(x: unknown, max: number) {
  if (!Array.isArray(x)) return [];
  const vistos = new Set<string>();
  return x.slice(0, max).map((p: any) => ({ id: String(p?.id ?? "").slice(0, 60), nome: String(p?.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 80) }))
    .filter((p) => p.id && p.nome && !vistos.has(p.id) && vistos.add(p.id));
}

async function pesquisaDirecao(action: string, body: Record<string, unknown>, usuario: string) {
  switch (action) {
    case "pesquisaListar": {
      const { data, error } = await sb.from(T_REG).select("registro").eq("colecao", COL_PESQ).eq("apagado", false);
      if (error) throw error;
      const itens = (await Promise.all((data ?? []).map(async (d: any) => semSegredos(d.registro?.status === "encerrada" ? await abrirRegistro(d.registro) : d.registro)))).sort((a, b) => String(b.criadaEm).localeCompare(String(a.criadaEm)));
      return resp({ itens });
    }
    case "pesquisaCriar": {
      const titulo = String(body.titulo ?? "").trim().slice(0, 120);
      const mes = String(body.mes ?? "");
      const avaliados = listaPessoas(body.avaliados, 80);
      const lideres = listaPessoas(body.lideres, 6);
      const modo = body.modo === "aberto" ? "aberto" : "codigo";
      const n = modo === "aberto" ? 0 : Math.min(Math.max(Number(body.codigos ?? 0) | 0, 1), 200);
      const minimo = Math.min(Math.max(Number(body.minimo ?? 3) | 0, 2), 10);
      if (!titulo || !/^\d{4}-\d{2}$/.test(mes)) return resp({ erro: "Informe o título e o mês." }, 400);
      if (!avaliados.length && !lideres.length) return resp({ erro: "Escolha quem será avaliado." }, 400);
      const id = "p" + [...bytesAleatorios(12)].map((b) => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
      const codigos = n ? codigosNovos(n) : [];
      const validos = embaralhar(await Promise.all(codigos.map((c) => hmacCodigo(id, c))));
      const reg = { id, titulo, mes, modo, status: "aberta", minimo, avaliados, lideres, codigos, validos, usados: {}, totalVotos: 0, somas: {}, criadaEm: new Date().toISOString(), criadaPor: usuario };
      await gravarPesquisa(id, reg, null);
      return resp({ pesquisa: semSegredos(reg) });
    }
    case "pesquisaCodigos":
    case "pesquisaStatus": {
      const id = String(body.id ?? "");
      for (let t = 0; t < 5; t++) {
        const lida = await lerPesquisa(id);
        if (!lida) return resp({ erro: "Votação não encontrada." }, 404);
        let reg = lida.reg;
        if (action === "pesquisaCodigos") {
          if (reg.status !== "aberta" || reg.modo === "aberto") return resp({ erro: "Só dá para gerar códigos em votação aberta com código." }, 400);
          const n = Math.min(Math.max(Number(body.n ?? 0) | 0, 1), 100);
          const novos = codigosNovos(n).filter((c) => !(reg.codigos || []).includes(c));
          const hs = await Promise.all(novos.map((c) => hmacCodigo(id, c)));
          reg = { ...reg, codigos: [...(reg.codigos || []), ...novos], validos: embaralhar([...(reg.validos || []), ...hs]) };
        } else {
          // Encerrar é definitivo: reabrir permitiria comparar o resultado antes
          // e depois de um único voto e descobrir o que aquela pessoa votou.
          if (body.status === "aberta") return resp({ erro: "Votação encerrada não pode ser reaberta (protege o anonimato). Crie uma nova." }, 400);
          if (reg.status === "encerrada") return resp({ pesquisa: semSegredos(reg) });
          reg = { ...reg, status: "encerrada", encerradaEm: new Date().toISOString() };
        }
        if (await gravarPesquisa(id, reg, lida.versao)) return resp({ pesquisa: semSegredos(reg) });
        await espera(100);
      }
      return resp({ erro: "Não consegui gravar agora. Tente de novo." }, 503);
    }
    case "pesquisaApagar": {
      const id = String(body.id ?? "");
      const { error } = await sb.from(T_REG).update({ apagado: true, atualizado_em: new Date().toISOString() }).eq("colecao", COL_PESQ).eq("id", id);
      if (error) throw error;
      return resp({ ok: true });
    }
  }
  return null;
}

// ------------------------------------------------------------------ liderança por link
// Convite = link para UMA pessoa da liderança avaliar UM mês, sem login no
// Comercial. O segredo do link fica só no cofre (criptografado); quem abre vê
// os nomes da lista e as PRÓPRIAS notas, nunca as de outra pessoa. Vence em
// DIAS_CONVITE dias e a direção pode revogar.
const COL_CONV = "rh_comercial_convites";
const COL_DEST = "rh_comercial_destaque";
const ALFA = "abcdefghijkmnpqrstuvwxyz23456789";
const sorteio = (n: number) => [...bytesAleatorios(n)].map((b) => ALFA[b % 32]).join("");

async function lerConviteDoLink(param: unknown) {
  const m = String(param ?? "").match(/^(c[a-z0-9]{12})\.([a-z0-9]{24})$/);
  if (!m) return null;
  const { data, error } = await sb.from(T_REG).select("registro,apagado").eq("colecao", COL_CONV).eq("id", m[1]).maybeSingle();
  if (error) throw error;
  if (!data || data.apagado) return null;
  const conv = data.registro;
  const h = await hmacCodigo(m[1], `convite:${m[2]}`);
  if (conv?.hash !== h || !conviteValido(conv)) return null;
  return conv;
}

async function avaliacoesDoAvaliador(conv: any) {
  const ids = (conv.pessoas || []).map((p: any) => `${conv.mes}_${p.id}_${conv.avaliador}`);
  if (!ids.length) return {};
  const { data, error } = await sb.from(T_REG).select("registro").eq("colecao", COL_DEST).eq("apagado", false).in("id", ids);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((d: any) => [d.registro.pessoaId, { notas: d.registro.notas || {}, eliminatorio: d.registro.eliminatorio || "", obs: d.registro.obs || "" }]));
}

async function liderancaPublica(action: string, body: Record<string, unknown>) {
  const conv = await lerConviteDoLink(body.convite);
  if (!conv) { await espera(400); return resp({ erro: "Este link não vale mais. Peça um novo para a gestão." }, 404); }
  if (action === "liderAbrir") {
    return resp({ avaliadorNome: conv.avaliadorNome, mes: conv.mes, validoAte: conv.validoAte, pessoas: conv.pessoas, criterios: CRITERIOS_LIDERANCA, motivos: MOTIVOS_ELIMINATORIOS, minhas: await avaliacoesDoAvaliador(conv) });
  }
  const v = validarAvaliacao(conv, body);
  if (v.erro) return resp({ erro: v.erro }, 400);
  const agora = new Date().toISOString();
  const { data: antes } = await sb.from(T_REG).select("registro").eq("colecao", COL_DEST).eq("id", v.limpo.id).maybeSingle();
  const registro = { ...v.limpo, criadoEm: antes?.registro?.criadoEm || agora, atualizadoEm: agora, atualizadoPor: conv.avaliador };
  const { error } = await sb.from(T_REG).upsert({ colecao: COL_DEST, id: v.limpo.id, registro, apagado: false, atualizado_em: agora }, { onConflict: "colecao,id" });
  if (error) throw error;
  return resp({ ok: true });
}

async function conviteDirecao(action: string, body: Record<string, unknown>, usuario: string) {
  const semSegredo = async (c: any) => {
    const { cofre, hash, ...resto } = c;
    let link = "";
    try { link = cofre ? `${c.id}.${(await abrirCofre({ cofre })).segredo}` : ""; } catch { link = ""; }
    return { ...resto, link, valido: conviteValido(c) };
  };
  switch (action) {
    case "conviteContas": {
      // Só nome e usuário das contas ativas da direção (para ligar o convite ao login).
      const { data, error } = await sb.from("ml_contas").select("usuario,nome").eq("ativo", true).eq("papel", "direcao");
      if (error) throw error;
      return resp({ contas: (data ?? []).map((c: any) => ({ usuario: c.usuario, nome: c.nome })) });
    }
    case "conviteListar": {
      const { data, error } = await sb.from(T_REG).select("registro").eq("colecao", COL_CONV).eq("apagado", false);
      if (error) throw error;
      const itens = await Promise.all((data ?? []).map((d: any) => semSegredo(d.registro)));
      return resp({ itens: itens.sort((a: any, b: any) => String(b.criadoEm).localeCompare(String(a.criadoEm))) });
    }
    case "conviteCriar": {
      const mes = String(body.mes ?? "");
      const avaliadorNome = String(body.avaliadorNome ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
      const login = String(body.avaliador ?? "").trim().toLowerCase();
      const pessoas = listaPessoas(body.pessoas, 80);
      if (!/^\d{4}-\d{2}$/.test(mes) || !avaliadorNome) return resp({ erro: "Informe o mês e quem vai avaliar." }, 400);
      if (!pessoas.length) return resp({ erro: "Escolha quem será avaliado." }, 400);
      let avaliador = "";
      if (login) {
        const { data } = await sb.from("ml_contas").select("usuario").eq("usuario", login).eq("ativo", true).maybeSingle();
        if (!data) return resp({ erro: "Esse login não existe ou está inativo." }, 400);
        avaliador = login;
      } else {
        avaliador = "link:" + avaliadorNome.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }
      if (avaliador === usuario) return resp({ erro: "Você já avalia pelo sistema; o link é para outra pessoa da liderança." }, 400);
      const id = "c" + sorteio(12);
      const segredo = sorteio(24);
      const agora = new Date();
      const conv = {
        id, mes, avaliador, avaliadorNome, pessoas, status: "ativo", criadoEm: agora.toISOString(), criadoPor: usuario,
        validoAte: new Date(agora.getTime() + DIAS_CONVITE * 864e5).toISOString(),
        hash: await hmacCodigo(id, `convite:${segredo}`), cofre: await fecharCofre({ segredo }),
      };
      const { error } = await sb.from(T_REG).insert({ colecao: COL_CONV, id, registro: conv, apagado: false, atualizado_em: agora.toISOString() });
      if (error) throw error;
      return resp({ convite: await semSegredo(conv) });
    }
    case "conviteRevogar": {
      const id = String(body.id ?? "");
      const { data, error } = await sb.from(T_REG).select("registro").eq("colecao", COL_CONV).eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return resp({ erro: "Link não encontrado." }, 404);
      const reg = { ...data.registro, status: "revogado", revogadoEm: new Date().toISOString(), revogadoPor: usuario };
      const { error: e2 } = await sb.from(T_REG).update({ registro: reg, atualizado_em: new Date().toISOString() }).eq("colecao", COL_CONV).eq("id", id);
      if (e2) throw e2;
      return resp({ convite: await semSegredo(reg) });
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resp({ erro: "Use POST." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return resp({ erro: "JSON inválido." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return resp({ erro: "JSON inválido." }, 400);
  const action = String(body.action ?? "");
  if (action === "ping") return resp({ ok: true, agora: new Date().toISOString() });
  if (action === "votoAbrir" || action === "votoEnviar") {
    try { return await votar(action, body); } catch (e) { console.error("ml-comercial voto", e); return resp({ erro: "O servidor falhou agora. Tente de novo em instantes." }, 500); }
  }
  if (action === "liderAbrir" || action === "liderSalvar") {
    try { return await liderancaPublica(action, body); } catch (e) { console.error("ml-comercial lider", e); return resp({ erro: "O servidor falhou agora. Tente de novo em instantes." }, 500); }
  }

  const m = String(req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  const cracha = m ? await verificarJwt(m[1]) : null;
  if (!cracha || cracha.sis !== SIS) return resp({ erro: "Entre no sistema.", semSessao: true }, 401);
  const usuario = String(cracha.sub ?? "");
  if (!(await contaSegueAtiva(usuario))) return resp({ erro: "Esta conta foi desativada.", semSessao: true }, 401);
  if (cracha.papel !== "direcao") return resp({ erro: "O Comercial é restrito à direção.", semPermissao: true }, 403);

  try {
    if (action.startsWith("pesquisa")) {
      const r = await pesquisaDirecao(action, body, usuario);
      if (r) return r;
    }
    if (action.startsWith("convite")) {
      const r = await conviteDirecao(action, body, usuario);
      if (r) return r;
    }
    switch (action) {
      // Propostas somadas por mês e por responsável + nomes dos usuários do CRM.
      case "resumo": {
        const meses = Math.min(Math.max(Number(body.meses) || 13, 1), 36);
        const desde = somarMeses(mesAtualBR(), -(meses - 1));
        const [propostas, perfis] = await Promise.all([
          lerTudo("propostas", CAMPOS_AGREGADO),
          lerTudo("profiles", "id,nome,ativo"),
        ]);
        const pessoas: Record<string, { nome: string; ativo: boolean }> = {};
        for (const p of perfis) pessoas[p.id] = { nome: String(p.nome ?? "").replace(/\s+/g, " ").trim(), ativo: p.ativo !== false };
        return resp({ geradoEm: new Date().toISOString(), desde, porMes: agregarPropostas(propostas, { desde }), pessoas });
      }

      // Propostas de um mês sem responsável: o que a gestora precisa atribuir.
      case "semResponsavel": {
        const mes = String(body.mes ?? "");
        if (!/^\d{4}-\d{2}$/.test(mes)) return resp({ erro: "Informe o mês (AAAA-MM)." }, 400);
        const linhas = await lerTudo(
          "propostas",
          "id,numero_proposta,cliente_id,status,valor,data_envio,created_at,ativo,deleted_at",
          (q) => q.is("responsavel_comercial_id", null),
        );
        const doMes = linhas.filter((p) =>
          p.ativo !== false && !p.deleted_at &&
          !["RASCUNHO", "CANCELADA"].includes(String(p.status || "").toUpperCase()) &&
          mesBR(p.data_envio || p.created_at) === mes
        );
        const ids = [...new Set(doMes.map((p) => p.cliente_id).filter(Boolean))];
        const nomes: Record<string, string> = {};
        for (let i = 0; i < ids.length; i += 200) {
          const { data, error } = await sb.from("clientes").select("id,razao_social,nome_fantasia").in("id", ids.slice(i, i + 200));
          if (error) throw error;
          for (const c of data ?? []) nomes[c.id] = String(c.nome_fantasia || c.razao_social || "").trim();
        }
        const itens = doMes
          .map((p) => ({
            id: p.id,
            numero: p.numero_proposta ?? "",
            cliente: nomes[p.cliente_id] ?? "",
            status: p.status,
            valor: Number(p.valor) || 0,
            data: String(p.data_envio || p.created_at || "").slice(0, 10),
          }))
          .sort((a, b) => b.data.localeCompare(a.data));
        return resp({ mes, itens });
      }

      // Propostas em aberto, com idade, última interação e chance de aprovação.
      case "cockpit": {
        const hoje = new Date().toISOString();
        const [props, inter] = await Promise.all([
          lerTudo("propostas", "id,numero_proposta,cliente_id,responsavel_comercial_id,status,valor,data_envio,data_aceite,data_recusa,created_at,ativo,deleted_at"),
          lerTudo("interacoes", "id,proposta_id,ocorrido_em", (q) => q.not("proposta_id", "is", null)),
        ]);
        const faixas = probabilidadesPorIdade(props, hoje);
        const ultimaInter: Record<string, string> = {};
        for (const i of inter) if (!ultimaInter[i.proposta_id] || i.ocorrido_em > ultimaInter[i.proposta_id]) ultimaInter[i.proposta_id] = i.ocorrido_em;
        const limite = Date.now() - 365 * 86400000;
        const abertas = props
          .filter((p) => p.ativo !== false && !p.deleted_at && String(p.status || "").toUpperCase() === "ENVIADA" && Date.parse(p.data_envio || p.created_at) >= limite)
          .map((p) => {
            const data = String(p.data_envio || p.created_at);
            const idade = Math.floor((Date.now() - Date.parse(data)) / 86400000);
            return {
              id: p.id, numero: p.numero_proposta ?? "", clienteId: p.cliente_id, responsavelId: p.responsavel_comercial_id,
              valor: Number(p.valor) || 0, data: data.slice(0, 10), idade, ultimaInteracao: ultimaInter[p.id]?.slice(0, 10) ?? null,
              chance: chanceDaIdade(faixas, idade),
            };
          })
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 500);
        const nomes = await nomesClientes(abertas.map((a) => a.clienteId));
        for (const a of abertas as any[]) { a.cliente = nomes[a.clienteId] ?? ""; delete a.clienteId; }
        return resp({ geradoEm: hoje, faixas, abertas });
      }

      // Funil: leads → oportunidades → propostas → aprovadas, num período.
      case "funil": {
        const meses = Math.min(Math.max(Number(body.meses) || 6, 1), 24);
        const desde = somarMeses(mesAtualBR(), -(meses - 1));
        const noPeriodo = (iso: string | null) => { const m = mesBR(iso); return !!m && m >= desde; };
        const [leads, opps, props] = await Promise.all([
          lerTudo("leads", "id,status,origem,created_at,data_primeiro_atendimento,cliente_convertido_id,ativo,deleted_at"),
          lerTudo("oportunidades", "id,estagio,status,valor_estimado,created_at,ativo,deleted_at"),
          lerTudo("propostas", "id,status,created_at,data_envio,ativo,deleted_at"),
        ]);
        const vivos = (x: any) => x.ativo !== false && !x.deleted_at;
        const L = leads.filter((l) => vivos(l) && noPeriodo(l.created_at));
        const st = (s: unknown) => String(s || "").trim().toUpperCase();
        const contar = (xs: any[], f: (x: any) => string) => xs.reduce((m: Record<string, number>, x) => { const k = f(x) || "—"; m[k] = (m[k] || 0) + 1; return m; }, {});
        const O = opps.filter((o) => vivos(o) && noPeriodo(o.created_at));
        const P = props.filter((p) => vivos(p) && !["RASCUNHO", "CANCELADA"].includes(st(p.status)) && noPeriodo(p.data_envio || p.created_at));
        const parados = leads.filter((l) => vivos(l) && st(l.status) === "EM ATENDIMENTO" && Date.now() - Date.parse(l.data_primeiro_atendimento || l.created_at) > 30 * 86400000).length;
        const serie: Record<string, { leads: number; convertidos: number }> = {};
        for (const l of L) { const m = mesBR(l.created_at)!; serie[m] ??= { leads: 0, convertidos: 0 }; serie[m].leads++; if (l.cliente_convertido_id || st(l.status) === "CONVERTIDO") serie[m].convertidos++; }
        return resp({
          desde, meses,
          leads: { total: L.length, porStatus: contar(L, (l) => st(l.status)), porOrigem: contar(L, (l) => String(l.origem || "—")), convertidos: L.filter((l) => l.cliente_convertido_id || st(l.status) === "CONVERTIDO").length, paradosMais30d: parados },
          oportunidades: { total: O.length, porEstagio: contar(O, (o) => `${st(o.estagio)}`), ganhas: O.filter((o) => ["GANHA", "APROVADA"].includes(st(o.status))).length, perdidas: O.filter((o) => ["PERDIDA", "RECUSADA"].includes(st(o.status))).length },
          propostas: { enviadas: P.length, aprovadas: P.filter((p) => st(p.status) === "APROVADA").length, recusadas: P.filter((p) => st(p.status) === "RECUSADA").length, abertas: P.filter((p) => st(p.status) === "ENVIADA").length },
          serieLeads: serie,
        });
      }

      // Carteira: clientes por valor aprovado (ABC), em risco, contratos e recorrências.
      case "carteira": {
        const hoje = new Date().toISOString();
        const hojeD = hoje.slice(0, 10);
        const mais = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
        const [props, contratos, recs] = await Promise.all([
          lerTudo("propostas", "id,cliente_id,status,valor,data_envio,data_aceite,created_at,ativo,deleted_at"),
          lerTudo("contratos", "id,numero_contrato,cliente_id,status,periodicidade,data_fim,ativo,deleted_at"),
          lerTudo("recorrencias_clientes", "id,cliente_id,periodicidade,proxima_previsao,ultima_execucao,status,ativo"),
        ]);
        const clientes = carteiraClientes(props, hoje).slice(0, 400);
        const vencendo = contratos
          .filter((c) => c.ativo !== false && !c.deleted_at && String(c.status || "").toUpperCase() === "ATIVO" && c.data_fim && c.data_fim >= mais(-30) && c.data_fim <= mais(90))
          .map((c) => ({ id: c.id, numero: c.numero_contrato ?? "", clienteId: c.cliente_id, periodicidade: c.periodicidade ?? "", dataFim: c.data_fim }))
          .sort((a, b) => a.dataFim.localeCompare(b.dataFim));
        const recAtivas = recs.filter((r) => r.ativo !== false && r.proxima_previsao);
        const proximas = recAtivas
          .filter((r) => r.proxima_previsao <= mais(30))
          .map((r) => ({ id: r.id, clienteId: r.cliente_id, periodicidade: r.periodicidade ?? "", proxima: r.proxima_previsao, ultima: r.ultima_execucao, atrasada: r.proxima_previsao < hojeD }))
          .sort((a, b) => a.proxima.localeCompare(b.proxima));
        const nomes = await nomesClientes([...clientes.map((c) => c.clienteId), ...vencendo.map((c) => c.clienteId), ...proximas.slice(0, 150).map((r) => r.clienteId)]);
        const comNome = (x: any) => { const { clienteId, ...r } = x; return { ...r, cliente: nomes[clienteId] ?? "" }; };
        return resp({
          geradoEm: hoje,
          clientes: clientes.map(comNome),
          contratosVencendo: vencendo.map(comNome),
          recorrencias: { ativas: recAtivas.length, atrasadas: proximas.filter((r) => r.atrasada).length, proximos30d: proximas.filter((r) => !r.atrasada).length, lista: proximas.slice(0, 150).map(comNome) },
        });
      }

      // Licitações e prazos.
      case "licitacoes": {
        const [lics, prazos] = await Promise.all([
          lerTudo("licitacoes", "id,numero,orgao,modalidade,objeto,municipio,uf,status,data_sessao,valor_estimado,valor_proposta,valor_homologado,responsavel_id,resultado,motivo_perda,deleted_at"),
          lerTudo("licitacao_prazos", "id,licitacao_id,tipo,titulo,prazo,status,responsavel_id"),
        ]);
        const vivas = lics.filter((l) => !l.deleted_at).map((l) => { const { deleted_at, ...r } = l; return r; });
        const ids = new Set(vivas.map((l) => l.id));
        const abertos = prazos
          .filter((p) => ids.has(p.licitacao_id) && p.prazo && !["CONCLUIDO", "CONCLUÍDO", "CANCELADO"].includes(String(p.status || "").toUpperCase()))
          .sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)));
        return resp({ licitacoes: vivas, prazos: abertos });
      }

      // Pesquisas de satisfação registradas no CRM.
      case "nps": {
        const linhas = await lerTudo("satisfacao_nps", "id,cliente_id,nota,comentario,canal,respondido_em,created_at,deleted_at");
        const vivas = linhas.filter((n) => !n.deleted_at);
        const nomes = await nomesClientes(vivas.map((n) => n.cliente_id));
        return resp({ respostas: vivas.map((n) => ({ id: n.id, cliente: nomes[n.cliente_id] ?? "", nota: n.nota, comentario: n.comentario ?? "", canal: n.canal ?? "", data: String(n.respondido_em || n.created_at || "").slice(0, 10) })) });
      }

      default:
        return resp({ erro: "Ação desconhecida." }, 400);
    }
  } catch (e) {
    console.error("ml-comercial", action, e);
    return resp({ erro: "O servidor falhou agora. Tente de novo em instantes." }, 500);
  }
});
