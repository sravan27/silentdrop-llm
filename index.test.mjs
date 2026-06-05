import { test } from "node:test";
import assert from "node:assert/strict";
import { check } from "./index.mjs";

const SPEC = {
  requiredFields: ["status", "summary"],
  enumFields: { status: ["pending", "done"] },
  validIds: { deal_id: ["D-1", "D-2"] },
  claimVsList: { claimField: "total", listField: "items" },
};

test("compliant response: ok", () => {
  assert.deepEqual(check({ status: "done", summary: "ok", deal_id: "D-1", total: 1, items: ["x"] }, SPEC), { ok: true });
});
test("missing required field is caught", () => {
  const r = check({ status: "done", deal_id: "D-1" }, SPEC);
  assert.equal(r.ok, false);
  assert.ok(r.failures.some(f => f.code === "missing_required_field" && f.field === "summary"));
});
test("empty-string required field is caught (silent in stricter validators)", () => {
  const r = check({ status: "done", summary: "" }, SPEC);
  assert.ok(r.failures.some(f => f.code === "empty_required_field"));
});
test("enum drift is caught", () => {
  const r = check({ status: "in-progress", summary: "x" }, SPEC);
  assert.ok(r.failures.some(f => f.code === "enum_drift" && f.field === "status"));
});
test("ID hallucination is caught (string and array fields)", () => {
  assert.ok(check({ status: "done", summary: "x", deal_id: "D-999" }, SPEC).failures.some(f => f.code === "id_hallucination"));
  const r = check({ status: "done", summary: "x", deal_id: ["D-1", "D-999"] }, SPEC);
  assert.ok(r.failures.some(f => f.code === "id_hallucination" && f.value === "D-999"));
});
test("claim-vs-list mismatch is caught", () => {
  const r = check({ status: "done", summary: "found 5", total: 5, items: [] }, SPEC);
  assert.ok(r.failures.some(f => f.code === "claim_mismatch"));
});
test("non-object response fails cleanly", () => {
  assert.equal(check(null, SPEC).ok, false);
  assert.equal(check("a string", SPEC).ok, false);
});
