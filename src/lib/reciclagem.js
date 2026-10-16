// Periodicidade e reciclagem dos treinamentos: de quanto em quanto tempo cada
// trilha deve ser refeita e a situação de cada pessoa (em dia, vence em breve,
// vencido ou nunca fez). Regras puras, com testes.
import { treinamentosDaPessoa } from "./treinamentosPessoa.js";

export const OPCOES_PERIODO = [
  [0, "Sob demanda (sem reciclagem)"],
  [3, "A cada 3 meses"],
  [6, "A cada 6 meses"],
  [12, "Anual (a cada 12 meses)"],
  [24, "A cada 2 anos"],
];

/** Sugestão inicial; a gestão muda na tela e a escolha fica gravada. */
export const PERIODO_SUGERIDO = {
  "analise-critica": 12, "crm-sem-furos": 12, "proposta-sem-erro": 12, "os-correta": 12,
  atendimento: 12, tecnico: 24, licitacoes: 0, "follow-up": 0, spin: 0, gestora: 0,
};

export const AVISO_DIAS = 30;
export const ID_CONFIG = "periodicidade";

/** Períodos em vigor: o gravado (registro "periodicidade") ou a sugestão. */
export function periodosEmVigor(registros) {
  const cfg = (registros || []).find((r) => r.id === ID_CONFIG)?.periodos || {};
  return { ...PERIODO_SUGERIDO, ...cfg };
}

/** "AAAA-MM-DD" + n meses (dia 31 vira o último dia do mês, se preciso). */
export function somarMesesData(iso, n) {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  const ano = Math.floor(t / 12), mes = (t % 12) + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

const dias = (de, ate) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5);

/** Situação de uma pessoa numa trilha periódica. */
export function situacao(ultima, meses, hoje) {
  if (!meses) return { status: "livre", ultima: ultima || null, vence: null };
  if (!ultima) return { status: "nunca", ultima: null, vence: null };
  const vence = somarMesesData(ultima, meses);
  const faltam = dias(hoje, vence);
  return { status: faltam < 0 ? "vencido" : faltam <= AVISO_DIAS ? "vence" : "em-dia", ultima, vence, faltam };
}

/**
 * Matriz pessoa × trilha periódica, com a lista do que fazer (vencidos e
 * vencendo primeiro, depois quem nunca fez).
 */
export function matrizReciclagem({ trilhas, registros, pessoas, hoje }) {
  const per = periodosEmVigor(registros);
  const periodicas = (trilhas || []).filter((t) => per[t.id] > 0);
  const linhas = (pessoas || []).map((p) => {
    const feitos = treinamentosDaPessoa(registros, p);
    const celulas = Object.fromEntries(periodicas.map((t) => {
      const ultima = feitos.find((f) => f.trilhaId === t.id)?.data || null;
      return [t.id, situacao(ultima, per[t.id], hoje)];
    }));
    return { pessoa: p, celulas };
  });
  const ordem = { vencido: 0, vence: 1, nunca: 2 };
  const pendencias = linhas.flatMap((l) => periodicas.map((t) => ({ pessoa: l.pessoa, trilha: t, ...l.celulas[t.id] })))
    .filter((x) => x.status in ordem)
    .sort((a, b) => ordem[a.status] - ordem[b.status] || String(a.vence || "").localeCompare(String(b.vence || "")));
  const conta = (s) => pendencias.filter((x) => x.status === s).length;
  return { periodicas, periodos: per, linhas, pendencias, totais: { vencido: conta("vencido"), vence: conta("vence"), nunca: conta("nunca") } };
}
