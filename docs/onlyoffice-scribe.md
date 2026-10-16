# Scribe in OnlyOffice

The scribe is the AI assistant opened beside an office document, on a text of that document. The user picks a prompt of the assistant (translate, summarize, improve, fix, make shorter, make longer) or types a request, then puts an answer back in the document with one click. A table or a new slide the user asks for goes in the document at once.

Drive does not talk to the LLM, and does not read or format the document. It links two parts:

- the **Assistant intent** of Twake Assistant (`OPEN` on `io.cozy.ai.chat.conversations`), which shows the assistant and hands its answers back;
- the **scribe plugin** of the OnlyOffice Document Server (`plugins/onlyoffice-scribe`), which reads the selection and writes the answers with the styles of the document.

```
Drive (OnlyOffice view)
  ├─ AI button of the toolbar ── opens ──▶ side panel
  │                                          └─ Assistant intent (iframe of Twake Assistant)
  │                                               content, answerActions, capabilities, suggestions ◀── Drive
  │                                               result { answerAction, text } ──▶ Drive
  │                                               result { capability, params } ──▶ Drive
  └─ editor (iframe of the Document Server)
       └─ scribe plugin (iframe, in the background)
            twake-scribe:getContent, twake-scribe:applyAnswer,
            twake-scribe:insertSlide ◀── Drive
            twake-scribe:ready, twake-scribe:content ──▶ Drive
```

## For the user

- The AI button is in the toolbar of the document, for a text document, a presentation or a spreadsheet the user can edit.
- With the flag `cozy.assistant.enabled`, the editor has no AI tab of its own: Drive leaves out the AI plugin of OnlyOffice (`editorConfig.plugins.disable`), which would sit beside the assistant.
- A click opens the assistant in a panel beside the document. Another click, or the cross of the panel, closes it.
- With a selection, the assistant works on the selected text, and each answer can be inserted under it or can replace it. An answer is text: a selection that holds an image, a chart, an equation, a footnote, a field, a form, a comment or a page break, or that crosses a table or the end of a section, can only have the answers inserted under it.
- Without a selection, the assistant works on the whole document, and each answer can be inserted under the paragraph of the cursor. Nothing replaces a whole document.
- The text written in the document is left selected: the next answer of the conversation can replace it.
- Another text selected while the panel is open is the one the next request is about: the conversation goes on, and the prompts are offered again. A click that only moves the cursor changes nothing.

- Above the composer, the assistant offers its prompts, then a chip of the editor: "Make a table" in a text document, "New slide" in a presentation. A spreadsheet has its own chips only: "Explain", "Clean up", "Add totals", "Make a chart".

