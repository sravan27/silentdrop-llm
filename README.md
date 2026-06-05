# silentdrop-llm

**Runtime guard against the silent failure modes of LLM responses.**

Most "the model gave a bad answer" bugs don't throw. The JSON parses, the keys look right, and the program proceeds. The failure surfaces three calls later — a wrong tool argument, a missing record, a 404 from a downstream service. By then the trail is cold.

`silentdrop-llm` checks for those silent failures at the boundary, so you fail loudly *before* the bad value reaches anything stateful. MIT, zero dependencies, ~70 LOC.

## What it catches

- **`missing_required_field`** — model "complied" but quietly omitted a required key (or returned `""`/`null`)
- **`enum_drift`** — categorical field with a value outside the allowed set (`"in-progress"` when the schema says `"in_progress"`)
- **`id_hallucination`** — response references an ID that is **not** in the lookup set you provided (the most expensive silent agent failure)
- **`claim_mismatch`** — response says `total: 5` but the list it returned has 0 items

`JSON.parse` + a basic schema validator won't catch any of these on their own.

## Use it

```js
import { check } from "silentdrop-llm";

const result = check(modelResponse, {
  requiredFields: ["status", "summary", "deal_id"],
  enumFields: { status: ["pending", "in_progress", "done"] },
  validIds: { deal_id: knownDealIdSet },           // Set or array
  claimVsList: { claimField: "total", listField: "items" },
});

if (!result.ok) {
  // fail loudly — DO NOT pass the response downstream
  throw new Error(result.failures[0].message);
}
```

Run the demo against synthetic responses showing each failure mode:

```
$ node examples/synthetic.mjs

--- ID hallucination ---
  ✗  id_hallucination — field "deal_id" references ID "D-9999" which is not in the provided context
  ✗ 1 silent failure(s) — DO NOT pass this response downstream
```

## Why

This is the same "what silently goes wrong?" lens behind [silentdrop](https://github.com/sravan27/silentdrop) (silent data-loss bugs in JS database query layers — proven on PowerSync, Rocicorp's Zero, InstantDB, ElectricSQL, Dexie) — applied to the LLM-output boundary instead.

If your agent/LLM layer is correctness-critical and you'd like the whole boundary hardened by hand — schema specs, guardrails, eval harness, regression tests — I take that on as a fixed 48-hour sprint, details at https://github.com/sravan27.
