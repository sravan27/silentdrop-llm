// silentdrop-llm — runtime guard against the silent failure modes of LLM responses.
//
// Most "the model gave a bad answer" bugs don't throw — the JSON parses, the keys
// look right, the program proceeds. The failure surfaces three calls later as a
// wrong tool argument, a missing record, or a downstream NPE. silentdrop-llm
// checks for those silent failures at the boundary so you fail loudly instead.
//
// Use it after parsing a model response and BEFORE handing the values to anything
// stateful (a DB write, a tool call, a webhook). It returns either
// { ok: true } or { ok: false, failures: [...] } — pure, no side effects.

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

export function check(response, spec = {}) {
  if (!isPlainObject(response)) {
    return { ok: false, failures: [{ code: "not_object", message: "response is not a plain object" }] };
  }
  const failures = [];

  // 1. Required fields — model "complied" but quietly omitted a required key.
  for (const field of spec.requiredFields ?? []) {
    if (!(field in response) || response[field] === null || response[field] === undefined) {
      failures.push({ code: "missing_required_field", field, message: `required field "${field}" is missing or null` });
    } else if (typeof response[field] === "string" && response[field].trim() === "") {
      failures.push({ code: "empty_required_field", field, message: `required field "${field}" is an empty string` });
    }
  }

  // 2. Enum drift — categorical field with a value outside the allowed set
  //    (model "in_progress" when only "pending" / "done" are valid). Silent
  //    because JSON.parse doesn't know about your enum.
  for (const [field, allowed] of Object.entries(spec.enumFields ?? {})) {
    if (field in response && response[field] !== null && response[field] !== undefined) {
      if (!allowed.includes(response[field])) {
        failures.push({ code: "enum_drift", field, value: response[field], allowed, message: `field "${field}" value ${JSON.stringify(response[field])} is not in the allowed set` });
      }
    }
  }

  // 3. ID hallucination — model references an ID (string or number) that is
  //    NOT in the lookup set you provided. The most expensive silent agent
  //    failure: the tool call looks valid and the downstream lookup silently
  //    returns 0 rows or 404s. We accept both arrays and Sets.
  for (const [field, lookup] of Object.entries(spec.validIds ?? {})) {
    if (!(field in response) || response[field] === null || response[field] === undefined) continue;
    const set = lookup instanceof Set ? lookup : new Set(lookup);
    const values = Array.isArray(response[field]) ? response[field] : [response[field]];
    for (const v of values) {
      if (!set.has(v)) {
        failures.push({ code: "id_hallucination", field, value: v, message: `field "${field}" references ID ${JSON.stringify(v)} which is not in the provided context` });
      }
    }
  }

  // 4. Empty-claim mismatch — the model says "Here are N results" while
  //    the array is empty or fewer than claimed.
  if (spec.claimVsList) {
    const { claimField, listField } = spec.claimVsList;
    const claimed = Number(response[claimField]);
    const got = Array.isArray(response[listField]) ? response[listField].length : null;
    if (Number.isFinite(claimed) && got !== null && claimed !== got) {
      failures.push({ code: "claim_mismatch", message: `claimed ${claimField}=${claimed} but ${listField}.length=${got}` });
    }
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

export function report(result) {
  if (result.ok) { console.log("  ✓ no silent failures"); return 0; }
  for (const f of result.failures) console.log(`  ✗  ${f.code} — ${f.message}`);
  console.log(`\n  ✗ ${result.failures.length} silent failure(s) — DO NOT pass this response downstream`);
  return result.failures.length;
}