In a text document the user can also ask for a table, from the text or from what they say: it is added under the text, with a header row, see [New tables](#new-tables).

In a presentation the scribe works on the current slide: the selected text, the text of a selected shape, or the whole slide. See [Presentations](#presentations). The user can also ask for a new slide, added after the current one, see [New slides](#new-slides).

In a spreadsheet the scribe works on the selected cells, or on the block of data around the selected cell. An answer has a single action, "Apply", which writes its cells where they go: in place of the cells it changes, under or beside the data for the ones it adds. See [Spreadsheets](#spreadsheets). The user can also ask for a chart of the cells, of any type the editor makes, added beside the data, see [New charts](#new-charts).

## When the button is shown

All of these are needed:

- the scribe plugin is installed on the Document Server, and has said it is ready;
- the flag `cozy.assistant.enabled` is on;
- the document is not opened from a public link, and the user can edit it.

The plugin only loads in the editors of text documents, presentations and spreadsheets, in edit mode. Without it Drive is unchanged.

## Requirements

- The flag `cozy.assistant.enabled` on. Without it the AI button is not shown, and Drive is unchanged.
- The Twake Assistant app ([linagora/twake-assistant](https://github.com/linagora/twake-assistant), slug `assistant`) installed on the instance. It serves the Assistant intent in scribe mode, and reads the `capabilities`, `suggestions` and `instructions` of its data. The button does not check that the app is installed. An assistant that does not read `instructions` sends the requests on cells with its own instructions, written for a text: the LLM may then write figures it computed instead of formulas.
- A cozy-stack that knows the `documents` and `instructions` options of the chat.
- A `cozy-interapp` and a `cozy-ui-plus` that have the `result` message of intents (`onResult` prop of `IntentIframe`). With older ones the assistant opens, but the clicks on its action buttons do not reach Drive.
- For another text while the panel is open, a `cozy-interapp` with the `data` message on both sides, and a `cozy-ui-plus` whose `IntentIframe` sends new `data`. With older ones the assistant keeps the first text.
- An OnlyOffice Document Server 9.0 or later, with the scribe plugin. It was tested with 9.4.

## The scribe plugin

The plugin is a background plugin of the document editor: it has no interface of its own.

| File | Role |
| --- | --- |
| `config.json` | Manifest of the plugin |
| `index.html` | Page of the plugin, loads the scripts as modules |
| `scripts/scribe.js` | Messages with Drive |
| `scripts/markdown.js` | Turns the Markdown of an answer into blocks: paragraphs, headings, quotes, list items and tables |
| `scripts/document.js` | Functions run inside the text editor: read the text, write the blocks |
| `scripts/presentation.js` | Functions run inside the presentation editor: read a slide, write lines in its shapes |
| `scripts/grid.js` | Turns cells into the text of the assistant, and an answer into the cells to write |
| `scripts/spreadsheet.js` | Functions run inside the spreadsheet editor: read the selected cells, write the cells of an answer |

It relies on the editor for both ways:

- the text given to the assistant is the Markdown the editor makes of the selection, or of the whole document (`ApiDocument.ToMarkdown`). A part of a paragraph is given without the mark of the paragraph (`#`, `-`, `1.`, `>`) the editor adds, which is not in its text: the assistant would write a heading for a word of a heading;
- an answer is written with the document builder API: a heading gets the heading style of the document, a list its numbering, a text written in a line the look of the text it replaces. No HTML is pasted, and the raw HTML of an answer is never run.

An answer the LLM gives as a whole in a code fence or in `"""` quotes, as it often does with an HTML table, is read without them. A fence in another language than `markdown`, `html` or `text` is code.

### Build and install

```sh
yarn build:onlyoffice-scribe
```

This writes the plugin in `plugins/onlyoffice-scribe/build`, with the Markdown reader it imports (`marked`). Copy that folder in the plugins of the Document Server, under a name of its own:

```sh
cp -r plugins/onlyoffice-scribe/build /var/www/onlyoffice/documentserver/sdkjs-plugins/twake-scribe
```

The Document Server lists the plugins of that folder by itself. It serves its static files, the plugins included, under an address that changes when it starts: restart it, or run `documentserver-flush-cache.sh`, for the browsers to load a new version of the plugin.

### Messages

Drive and the plugin talk with `postMessage`. Drive only listens to the origin of the Document Server, and the plugin only to the window that shows the editor.

| Direction | `type` | Fields | Meaning |
| --- | --- | --- | --- |
| Plugin → Drive | `twake-scribe:ready` | — | The plugin is loaded. Drive shows the AI button. |
| Drive → Plugin | `twake-scribe:getContent` | — | Asks for the text to work on. |
| Plugin → Drive | `twake-scribe:content` | `content`, `target`, `canReplace` | The text in Markdown, what it is (`selection`, or `document` without a selection; in a spreadsheet `selection`, or `region` for the block around a cell), and whether an answer can take its place. Drive opens the panel with it. |
| Plugin → Drive | `twake-scribe:selection` | `content`, `target`, `canReplace` | Another text selected, once Drive has asked for one: not for a cursor that moves, nor for an answer just written. Drive gives it to the open assistant (new `data` of the intent). |
| Drive → Plugin | `twake-scribe:close` | — | The panel is closed: the plugin stops reading the selection, until Drive asks for the text again. |
| Drive → Plugin | `twake-scribe:applyAnswer` | `answerAction`, `text`, `format` | A result of the Assistant intent, as it is, or the table of an `insert_table` call, written in Markdown by Drive. The plugin writes `text`, in Markdown, in the document; in a spreadsheet, the cells of `text` (`answerAction: 'apply'`). |
| Drive → Plugin | `twake-scribe:insertSlide` | `title`, `bullets` | A slide the assistant has made, checked by Drive. The plugin adds it after the current slide. Presentations only. |
| Drive → Plugin | `twake-scribe:insertChart` | `chartType`, `range`, `title` | A chart the assistant has made, checked by Drive. The plugin adds it beside the data. Spreadsheets only. |

`content` is the `content` of the Assistant intent, and the fields of `applyAnswer` are those of its result.

### Where an answer is written

| `answerAction` | Selection | Result |
| --- | --- | --- |
| `replace` | Whole paragraphs | The answer takes their place: a single paragraph in the line, keeping the paragraph, its blocks otherwise. |
| `replace` | A part of a paragraph | A single block is written in the line: the editor gives a part of a heading or of a list item with its mark, which the answer keeps. Several blocks are written as a pasted text, see below. |
| `replace` | Parts of paragraphs | The answer is written as a pasted text: its first paragraph continues the text before the selection, its last one the text after it, both in the style of their paragraph. A heading, a list item or a table of the answer stays a block of its own. |
| `replace` | A text that `canReplace` refuses, or none | Same as `insert`. |
| any other | A text | The answer is written in new paragraphs, under the last paragraph of the selection, or under the table when the selection takes cells and more than one cell. |
| any other | None | The answer is written in new paragraphs, under the paragraph of the cursor, in its cell when it is in a table. |

An empty paragraph where the answer goes, as the one of an empty document, takes the answer itself; a paragraph that holds only a page break, an image or a field, or that ends a section, is not empty, and one between a table and a table of the answer stays, to keep the two tables apart. Whole paragraphs replaced by several blocks leave the end of their last paragraph after them: it is removed when empty, and kept when it holds a note or an image that followed the text, or the end of a section. The spaces around a part of a paragraph are kept: the answer of a LLM never has them. A selection that starts at the end of a line does not take the paragraph of that line. List items written in place of items of a list stay in that list, numbered after the items above them; a heading numbered by its style is no list. The answer is left selected.

A text written in place of another one has the look of its first character, as a text typed over it; new paragraphs have the look of most of the text of the paragraph above them, so that a word in italics or a link does not give its look to the answer. The emphasis is the one of the answer.

The plugin checks `canReplace` again before it replaces a text: it never replaces a selection that holds what an answer cannot give back, even when Drive asks, nor a selection the editor was too busy to read.

### Tables

The tables are given and taken in the HTML tags of the Markdown of the editor, with the `colspan` and `rowspan` of the cells merged with others, the way a browser and a LLM know them.

| Selection | Answer | Result |
| --- | --- | --- |
| A table, a row, cells | A table with the same rows and cells | Written in the cells, which keep their look: the table keeps its style and its merged cells. |
| A whole table | A table of another shape, or any other blocks | Takes the place of the table. |
| Some cells | Anything else | Written under the table. |
| A text, or the cursor, in a cell | An answer with a table | Written under the table: the editor would write a table in a table over its cells. |
| A text | A table | A new table, with the merged cells of the answer. |

### Presentations

The editor of presentations has neither the Markdown of the text editor nor its ranges, and a slide has no flow of text: the plugin works on the paragraphs of its shapes, which keep their look (font, size, bullet).

What the assistant gets, as `content`:

| Selection | Content | `target` |
| --- | --- | --- |
| A text | The selected lines, one paragraph each (a title as a heading `# `) | `selection` |
| One shape | Its paragraphs | `selection` |
| Nothing, or several shapes | The whole slide: each shape, its title as a heading, one line per paragraph | `slide` |

The text of a selection is read with the editor's `GetSelectedText`; the slide with the builder API. Whole paragraphs are given with the emphasis set on their text, as in a text document (`**bold**`, `*italic*`, `~~strikethrough~~`). The look a text takes from its shape, as the bold of a title, is not an emphasis. A part of a paragraph is given as plain text.

What is done with an answer, read as lines. A line is written in the look of the paragraph it replaces, or of the one it is a copy of: the look of most of its text (font, size, color), so that a word set apart, as a word in color, does not give its look to the whole line. The bold, italic and strikethrough of the answer are set over it.

| `answerAction` | Selection | Result |
| --- | --- | --- |
| `replace` | Whole paragraphs, or a shape | The lines take the place of the paragraphs: the first ones are rewritten, the others added as copies of the last one, or removed. |
| `replace` | A part of a paragraph | The editor replaces the selected text (`ReplaceTextSmart`), the rest of the paragraph kept. The text is written plain, in the look of the text around it. |
| `insert` | A text | New paragraphs under the last selected one, copies of it. |
| `insert` | Nothing | New paragraphs at the end of the body of the slide (the first shape with text that is not its title). |

A line of the answer is a paragraph: a line break of the Markdown breaks the paragraph, unlike in a text document. The first paragraph written is left selected, and the plugin keeps all of them: the next answer takes their place while the selection is still on them.

### Spreadsheets

The editor of spreadsheets has no Markdown, and a cell holds a value, the formula that gives it and the format that shows it. The LLM computes badly: a sum or a rate must be a formula the editor computes, not a figure the LLM made up. So the assistant sees the cells as a Markdown table with their addresses, and answers with a table whose addresses say where each cell goes.

#### What the assistant gets

```
Sheet "Budget", cells A1:D5

|   | A | B | C | D |
|---|---|---|---|---|
| 1 | Poste | T1 | T2 | Total |
| 2 | Loyer | 1,200.00 € | 1,200.00 € | 2,400.00 € |
...
| 5 | Total | 2,150.00 € | 2,330.00 € | 4,480.00 € |

Formulas:
D2: =B2+C2
...
D5: =SUM(D2:D4)
```

- The header row holds the letters of the columns, the first column the numbers of the rows: they are not cells. A cell is given as the editor shows it, its number format applied; a pipe is escaped, a line break is `<br>`. Its formula, in English, is listed after the table.
- `target` is `selection` for the selected cells (the first area of a selection of several), `region` for the block of data around a single selected cell (`GetCurrentRegion`, as Ctrl+A): the first line names that cell (`cells A1:C5, around B3`). An empty cell alone is `cell D10, empty: the cells of an answer start there`.
- A range of more than 1000 cells, as a whole column, is cut to the cells in use, then to its first rows: the first line tells it (`only A1:C333 given`).
- Drive gives the LLM its own instructions for a spreadsheet, in the `instructions` of the intent, which the assistant sends in place of its own, written for a text (`makeInstructions`): answer with a Markdown table of the cells to write, at the same letters and numbers, a computed value as a formula in English, never a figure computed by the LLM; a question in a few sentences; a request that asks both, as "make the ratio, then tell who is the best", the table first, then the sentences under it. They also settle what the LLM hesitates on: whether to give the unchanged cells, the label of a new column, a new row above a total row, a value the user gives.

#### Where the cells of an answer go

The plugin reads the cells of the answer (`readAnswerCells`):

- its first table, at the addresses of its letters and numbers. The LLM gives the whole range back, or only the cells it changes or adds;
- a table without letters nor numbers is laid from the top-left cell of the range;
- a table of cells by address, one per row under a header as `| Address | Value |`, at those addresses. The header tells it: a label as `T1` or `Q2` looks like an address;
- without a table, lines of formulas are laid under the range, in its first column, or at an empty cell. Any other text is an explanation, even a single line: nothing is written for it;
- a formula given on a line with its address, as the content lists them (`D5: =B5+C5`), takes its cell over the value of the table;
- an empty cell of the answer is not given: the LLM leaves a cell empty to keep it as it is. The scribe never empties a cell.

Then it plans the writing (`planSheetWrite`), and writes it in one command, one step of the undo:

- a cell whose text is the one the cell shows, its formula, or the same number written another way (`1 200,00 €`, `1200`) is left untouched: a translation changes the labels only, the totals stay formulas;
- a cell of the range is written;
- a cell under the range is written when it is empty; when one of them holds something, whole rows are inserted under the range first, as many as the answer has rows there, so that nothing is overwritten. Beside the range, whole columns, the same way;
- a cell above or left of the range that holds something is kept;
- a text starting with `=` is a formula. The editor reads it in English, whatever the language of its formulas: by default it is the language of the editor, `SOMME` and `;` in French. Another text is written as typed, read with the locale of the editor, and keeps the number format of its cell.

The range and the cells written are left selected: they are not other cells to work on.

#### While the panel is open

Other cells selected become the ones the next request is about, as another text. A click on a single cell moves the cursor: it changes nothing, the answers still go in the cells last given. Each selection is read with a command, which empties the redo of the editor: while the panel is open, a click on a cell costs the redo. A selection made through the API of the editor is not seen: the editor tells the plugins only of a selection of the user.

The editor runs no command while it saves or loads: the reading and the writing of an answer are sent again every 500 ms for 5 s.

### Capabilities and suggestions

Beside its `answerActions`, Drive gives the Assistant intent what the editor can do, from `src/modules/views/OnlyOffice/Scribe/capabilities.js`, keyed by the `documentType` of the OnlyOffice config:

- `capabilities`: a description for the LLM of each thing the editor can add, with its parameters as a JSON schema and instructions to fill them. The LLM picks one when the request of the user needs it, and the call comes back as a result of the intent, `{ capability, params }`, as soon as the LLM proposes it (`confirm: false`): there is no card to confirm, since the editor undoes a slide or a table in one step.
- `suggestions`: the chips above the composer. The menu of the assistant (`{ name: 'catalogue' }`: correct, improve, tone, translate, summarize) comes first, then a chip that asks for the capability with a request of Drive, shown in the conversation as the message of the user.

| Editor (`documentType`) | Capability | Chip | Request of the chip |
| --- | --- | --- | --- |
| Presentation (`slide`) | `insert_slide`, `{ title, bullets }` | New slide | Add a new slide after this one, about the text |
| Text document (`word`) | `insert_table`, `{ caption, columns, rows }` | Make a table | Present the text as a table |
| Spreadsheet (`cell`) | `insert_chart`, `{ type, range, title }`; formulas, rows and columns come as cells of an answer | Explain, Clean up, Add totals, Make a chart | Explain what these cells and their formulas do; Fix the typos and make the spelling, the case and the format of these cells consistent; Add a total row under the data, with formulas; Make a chart of these cells |

A spreadsheet has no menu of the assistant, whose prompts are written for a text: its chips are sent with the instructions of a spreadsheet, as any request on its cells. Another editor gets neither key: the assistant shows its own menu. The labels and the requests of the chips are translated by Drive (`OnlyOffice.scribe.suggestions`); what the LLM reads is in English, whatever the language of the user.

Drive checks each call: an unknown capability, one of another editor, parameters of the wrong type, or an empty slide or table are left out, with a warning in the console.

### New slides

A slide comes back as `{ capability: 'insert_slide', params: { title, bullets } }`. A slide with neither a title nor a bullet is left out, and the marks the LLM may still put before the bullets are taken off. Drive then sends `twake-scribe:insertSlide` to the plugin.

The plugin adds the slide right after the current one, and makes it the current slide. Its layout is, in the master of the current slide:

1. the "title and content" layout (`obj`), or else the "title and text" one (`tx`);
2. or else the layout of the current slide, if it has a title and a body;
3. or else the first layout with a title and a body;
4. or else the layout of the current slide.

The title is written in the title placeholder, the bullets as the paragraphs of the body placeholder (the subtitle on a title slide): they keep the look of the layout. A text the layout has no placeholder for is written in a text box. An empty title or no bullets leave their placeholder empty.

### New tables

A table comes back as `{ capability: 'insert_table', params: { caption, columns, rows } }`: the header of each column, and the data rows as strings whose cells are separated by `|`. Drive lays the cells of each row on the columns (`normalizeTable`): a row too short is padded with empty cells, a row longer than the header widens the table with empty header cells, since the LLM sometimes splits in two cells what it named as one column, an empty row is dropped, and a row the LLM wrote as a line of a Markdown table, with its outer pipes or as the separator line, is read as such. A table without a column or without a row is left out.

Drive then writes the table in Markdown (`makeTableMarkdown`), the caption as the paragraph above it and a pipe in a cell escaped, and sends it to the plugin as an answer to insert: `twake-scribe:applyAnswer` with `{ answerAction: 'insert', text, format: 'markdown' }`. The plugin needs nothing more: it writes it as it writes the tables of any answer, see [Tables](#tables), a table of the document with its header row in bold, under the paragraph of the cursor or under the last paragraph of the selection, and the caption in a paragraph above it. Nothing is replaced: a table is always inserted.

### New charts

A chart comes back as `{ capability: 'insert_chart', params: { type, range, title } }`. The stack gives the LLM a type and a description for each parameter, and no list of values: the description names the families of charts and how the editor names their variants, the instructions of the capability tell which one fits which data. Drive takes any of the 32 types the editor makes (`CHART_TYPES`, the `ChartType` of its API: bars, horizontal bars, lines, pies, doughnuts, scatters, areas, stocks, and their stacked, percent, 3D and marker variants), whatever their case, and `line`, `column` or `horizontal` for the plain ones (`normalizeChart`). Another type is left out, with a warning in the console. The range may have several areas, as `A1:A5,C1:C5` for the names and one column of values. A range that is no A1 range is dropped: the chart is then of the cells given to the assistant. Drive then sends `twake-scribe:insertChart` to the plugin.

The plugin adds the chart in the sheet of the cells given to the assistant, in one step of the undo, 12 cm by 7 cm, with its title in bold:

- its data is the range, the row of the headers and the column of the names with the values. Its series run along the longer side of the range, as in the editor: the columns of a range taller than wide. The editor takes the first column of one block for the names, but not the first area of several: a chart of several areas is made of their box, then the series of the cells between them are removed;
- it goes one empty column after the last cell used on its rows, so that it covers no data, at the first row of its data;
- under a chart or a shape already there, past one empty row.

The cells and the selection are left as they are. The capabilities of Drive keep within the limits the stack sets on actions (300 characters for a parameter, 1000 for a description or instructions, 5 examples with the requests of the chips): the stack refuses every message of the conversation for an action past them.

A request is either cells or a chart: "make the ratio, then a chart of it" takes two messages, since the stack calls a capability or answers.

## Limits

- Text documents, presentations and spreadsheets only: the plugin does not load in PDF forms.
- In a spreadsheet the scribe reads and writes the text of the cells and their formulas, not their look: no bold, color, border or number format from an answer. The charts of the sheet are not read, nor changed: a chart is only added. Comments, filters, data validation and pivot tables are neither read nor written, and a selected chart counts as no selection. A workbook is never given whole: one sheet, one range, at most 1000 cells.
- An answer is bounded by the limits the stack and the LLM set on a request. A request that needs a long answer, as the translation of a whole sheet, can come cut or empty: Apply writes only the cells given before the cut, and an empty answer has nothing to apply.
- The LLM decides where the cells of its answer go: a wrong address writes a wrong cell, undone in one step. Rows or columns inserted to make room shift what is beside the data too, as the user would. A cell of a merge is written on its first cell, and a protected sheet refuses the writing.
- While the panel is open, the plugin reads every other text the user selects with `callCommand`, and a command of a plugin empties the redo of the editor. It reads a selection only when its text changes, and not for 3 s after an undo or a redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, or the buttons of the toolbar), so a redo right after an undo works. Another text selected later is read, and the redo is lost. Once the panel is closed, nothing is read.
- A paragraph that replaces several ones has the default paragraph style of the document: the alignment or the spacing set by hand on the replaced paragraphs are not kept. A text replaced in its line keeps them.
- The images of an answer are not loaded: their alternative text is written.
- In a presentation, the look of a word set apart from the rest of its paragraph (a color, a size) is not kept when the paragraph is replaced, nor the emphasis of an answer written in a part of a paragraph. A table is written one row per line, and the scribe does not add shapes or speaker notes: the builder API has no access to the notes. It adds a slide only through the `insert_slide` capability, with a title and bullets.
- A table the assistant makes through `insert_table` has a header row and plain rows: no merged cells, unlike a table written in an answer. The capability tells the LLM to change a table of the selection in an answer instead, which takes its place.
