# Technology Stack

**Project:** Scribe — Structured LLM Response Contract (v3.1)
**Researched:** 2026-06-16
**Confidence:** HIGH (recommendation) / MEDIUM (cozy-stack server-side passthrough of `response_format` — undocumented, must be probed at runtime)

## TL;DR for the roadmap

The provider/model behind `POST /ai/v1/chat/completions` is **unknown and abstracted by cozy-stack**, and both the cozy-stack docs and the `cozy-client` typedef only acknowledge `messages` + `temperature`/`model`/`top_p`/`max_tokens`/penalties (no `response_format`, no `tools`). Therefore:

1. **Primary mechanism = prompt-only JSON contract** (system/user instruction + one worked example). The only mechanism guaranteed to work regardless of what model cozy-stack proxies to. Aligns with your locked decisions ("prompt côté client", "validation maison", "zéro dépendance").
2. **`response_format: { type: "json_object" }` = optional, opt-in, behind a dev probe + feature flag** — NOT the baseline. Sending it optimistically to an unknown proxy is moderately risky (can hard-400; see safety section).
3. **Tool/function-calling = do NOT pursue.** Heavier protocol, even less likely to survive the proxy, complicates response extraction, zero benefit for a 2-field object.
4. **Validation = hand-rolled** (your locked choice) is correct. The contract is 2 fields; ajv/zod add 1-4.5 MB unpacked and buy nothing.
5. **Tolerant parsing = roll your own ~30-LOC helper** (fence-strip + first-balanced-object + trailing-comma fix). A dep (`jsonrepair`) is justified only if the probe shows genuinely malformed JSON the helper can't recover. Default: **zero new runtime deps.**

## Principle: Zero New Dependencies (default)

Like v3.0, this milestone should ship with no new npm packages on the default path. Everything needed — prompt templating, JSON.parse, a hand-rolled validator, and a small tolerant parser — already exists in plain JS. A dependency is added only if a runtime probe proves the model emits JSON our helper can't cheaply recover.

## Recommended Stack

### Core Mechanism (NEW for v3.1)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Prompt-only JSON contract** (no lib) | n/a | Instruct the model to emit `{discussion, fragments?}` JSON via system/user prompt + 1 worked example | Only mechanism that works against an unknown proxied model. You already build prompts client-side, so this is a string-template change in `scribeAI.js`, zero deps. Keep `temperature: 0.3` (already set) — low temp improves JSON adherence. |
| **Hand-rolled validator** (no lib, ~15 LOC) | n/a | Confirm parsed object matches the contract: `typeof discussion === 'string'`; `fragments` absent OR array of strings | Shape is 2 fields. A small guard ships faster, is ES-portable, debuggable, drives the context-aware fallback directly, and adds 0 bytes. The JSON Schema stays a committed **documentation artifact** (and the literal text you can paste into a future `json_schema` request). |
| **Tolerant parse helper** (no lib, ~30 LOC) | n/a | Strip ```` ```json ```` fences, extract first balanced `{...}`, retry `JSON.parse`, strip trailing commas | LLM JSON failures are dominated by code fences + prose-wrapping + trailing commas, all trivially handled. Preserves the zero-dep posture. |

### Optional / opt-in (behind dev probe + feature flag, NOT default)

| Technology | Mechanism | Purpose | When to Use |
|------------|-----------|---------|-------------|
| **`response_format: { type: "json_object" }`** | OpenAI Chat Completions body field | Ask the endpoint for guaranteed-parseable JSON (JSON mode) | ONLY after a dev probe confirms cozy-stack forwards it AND the backend accepts it without 400. Keep the word "json" in the prompt (OpenAI JSON mode 400s otherwise). Always keep the prompt contract + tolerant parser as fallback. |
| **`response_format: { type: "json_schema", json_schema, strict: true }`** | OpenAI Structured Outputs | Schema-enforced output (strongest guarantee) | Only if probe shows a recent OpenAI/Azure model (gpt-4o-2024-08-06+, gpt-4.1, o-series) or vLLM/llama.cpp with guided decoding. Unknown proxy makes this non-portable — treat as a bonus, never a requirement. |

### Supporting Libraries — candidate deps (evaluate ONLY if the probe proves need)

| Library | Version | Unpacked size | Verdict |
|---------|---------|---------------|---------|
| `jsonrepair` | 3.14.0 | ~508 KB unpacked | **Hold.** Best general repairer (trailing commas, single quotes, missing brackets, fences). Add only if probe shows malformed JSON the ~30-LOC helper can't recover. Well maintained (josdejong), ESM+CJS, no peer deps. |
| `best-effort-json-parser` | 1.4.1 | ~61 KB unpacked | **Hold.** Lighter; parses *incomplete* JSON (truncation). Non-streamed responses rarely truncate → low value. |
| `untruncate-json` | 0.0.1 | ~38 KB unpacked | **Avoid.** 0.0.1, narrow scope (completes truncated prefixes only); non-streamed responses don't truncate. |
| `zod` / `zod/mini` | 4.4.3 | ~4.56 MB unpacked (mini ~1.9 KB gzip runtime) | **Avoid for this.** Overkill for a 2-field object; great DX for large evolving schemas only. |
| `ajv` | 8.20.0 | ~1.03 MB unpacked | **Avoid for this.** JSON-Schema-native (could consume your documented schema verbatim) but pulls a real compiler with codegen/`eval`-style concerns; heavy for one object. Reconsider only if a future milestone has many evolving contract variants. |

## Installation

```bash
# RECOMMENDED PATH: nothing to install.
# Contract, validator, and tolerant parser are hand-rolled in the Scribe module.

