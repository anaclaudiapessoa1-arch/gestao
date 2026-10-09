// Destaque do Mês (modelo híbrido): nota da equipe (votação anônima, 0 a 10)
// + nota da liderança (10 critérios de 0 a 5, convertida para 0 a 10).
// As duas na MESMA escala antes de aplicar os pesos — na planilha antiga a
// soma direta dava peso dobrado à equipe sem ninguém ter decidido isso.

export const CRITERIOS_LIDERANCA = [
  { id: "p1", nome: "Prazos e metas", desc: "Cumpre prazos e metas combinados." },
  { id: "p2", nome: "Qualidade técnica", desc: "Qualidade das análises, propostas e OS; erro zero." },
  { id: "p3", nome: "Normas sanitárias", desc: "Segue as normas da Vigilância e da ISO/IEC 17025." },
  { id: "p4", nome: "Organização", desc: "Posto, materiais e registros organizados." },
  { id: "p5", nome: "Comunicação", desc: "Registra e repassa informação com clareza, sem retrabalho." },
  { id: "p6", nome: "Proatividade", desc: "Antecipa problemas e propõe soluções." },
  { id: "p7", nome: "Assiduidade e pontualidade", desc: "Presença e horários (faltas justificadas não contam)." },
  { id: "p8", nome: "Responsabilidade com materiais", desc: "Cuida de equipamentos, insumos e documentos." },
  { id: "p9", nome: "Ética", desc: "Imparcialidade, sigilo e respeito." },
  { id: "p10", nome: "Colaboração", desc: "Apoia os colegas e outros setores." },
];

export const MOTIVOS_ELIMINATORIOS = [
  "Recebeu advertência",
  "Descumpriu normas da Vigilância Sanitária",
  "Apresentou falta grave de organização",
  "Gerou retrabalho por falha de comunicação",
  "Atrasos recorrentes sem justificativa",
  "Não entregou documento no prazo",
  "Férias ou afastamento no mês",
  "Outro motivo",
];

export const PESOS_PADRAO = { equipe: 40, lideranca: 60 };

const r1 = (x) => Math.round(x * 10) / 10;

/** Média de UMA avaliação de liderança (0 a 5) ou null se incompleta. */
export function mediaLideranca(av) {
  const ns = CRITERIOS_LIDERANCA.map((c) => av?.notas?.[c.id]).filter((n) => n !== "" && n != null).map(Number);
  if (ns.length < CRITERIOS_LIDERANCA.length || ns.some((n) => !(n >= 0 && n <= 5))) return null;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

/**
 * Ranking do mês.
 *   pessoas: [{id, nome}]
 *   equipe: resultado da votação ({equipe: [{id, n, media, oculto}]}) ou null
 *   avaliacoes: avaliações da liderança do mês [{pessoaId, notas, eliminatorio}]
 * Devolve [{id, nome, equipe, lideranca, total, votos, apto, motivo, completo}]
 * ordenado: aptos e completos primeiro, pelo total.
 */
export function rankingDestaque({ pessoas, equipe, avaliacoes, pesos = PESOS_PADRAO }) {
  const pe = Number(pesos.equipe) || 0;
  const pl = Number(pesos.lideranca) || 0;
  const linhas = pessoas.map((p) => {
    const v = (equipe?.equipe || []).find((x) => x.id === p.id);
    const eq = v && !v.oculto && v.media != null ? v.media : null;
    const avs = avaliacoes.filter((a) => a.pessoaId === p.id);
    const medias = avs.map(mediaLideranca).filter((m) => m != null);
    const lid = medias.length ? (medias.reduce((a, b) => a + b, 0) / medias.length) * 2 : null;
    const elim = avs.find((a) => a.eliminatorio);
    const completo = eq != null && lid != null;
    const total = completo && pe + pl ? r1((eq * pe + lid * pl) / (pe + pl)) : null;
    return { id: p.id, nome: p.nome, equipe: eq == null ? null : r1(eq), lideranca: lid == null ? null : r1(lid), total, votos: v?.n || 0, apto: !elim, motivo: elim?.eliminatorio || "", completo };
  });
  const chave = (x) => (x.apto && x.completo ? 0 : x.completo ? 1 : 2);
  return linhas.sort((a, b) => chave(a) - chave(b) || (b.total ?? -1) - (a.total ?? -1) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

/** Os 3 primeiros que concorrem (aptos e com as duas notas). */
export const podio = (ranking) => ranking.filter((x) => x.apto && x.completo).slice(0, 3);

export const nomeCurto = (nome) => {
  const p = String(nome || "").trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p.at(-1)}` : p[0] || "";
};
