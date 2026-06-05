// Run silentdrop-llm against synthetic LLM responses, each demonstrating a
// silent failure mode that JSON.parse + standard validation will NOT catch.
import { check, report } from "../index.mjs";

const SPEC = {
  requiredFields: ["status", "summary", "deal_id"],
  enumFields: { status: ["pending", "in_progress", "done"] },
  validIds: { deal_id: ["D-1001", "D-1002", "D-1003"] },
  claimVsList: { claimField: "total_matches", listField: "matches" },
};

const SCENARIOS = [
  { title: "fully compliant response (control)",
    response: { status: "done", summary: "Reviewed", deal_id: "D-1001", total_matches: 2, matches: ["a", "b"] } },
  { title: "missing required field",
    response: { status: "done", deal_id: "D-1001" } },
  { title: "enum drift",
    response: { status: "in-progress", summary: "Reviewed", deal_id: "D-1001" } },
  { title: "ID hallucination",
    response: { status: "done", summary: "Reviewed", deal_id: "D-9999" } },
  { title: "empty-claim mismatch",
    response: { status: "done", summary: "Found 5", deal_id: "D-1001", total_matches: 5, matches: [] } },
];

for (const s of SCENARIOS) {
  console.log(`\n--- ${s.title} ---`);
  report(check(s.response, SPEC));
}