# ONLY IF the dev probe proves malformed JSON the hand-rolled parser can't fix:
# npm install jsonrepair@3.14.0
```

## The `response_format` safety question — clear recommendation

**Question:** Is it safe to send `response_format` optimistically to the unknown cozy-stack proxy?

**Answer: No — do not send it by default. Make it opt-in behind a dev probe + feature flag.**

What is verified vs not:

- **Client side is NOT the gatekeeper.** You call `fetchJSON('POST', '/ai/v1/chat/completions', { messages, temperature })` directly. `cozy-client`'s own `chatCompletion()` builds the body with `_objectSpread({ messages }, options)` (verified `node_modules/cozy-client/dist/models/ai.js:171`) — i.e. it does **not strip unknown fields**. So whatever you put in the body reaches cozy-stack. The only gatekeeper is cozy-stack/openRAG and the downstream provider.
- **cozy-stack passthrough is undocumented.** The official `/ai` docs only show `messages` + `temperature`; the `cozy-client` `ChatCompletionOptions` typedef (verified ai.js:73-81) lists only `stream`, `model`, `temperature`, `top_p`, `max_tokens`, `presence_penalty`, `frequency_penalty` — **no `response_format`, no `tools`, no `json_schema`**. Whether cozy-stack forwards, ignores, or rejects an unknown field is **unverified** (MEDIUM confidence it may be ignored; not safe to assume).
- **Failure mode if it IS forwarded is asymmetric — can be a hard 400, not a silent ignore:**
  - OpenAI **JSON mode** (`json_object`) returns **400** if no message contains the substring "json" — documented footgun (mitigated only if we keep "json" in the prompt).
  - OpenAI **Structured Outputs** (`json_schema`, strict) supported only on recent models (gpt-4o-2024-08-06+, gpt-4.1, o-series) → "unsupported model" 400s elsewhere.
  - Non-OpenAI OpenAI-compatible backends (vLLM, llama.cpp, Ollama, TGI) have **inconsistent** support and an unknown server may 400/422 on an unexpected field.
- **Conclusion:** Downside of optimistic-send = hard request failure on an unknown backend; upside (marginally more reliable JSON) is already covered by prompt contract + tolerant parser. **Default OFF.**
- **Recommended approach:** ship a **dev probe** (your planned "Sonde dev") that issues a trial request with `response_format: { type: 'json_object' }` and records (a) HTTP status, (b) whether output is valid JSON, (c) fragment-count behavior (0/1/N). If 200 + clean JSON, you may flip `flag__scribe.json_response_format` to send it; otherwise leave off and rely on the prompt contract. The UI must never depend on it.

## Tool/function-calling path — recommendation

**Do not use.** You *can* force a JSON shape via a single tool with `{discussion, fragments}` params + forced `tool_choice`, but:

- Requires the proxy to forward `tools` + `tool_choice` AND return `tool_calls` — even less likely to survive an unknown proxy than `response_format` (the cozy-client typedef doesn't even mention them).
- Moves the response from `choices[0].message.content` (your current line 165 extraction) to `choices[0].message.tool_calls[0].function.arguments`, complicating extraction and the fallback story.
- Zero benefit over `json_object` + prompt for a 2-field object.

Keep it on the "what NOT to add" list.

## Prompt-only JSON reliability (the baseline)

Without a JSON mode, prompt-only JSON is **good but not perfect** — the documented failure modes are exactly the ones a tiny tolerant parser handles:

| Failure mode | Frequency | Cheap fix (no dep) |
|--------------|-----------|--------------------|
| Wrapped in ```` ```json ... ``` ```` fence | Common | Strip leading/trailing fence before parse |
| Leading/trailing prose ("Here is the JSON: {...}") | Common | Extract first balanced `{...}` (brace counter, string/escape aware) |
| Trailing comma before `}`/`]` | Occasional | Regex `,(\s*[}\]])` → `$1`, re-parse |
| Single quotes / unquoted keys | Rare on instruct models | Punt to `jsonrepair` *only if probe shows it* |
| Truncation | Rare (non-streamed) | Out of scope; context-aware fallback catches it |

Free boosters: low `temperature` (already 0.3), a **single concrete worked example** in the system prompt (one-shot >> zero-shot for JSON adherence), explicit "respond with ONLY a JSON object, no markdown fences".

## Hand-rolled vs ajv vs zod — concrete trade-off

Your locked choice (hand-rolled) is correct. Numbers verified 2026-06-16:

| Approach | Version | Size | Fit for `{discussion: string, fragments?: string[]}` |
|----------|---------|------|------------------------------------------------------|
| **Hand-rolled guard** | n/a | ~15 LOC, 0 bytes | Perfect. `typeof obj.discussion === 'string'` + array-of-strings check. Debuggable, ES-portable, drives context-aware fallback. |
| `zod` (standard) | 4.4.3 | ~4.56 MB unpacked / ~5.9 KB gzip per simple schema | Overkill. |
| `zod/mini` | 4.4.3 | ~1.9 KB gzip | Smaller, still a dep + tree-shake concern for 2 fields. Not worth it. |
| `ajv` | 8.20.0 | ~1.03 MB unpacked | JSON-Schema-native but heavy compiler, codegen/`eval` concerns. |

**Verdict:** Hand-rolled validator; keep the JSON Schema as a committed documentation artifact (and reusable as the literal `json_schema` payload later). Reach for `ajv` only if a future milestone introduces many evolving contract variants where the schema should be the single executable source of truth.

## Tolerant parsing — roll your own vs a helper

**Roll your own** (~30 LOC). Realistic failure set (fences, prose-wrap, trailing comma) is small and cheap. Skeleton:

```
parseScribeResponse(raw):
  1. text = strip ```json / ``` fences (regex)
  2. try JSON.parse(text)                         // happy path
  3. extract first balanced { ... }               // brace counter, string/escape aware
  4. try JSON.parse(extracted)
  5. extracted = extracted.replace(/,(\s*[}\]])/g, '$1')   // trailing commas
  6. try JSON.parse(extracted)
  7. on total failure -> context-aware fallback (caller: popover vs chat)
