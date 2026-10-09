// Soma das propostas do CRM por mês e por responsável. Função pura: roda na
// Edge Function (Deno) e nos testes (node), sem banco nenhum.
//
// Regras (as mesmas da especificação):
//  - entram só propostas ativas, não excluídas, fora de RASCUNHO e CANCELADA;
//  - o mês da proposta é o do ENVIO (data_envio; sem ela, created_at), em Brasília;
//  - aprovadas/recusadas/abertas contam no mês do envio (coorte);
//  - valor aprovado conta no mês do ACEITE (data_aceite; sem ela, o do envio);
//  - responsável vazio vai para a chave "_sem".

const FORA = new Set(["RASCUNHO", "CANCELADA"]);

export function mesBR(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!isFinite(t)) return null;
  const br = new Date(t - 3 * 3600 * 1000); // Brasília: UTC-3 o ano todo desde 2019
  return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}`;
}

const vazio = () => ({ enviadas: 0, aprovadas: 0, recusadas: 0, abertas: 0, valorAprovado: 0 });

export function agregarPropostas(propostas, { desde } = {}) {
  const porMes = {};
  const garantir = (mes, pid) => {
    porMes[mes] ??= { total: vazio(), porPessoa: {} };
    porMes[mes].porPessoa[pid] ??= vazio();
    return [porMes[mes].total, porMes[mes].porPessoa[pid]];
  };

  for (const p of propostas) {
    if (p.ativo === false || p.deleted_at) continue;
    const status = String(p.status || "").toUpperCase();
    if (FORA.has(status)) continue;
    const pid = p.responsavel_comercial_id || "_sem";

    const mesEnvio = mesBR(p.data_envio || p.created_at);
    if (mesEnvio && (!desde || mesEnvio >= desde)) {
      const [t, x] = garantir(mesEnvio, pid);
      for (const alvo of [t, x]) {
        alvo.enviadas += 1;
        if (status === "APROVADA") alvo.aprovadas += 1;
        else if (status === "RECUSADA") alvo.recusadas += 1;
        else alvo.abertas += 1;
      }
    }

    if (status === "APROVADA") {
      const mesAceite = mesBR(p.data_aceite || p.data_envio || p.created_at);
      if (mesAceite && (!desde || mesAceite >= desde)) {
        const v = Number(p.valor) || 0;
        const [t, x] = garantir(mesAceite, pid);
        t.valorAprovado += v;
        x.valorAprovado += v;
      }
    }
  }

  for (const m of Object.values(porMes)) {
    m.total.valorAprovado = Math.round(m.total.valorAprovado * 100) / 100;
    for (const x of Object.values(m.porPessoa)) x.valorAprovado = Math.round(x.valorAprovado * 100) / 100;
  }
  return porMes;
}
