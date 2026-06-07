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

## Need the deep version?

`silentdrop-llm` catches the common silent failure modes automatically at the boundary. If your agent/LLM layer is correctness-critical and you want a **full manual hardening pass** — schema spec, guardrail wiring, eval harness, regression test suite, response-vs-reality reconciliation — I do it as a fixed sprint, no-find-no-charge:

- **48-hour Implementation Sprint** ($1,000) — full hardening pass, code + tests + docs delivered.
  **→ https://buy.polar.sh/polar_cl_z0eLsPUJeMwrcNs4MQPAQbKIM3Rbdb8fLDgVj2RZcmr**
- **Diagnostic Fix** ($500) — one specific silent failure I diagnose, repro, and ship a PR for.
  **→ https://buy.polar.sh/polar_cl_G0fuUHHZ1tg9E0oe7gluje9gs44l8FAqVnfwS2AJkbw**

Background: I have shipped 8 silent-row-loss fixes to PowerSync sync-rules (4 merged + 4 open), 2 each at Rocicorp Zero and Autumn, plus PRs at InstantDB, ElectricSQL, Dexie, RxDB. Profile: https://github.com/sravan27.

## License

MIT
