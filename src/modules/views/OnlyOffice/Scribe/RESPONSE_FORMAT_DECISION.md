# `response_format` Default Decision (HARDEN-02 / D-06)

**Decision:** Keep `response_format: { type: 'json_object' }` as the default for
Scribe LLM calls. Defer `json_schema` (full structured output) as a documented
future option, not activated in this phase.

**Status:** Decided 2026-06-24 (v3.1-06-02). Supersedes the earlier "proxy
unknown" caution in STATE/PROJECT — the proxy question is now resolved (see below).

---

## The default today

`callScribeAI` (`scribeAI.js` ~l.279) sends:

```js
{ messages, temperature: 0.3, response_format: { type: 'json_object' } }
```

to `POST /ai/v1/chat/completions` (OpenAI-compatible, proxied by cozy-stack to the
upstream RAG server). `json_object` instructs the model to emit a syntactically
valid JSON object. The Scribe *contract* (the `{ discussion, fragments[] }` shape)
is enforced client-side by the hand-rolled `parseScribeResponse`
(`scribeResponse.js`), **not** by a server-side schema validator.

## Proxy-forwarding fact (the previously-open dependency — now CONFIRMED)

CONTEXT.md (D-06, deferred §l.95) listed "proxy forwards the parameter to the
model" as the open dependency blocking any `response_format` reasoning. It is now
**verified forwarded**:

- The cozy-stack RAG proxy `CallRAGQuery` (`model/rag/chat.go` ~l.446-464) builds
  the upstream request with `bytes.NewReader(payload)` and `http.DefaultClient.Do`,
  forwarding the **POST body UNCHANGED**. It does not parse, filter, rewrite, or
  strip `response_format` (or a future `json_schema`) from the payload.
- **Therefore `response_format` DOES reach the upstream model today.** A future
  `json_schema` payload would reach it the same way.

**Consequence:** keeping `json_object` is the **low-risk** choice, *not* a proxy
limitation. The proxy is transparent; the body we send is the body the model sees.

## Why `json_schema` is deferred (a model-capability question, not a proxy one)

Now that the proxy is confirmed transparent, the only open question for
`json_schema` activation is whether the **upstream model**
(Mistral-Small-3.2-24B, behind the RAG proxy) actually *honors* `json_schema`
structured-output constraints (strict schema-constrained decoding) rather than
silently ignoring the field. That is a model-capability question to confirm
empirically (e.g. via the dev probe / GATE harness), not a transport question.

Until that is confirmed:

- `json_object` already yields a measured-acceptable conformance (the v2 contract
  block PASSES all GATE blockers, STATE.md §GATE; the residual fence/preamble
  defects are absorbed by `parseScribeResponse` + the v3.1-06-01 re-ask).
- Switching to `json_schema` before confirming model support risks regressing
  prose quality (the contract already isolates free-form `discussion` from the
  constrained `fragments[]` channel precisely to avoid prose degradation under
  JSON constraint) with no measured upside.

## The ready `json_schema` payload

`SCRIBE_OUTPUT_SCHEMA` (exported from `scribeResponse.js`, documented in
[`SCRIBE_OUTPUT_SCHEMA.md`](./SCRIBE_OUTPUT_SCHEMA.md)) is the literal,
draft-07 payload to paste into a future
`response_format: { type: 'json_schema', json_schema: { schema: SCRIBE_OUTPUT_SCHEMA } }`
request once model support is confirmed. No new schema authoring is required to
activate it — only a flag/opt-in and an empirical model-capability check.

---

## Code-fence `fellBack` re-measure (D-08) — recorded result

The ~2% `fellBack` reliquat noted in STATE.md ("model wraps JSON in a ```json
fence") was **re-measured at 0% fallback** over a static fence corpus and found
**already closed by the existing `stripFence`** (`scribeResponse.js` ~l.88) — no
extension was needed, the regexes stay anchored/linear (ReDoS contract preserved).

The re-measure is driven by the `fellBack rate` describe block in
`scribeResponse.corpus.spec.js`, which asserts `fellBack === false` for every
`fence`-category fixture. The fence shapes tested are:

| # | Fence shape tested | Result |
|---|--------------------|--------|
| 1 | ```` ```json ```` + language tag, standard newlines | `fellBack=false` |
| 2 | ```` ```json ```` + trailing whitespace and blank lines after the object | `fellBack=false` |
| 3 | ```` ```json ```` with **no** trailing newline before the closing ```` ``` ```` | `fellBack=false` |
| 4 | bare ```` ``` ```` fence with no language tag | `fellBack=false` |
| 5 | **VERBATIM real-reliquat sample observed in STATE.md** (model wraps the `{discussion, fragments}` JSON in a ```` ```json ```` fence, with a `{{fragment:0}}` marker) | `fellBack=false` |

Shape #5 anchors the 0% claim to a real model output, not only author-invented
shapes the existing `stripFence` happens to already handle — so the
"fellBack re-measured at 0%" claim is auditable against the originally-observed
reliquat. A confirming comment recording this finding was added at the
`stripFence` definition in `scribeResponse.js` (no behavior change).
