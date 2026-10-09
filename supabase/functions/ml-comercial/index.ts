// ============================================================================
// ml-comercial — a porta de dados do Comercial MinasLab (repositório gestao).
//
// SÓ LEITURA do CRM. Devolve números já somados (propostas por mês e por
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
import { agregarPropostas, mesBR } from "./agregar.mjs";

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

function mesAtualBR() {
  return mesBR(new Date().toISOString())!;
}
function somarMeses(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
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
  const action = String(body.action ?? "");
  if (action === "ping") return resp({ ok: true, agora: new Date().toISOString() });

  const m = String(req.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  const cracha = m ? await verificarJwt(m[1]) : null;
  if (!cracha || cracha.sis !== SIS) return resp({ erro: "Entre no sistema.", semSessao: true }, 401);
  const usuario = String(cracha.sub ?? "");
  if (!(await contaSegueAtiva(usuario))) return resp({ erro: "Esta conta foi desativada.", semSessao: true }, 401);
  if (cracha.papel !== "direcao") return resp({ erro: "O Comercial é restrito à direção.", semPermissao: true }, 403);

  try {
    switch (action) {
      // Propostas somadas por mês e por responsável + nomes dos usuários do CRM.
      case "resumo": {
        const meses = Math.min(Math.max(Number(body.meses ?? 13), 1), 36);
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

      default:
        return resp({ erro: "Ação desconhecida." }, 400);
    }
  } catch (e) {
    console.error("ml-comercial", action, e);
    return resp({ erro: "O servidor falhou agora. Tente de novo em instantes." }, 500);
  }
});