```

Add `jsonrepair@3.14.0` **only if** the dev probe demonstrates malformed JSON (single quotes, unbalanced brackets) steps 1-6 can't recover. 508 KB unpacked for an edge case the fallback already handles is not justified up front.

## Integration points in `scribeAI.js`

File-specific guidance (current: `src/modules/views/OnlyOffice/Scribe/scribeAI.js`):

1. **`SYSTEM_PROMPT` (lines 24-33)** — append the JSON contract instruction. Keep the literal word **"json"** in it (required if `response_format: json_object` is ever enabled; harmless otherwise). Add one short worked example: `{"discussion": "...{{fragment:1}}...", "fragments": ["..."]}`. The existing marker rules (TABLE/CELL/footnote/REF) now apply *inside* `fragments[]` strings, never in `discussion`.
2. **`buildMessages` (lines 84-138)** — structure unchanged; new contract inlines via `systemPrefix`. Marker-conditional additions (lines 88-96) stay; clarify markers live inside fragment strings.
3. **`callScribeAI` (lines 155-172)** — currently sends `{ messages, temperature: 0.3 }`. Add an OPTIONAL flag-gated `response_format: { type: 'json_object' }`. Default OFF. After getting `content` (line 164-165), route it through the NEW `parseScribeResponse(content)` instead of returning raw string.
4. **NEW: `parseScribeResponse(content)`** — tolerant parse → hand-rolled validate → on failure, **context-aware fallback** (popover: whole text as a single fragment; chat: whole text as `discussion`, no fragments). This is your locked "repli contextuel".
5. **`classifyScribeError` (lines 227-264)** — add a branch for "valid HTTP 200 but unparseable/invalid contract" so the UI distinguishes a transport error from a contract miss (drives the re-ask hardening step). Note `chatCompletion` is bypassed (you use `fetchJSON` directly), so any new body field is sent verbatim — no cozy-client typedef change blocks you.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Prompt-only contract (default) | `response_format: json_object` | Only after dev probe confirms proxy forwards it + backend accepts; gate behind flag |
| Prompt-only contract | `response_format: json_schema` strict | Only if probe shows recent OpenAI/Azure or vLLM/llama.cpp guided decoding; never a requirement |
| JSON object via prompt | Tool/function-calling | Never for this milestone — heavier, less portable, no benefit |
| Hand-rolled validator | `ajv` | Future milestone with many evolving schema variants needing executable schema as source of truth |
| Hand-rolled tolerant parser | `jsonrepair@3.14.0` | Only if probe shows persistent malformed JSON (single quotes, broken brackets) the helper can't fix |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Sending `response_format` by default | Unknown backend may hard-400 (JSON mode needs "json" in prompt; non-OpenAI servers may 422 on unknown field); benefit covered by prompt + parser | Prompt-only by default; `response_format` opt-in behind dev probe + flag |
| `json_schema` strict as a *requirement* | Only recent OpenAI/Azure + some self-hosted engines support it; unknown proxy → non-portable | Optional bonus only |
| Tool/function-calling to force JSON | Heavier protocol, even less proxy-portable, complicates extraction, zero benefit for 2 fields | Plain JSON object via prompt |
| `zod` / `ajv` for validation | 1-4.5 MB deps to validate 2 fields; ajv codegen/`eval` concerns | Hand-rolled guard; JSON Schema as docs |
| `jsonrepair` / `untruncate-json` up front | Adds deps for failure modes the ~30-LOC parser + context fallback already cover; non-streamed → no truncation | Hand-rolled tolerant parser; add `jsonrepair` only if probe proves need |
| Streaming/partial-JSON parsers | Responses non-streamed (locked) — no truncation to recover | n/a |
| Modifying cozy-client `chatCompletion()` typedef | You bypass it with `fetchJSON`; body fields pass through verbatim | Send fields directly in the `fetchJSON` body |

## Stack Patterns by Variant

**If the dev probe shows the proxy forwards `response_format` AND returns clean JSON:**
- Enable `response_format: { type: 'json_object' }` behind `flag__scribe.json_response_format`.
- Keep the prompt contract (must contain "json") and the tolerant parser as belt-and-suspenders.

**If the probe shows the proxy ignores or 400s on `response_format` (expected default):**
- Ship prompt-only contract + tolerant parser + context-aware fallback. Zero deps.

**If a later milestone shows persistent malformed JSON:**
- Add `jsonrepair@3.14.0` as the last parse step before the context-aware fallback.

## Version Compatibility

| Package | Note |
|---------|------|
| (none added by default) | Recommended path adds zero runtime deps; nothing to reconcile with React 18 / cozy-client 60 / marked 17 / react-markdown 10. |
| `jsonrepair@3.14.0` | ESM+CJS, no peer deps, framework-agnostic — safe with the existing cozy-scripts/webpack build if ever added. |

## Sources

- `node_modules/cozy-client/dist/models/ai.js` (verified 2026-06-16) — `ChatCompletionOptions` typedef lists only stream/model/temperature/top_p/max_tokens/penalties (NO response_format/tools); `chatCompletion()` builds body via `_objectSpread({messages}, options)` (line 171) so unknown fields are NOT stripped client-side (HIGH)
- https://docs.cozy.io/en/cozy-stack/ai/ — official `/ai/v1/chat/completions` docs; only `messages` + `temperature` documented, no `response_format`/`tools` passthrough (MEDIUM — absence of docs, not proof of rejection)
- https://community.openai.com/t/is-the-gpt4-o-model-compatible-with-json-mode/760533 and https://portkey.ai/error-library/response-format-error-10006 — JSON mode model support + "must include json" 400 (HIGH)
- https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/json-mode — Azure JSON mode requirements mirror OpenAI (HIGH)
- https://docs.anyscale.com/llm/serving/structured-output and https://gigagpu.com/vllm-structured-output-guided-decoding/ — vLLM/llama.cpp/Ollama/TGI structured-output support varies (guided decoding, grammars, `format`) (MEDIUM)
- npm registry (verified 2026-06-16): jsonrepair@3.14.0 (~508KB unpacked), best-effort-json-parser@1.4.1 (~61KB), untruncate-json@0.0.1 (~38KB), zod@4.4.3 (~4.56MB unpacked), ajv@8.20.0 (~1.03MB) (HIGH)
- https://zod.dev/v4 and https://www.speakeasy.com/blog/release-zod-v4 — zod v4 / zod-mini sizes (~1.9KB gzip mini) (HIGH)
- https://github.com/josdejong/jsonrepair — maintenance/scope of jsonrepair (HIGH)

---
*Stack research for: v3.1 structured LLM JSON response contract over an unknown OpenAI-compatible proxy*
*Researched: 2026-06-16*
