# Scribe Output Contract — `SCRIBE_OUTPUT_SCHEMA`

The structured response contract the Scribe LLM is asked to emit. The canonical
machine-readable form is the `SCRIBE_OUTPUT_SCHEMA` object exported from
[`scribeResponse.js`](./scribeResponse.js). This document is the human-readable
companion.

> **Documentation artifact only.** Runtime validation is the hand-rolled logic in
> `parseScribeResponse` (zero dependencies). This schema is *not* fed to a
> validator on the default path — it documents the contract and is the literal
> payload to paste into a future `response_format: { type: 'json_schema' }`
> structured-output request if a dev probe ever proves the proxy supports it.

## Shape

```json
{
  "discussion": "Conversational markdown. May contain {{fragment:N}} markers.",
  "fragments": ["insertable markdown fragment 0", "insertable markdown fragment 1"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `discussion` | `string` | yes | Conversational markdown shown to the user. May embed `{{fragment:N}}` position markers. |
| `fragments` | `string[]` | no (defaults to `[]`) | Insertable markdown fragments. Element `N` corresponds to marker `{{fragment:N}}`. |

## The `{{fragment:N}}` marker convention

- **0-indexed.** `{{fragment:0}}` is the first fragment, i.e. it resolves to
  `fragments[0]`.
- Markers live **inside `discussion`** to indicate where each insertable
  fragment belongs in the conversational flow.
- `parseScribeResponse` cross-checks markers against `fragments.length` and
  records non-fatal warnings (`fragment-marker-out-of-range`,
  `fragment-not-referenced`) — it never throws on a mismatch.

## Non-collision rule with `{{REF:scribe-ref-N:…}}` (CONTRACT-04)

The existing cross-reference marker convention is
`{{REF:scribe-ref-N:visible text}}`. The `{{fragment:N}}` grammar
(`FRAGMENT_MARKER_RE` = `/\{\{fragment:(\d+)\}\}/g`) is anchored on the literal
channel name `fragment:` followed by digits and `}}`. It is **strict and
linear** — never a greedy `\{\{.+?\}\}` — so it can never match, capture, or
alter a `{{REF:scribe-ref-N:…}}` marker. Fragment bodies that themselves contain
`{{REF:…}}` markers are preserved byte-for-byte through `parseScribeResponse`.

## Markers that belong inside `fragments[]`, never in `discussion`

The rich-reinjection markers (`[TABLE:N]…[/TABLE]`, `[CELL:r,c]…[/CELL]`,
`[^scribe-fn-N]` footnotes, `{{REF:scribe-ref-N:…}}` cross-refs) apply **inside
fragment strings**. `parseScribeResponse` flags a fragment with unbalanced
table/cell markers via a non-fatal `split-table` warning (`valid: false`).
