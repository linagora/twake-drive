# Decisions

Decisions taken on Twake Drive (web), oldest first. Append only: a decision that changes gets a new entry that replaces the old one and cites it. Entry format: the `twake-decisions` skill of [linagora/twake-guidelines](https://github.com/linagora/twake-guidelines/blob/main/skills/twake-decisions/SKILL.md).

Categories: UX, UI, Product, Architecture, Infra, Tech.

## 2026-11-23, [UX] The scribe writes nothing in the document without a click

- Decision: what the scribe puts in the document, an answer or a call of a capability (a slide, a chart), waits for a click of the user: Insert, Replace or Apply under an answer, the button of the card of a call (`confirm: true`).
- Decided by: Paul Tran-Van, in a session with an agent (Claude Code), 2026-11-23
- Why: the user sees what goes in the document, and chooses to put it there.
- Scope: desktop and mobile, the scribe of OnlyOffice in text documents, presentations and spreadsheets; the cards of twake-assistant.

## 2026-11-23, [Product] A table comes in an answer, not through a capability

- Decision: a text document gives the assistant no `insert_table` capability; the "Make a table" chip asks for an answer, whose table the assistant shows as a table, under Insert and Replace.
- Decided by: Paul Tran-Van, in a session with an agent (Claude Code), 2026-11-23
- Why: a call showed no table before it was written, the production LLM seldom called it, and once in the history it made the LLM write its next tables as text rows.
- Scope: desktop and mobile, the scribe of OnlyOffice in text documents.
