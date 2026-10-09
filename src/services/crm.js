// Números do CRM, já somados no servidor (Edge Function ml-comercial).
import { COMERCIAL } from "../lib/api.js";
import { comCracha } from "../lib/sessao.js";

export const resumoCRM = (meses = 13) => comCracha(COMERCIAL, { action: "resumo", meses });

export const propostasSemResponsavel = (mes) => comCracha(COMERCIAL, { action: "semResponsavel", mes });
