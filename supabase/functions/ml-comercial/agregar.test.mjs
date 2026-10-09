import test from "node:test";
import assert from "node:assert/strict";
import { agregarPropostas, mesBR } from "./agregar.mjs";

test("mês em Brasília", () => {
  assert.equal(mesBR("2026-10-01T02:59:00Z"), "2026-09");
  assert.equal(mesBR("2026-10-01T03:00:00Z"), "2026-10");
  assert.equal(mesBR(null), null);
});

test("agrega por mês de envio, separa sem responsável e ignora rascunho/cancelada/excluída", () => {
  const props = [
    { responsavel_comercial_id: "a", status: "APROVADA", valor: 1000, data_envio: "2026-09-10T12:00:00Z", data_aceite: "2026-10-02T12:00:00Z" },
    { responsavel_comercial_id: "a", status: "ENVIADA", valor: 500, data_envio: "2026-09-11T12:00:00Z" },
    { responsavel_comercial_id: null, status: "RECUSADA", valor: 300, data_envio: "2026-09-12T12:00:00Z" },
    { responsavel_comercial_id: "a", status: "RASCUNHO", data_envio: "2026-09-12T12:00:00Z" },
    { responsavel_comercial_id: "a", status: "CANCELADA", data_envio: "2026-09-12T12:00:00Z" },
    { responsavel_comercial_id: "a", status: "ENVIADA", deleted_at: "2026-09-20T00:00:00Z", data_envio: "2026-09-12T12:00:00Z" },
    { responsavel_comercial_id: "b", status: "APROVADA", valor: 200, created_at: "2026-08-31T23:00:00Z" },
  ];
  const r = agregarPropostas(props);
  assert.deepEqual(r["2026-09"].total, { enviadas: 3, aprovadas: 1, recusadas: 1, abertas: 1, valorAprovado: 0 });
  assert.equal(r["2026-09"].porPessoa._sem.recusadas, 1);
  // valor aprovado entra no mês do aceite (outubro), não no do envio
  assert.equal(r["2026-10"].porPessoa.a.valorAprovado, 1000);
  assert.equal(r["2026-10"].porPessoa.a.enviadas, 0);
  // 31/08 23:00 UTC = 31/08 20:00 em Brasília → agosto
  assert.equal(r["2026-08"].porPessoa.b.aprovadas, 1);
  assert.equal(r["2026-08"].total.valorAprovado, 200);
});

test("filtro desde corta meses antigos", () => {
  const r = agregarPropostas([{ responsavel_comercial_id: "a", status: "ENVIADA", data_envio: "2025-01-10T12:00:00Z" }], { desde: "2026-01" });
  assert.deepEqual(r, {});
});
