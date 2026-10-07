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

- The AI button is in the toolbar of the document, for a text document or a presentation the user can edit.
- A click opens the assistant in a panel beside the document. Another click, or the cross of the panel, closes it.
- With a selection, the assistant works on the selected text, and each answer can be inserted under it or can replace it.
- Without a selection, the assistant works on the whole document, and each answer can be inserted under the paragraph of the cursor. Nothing replaces a whole document.
- The text written in the document is left selected: the next answer of the conversation can replace it.
- Another text selected while the panel is open is the one the next request is about: the conversation goes on, and the prompts are offered again. A click that only moves the cursor changes nothing.

- Above the composer, the assistant offers its prompts, then a chip of the editor: "Make a table" in a text document, "New slide" in a presentation.

In a text document the user can also ask for a table, from the text or from what they say: it is added under the text, with a header row, see [New tables](#new-tables).

In a presentation the scribe works on the current slide: the selected text, the text of a selected shape, or the whole slide. See [Presentations](#presentations). The user can also ask for a new slide, added after the current one, see [New slides](#new-slides).

## When the button is shown

All of these are needed:

- the scribe plugin is installed on the Document Server, and has said it is ready;
- the flag `cozy.assistant.enabled` is on;
- the document is not opened from a public link, and the user can edit it.

The plugin only loads in the editors of text documents and presentations, in edit mode. Without it Drive is unchanged.

## Requirements

- The flag `cozy.assistant.enabled` on. Without it the AI button is not shown, and Drive is unchanged.
- The Twake Assistant app ([linagora/twake-assistant](https://github.com/linagora/twake-assistant), slug `assistant`) installed on the instance. It serves the Assistant intent in scribe mode, and reads the `capabilities` and `suggestions` of its data. The button does not check that the app is installed.
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

It relies on the editor for both ways:

- the text given to the assistant is the Markdown the editor makes of the selection, or of the whole document (`ApiDocument.ToMarkdown`);
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
| Plugin → Drive | `twake-scribe:content` | `content`, `target` | The text in Markdown, and what it is: `selection`, or `document` without a selection. Drive opens the panel with it. |
| Plugin → Drive | `twake-scribe:selection` | `content`, `target` | Another text selected, once Drive has asked for one: not for a cursor that moves, nor for an answer just written. Drive gives it to the open assistant (new `data` of the intent). |
| Drive → Plugin | `twake-scribe:applyAnswer` | `answerAction`, `text`, `format` | A result of the Assistant intent, as it is, or the table of an `insert_table` call, written in Markdown by Drive. The plugin writes `text`, in Markdown, in the document. |
| Drive → Plugin | `twake-scribe:insertSlide` | `title`, `bullets` | A slide the assistant has made, checked by Drive. The plugin adds it after the current slide. Presentations only. |

`content` is the `content` of the Assistant intent, and the fields of `applyAnswer` are those of its result.

### Where an answer is written

| `answerAction` | Selection | Result |
| --- | --- | --- |
| `replace` | A text | The answer takes the place of the text. A single paragraph is written in the line, whole blocks otherwise. |
| `replace` | None | Same as `insert`. |
| any other | A text | The answer is written in new paragraphs, under the last paragraph of the selection. |
| any other | None | The answer is written in new paragraphs, under the paragraph of the cursor. |

The answer is left selected.

### Tables

The tables are given and taken in the HTML tags of the Markdown of the editor, with the `colspan` and `rowspan` of the cells merged with others, the way a browser and a LLM know them.

| Selection | Answer | Result |
| --- | --- | --- |
| A table, a row, cells | A table with the same rows and cells | Written in the cells, which keep their look: the table keeps its style and its merged cells. |
| A whole table | A table of another shape, or any other blocks | Takes the place of the table. |
| Some cells | Anything else | Written under the table. |
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

### Capabilities and suggestions

Beside its `answerActions`, Drive gives the Assistant intent what the editor can do, from `src/modules/views/OnlyOffice/Scribe/capabilities.js`, keyed by the `documentType` of the OnlyOffice config:

- `capabilities`: a description for the LLM of each thing the editor can add, with its parameters as a JSON schema and instructions to fill them. The LLM picks one when the request of the user needs it, and the call comes back as a result of the intent, `{ capability, params }`, as soon as the LLM proposes it (`confirm: false`): there is no card to confirm, since the editor undoes a slide or a table in one step.
- `suggestions`: the chips above the composer. The menu of the assistant (`{ name: 'catalogue' }`: correct, improve, tone, translate, summarize) comes first, then a chip that asks for the capability with a request of Drive, shown in the conversation as the message of the user.

| Editor (`documentType`) | Capability | Chip | Request of the chip |
| --- | --- | --- | --- |
| Presentation (`slide`) | `insert_slide`, `{ title, bullets }` | New slide | Add a new slide after this one, about the text |
| Text document (`word`) | `insert_table`, `{ caption, columns, rows }` | Make a table | Present the text as a table |

Another editor gets neither key: the assistant shows its own menu. The labels and the requests of the chips are translated by Drive (`OnlyOffice.scribe.suggestions`); what the LLM reads is in English, whatever the language of the user.

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

## Limits

- Text documents and presentations only: the plugin does not load in spreadsheets and PDF forms.
- While the panel is open, the plugin reads every other text the user selects with `callCommand`, and a command of a plugin empties the redo of the editor. The plugin does not read the selection for 3 s after an undo or a redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, or the buttons of the toolbar), so a redo right after an undo works. A text selected later is read, and the redo is lost.
- A paragraph that replaces several ones has the default paragraph style of the document: the alignment or the spacing set by hand on the replaced paragraphs are not kept. A text replaced in its line keeps them.
- The images of an answer are not loaded: their alternative text is written.
- In a presentation, the look of a word set apart from the rest of its paragraph (a color, a size) is not kept when the paragraph is replaced, nor the emphasis of an answer written in a part of a paragraph. A table is written one row per line, and the scribe does not add shapes or speaker notes: the builder API has no access to the notes. It adds a slide only through the `insert_slide` capability, with a title and bullets.
- A table the assistant makes through `insert_table` has a header row and plain rows: no merged cells, unlike a table written in an answer.
