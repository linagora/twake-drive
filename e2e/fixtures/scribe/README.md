# Selection cases of the scribe plugin

`e2e/tests/onlyoffice-scribe.spec.ts` plays these cases on the scribe plugin
of the Document Server (`plugins/onlyoffice-scribe`, see
`docs/onlyoffice-scribe.md`). Each case selects a text of a document, asks the
plugin for it as Drive does when its AI button is clicked
(`twake-scribe:getContent`), then has it write an answer
(`twake-scribe:applyAnswer`): no LLM, no assistant. The test then reads the
document from the editor and compares it with what is expected.

Most cases and documents come from the test harness of the scribe of
Benibur/cozy-drive (`test-harness/`): the expected results were written again
for the rules of this plugin, which inserts an answer under the selected text
instead of in its line.

## Files

- `<document>.docx`: a document, as small as the cases need.
- `<document>.cases.json`: its cases, `{ document, cases }`. A case has:
  - `id`: the name of the case in Benibur's harness, or a name of its own;
  - `selection`: what is selected, see below;
  - `answerAction`: `insert` or `replace`, or `null` when only the text the
    plugin gives is checked;
  - `answer`: the Markdown of the answer, as the LLM would write it;
  - `expected`: the text the plugin gives (`content`, `target`) and the
    document once written (`model`).

## Selections

A selection is one end, or two ends joined by `..`:

| End                         | What                                                                 |
| --------------------------- | -------------------------------------------------------------------- |
| `P<n>@<at>`                 | The n-th paragraph of the body, tables left out, 1-based             |
| `T<n>.C(<r>,<c>)@<at>`      | The first paragraph of the cell `r`, `c` (0-based) of the n-th table |
| `T<n>.C(<r>,<c>).P<m>@<at>` | The m-th paragraph of that cell                                      |
| `T<n>.full`                 | The whole table                                                      |

`<at>` is `start`, `end`, `mid`, `space` (after the first space) or an offset
in the text. From `start` to `end` of a paragraph, the paragraph is taken whole,
with a note or an image after its text; an offset ends the selection at a
character. One end alone is the cursor. From a cell to another cell or to a
paragraph, the cells are taken whole, as the editor does.

## The document read

`model` is the document as `e2e/helpers/scribeModel.ts` describes it: each
paragraph with its runs (text, bold `b`, italic `i`, underline `u`,
strikethrough `s`, `code`, `link`), its style when it is not Normal, its list
level and label, its images, notes and page breaks, whether it ends a section;
each table with its cells and their merges. The
selection is told by the text it covers (`selText`), and each paragraph it
touches with the selected text between `«` and `»` (`selMarkup`): the positions
of the editor are left out, since they count the empty runs.

## Running

The cases run with the end-to-end suite, see `docs/e2e.md`: its Document
Server has the plugin of the worktree, built by the global setup.

```sh
yarn e2e e2e/tests/onlyoffice-scribe.spec.ts --project=chromium
```

After a change of the plugin that changes a result on purpose, write what the
plugin does as the expected results, then check the diff of the `.cases.json`
files:

```sh
SCRIBE_UPDATE=1 yarn e2e e2e/tests/onlyoffice-scribe.spec.ts --project=chromium
```
