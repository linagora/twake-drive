# Scribe in OnlyOffice

The scribe is the AI assistant opened beside an office document, on a text of that document. The user picks a prompt of the assistant (translate, summarize, improve, fix, make shorter, make longer) or types a request, then puts an answer back in the document with one click. A table or a new slide the user asks for goes in the document at once.

Drive does not talk to the LLM, and does not read or format the document. It links two parts:

- the **Assistant intent** of Twake Assistant (`OPEN` on `io.cozy.ai.chat.conversations`), which shows the assistant and hands its answers back;
- the **scribe plugin** of the OnlyOffice Document Server (`plugins/onlyoffice-scribe`), which reads the selection and writes the answers with the styles of the document.

```
Drive (OnlyOffice view)
  ├─ AI button of the toolbar ── opens ──▶ side panel
  ├─ floating button of the document area ── opens or closes ──▶ side panel
  ├─ button under the selection ── opens ──▶ popover on the selection (drawer on a small screen)
  │                                          └─ Assistant intent (iframe of Twake Assistant), in either
  │                                               content, answerActions, capabilities, suggestions,
  │                                               theme, layout, source, draft, conversation ◀── Drive
  │                                               result { answerAction, text } ──▶ Drive
  │                                               result { capability, params } ──▶ Drive
  │                                               result { request: 'panel', draft, conversation } ──▶ Drive
  └─ editor (iframe of the Document Server)
       ├─ entries of its toolbar ── open or close ──▶ side panel or popover, through the plugin
       └─ scribe plugin (iframe, in the background)
            twake-scribe:getContent, twake-scribe:close,
            twake-scribe:applyAnswer, twake-scribe:insertSlide,
            twake-scribe:showToolbar ◀── Drive
            twake-scribe:ready, twake-scribe:content,
            twake-scribe:selection, twake-scribe:applied,
            twake-scribe:geometry, twake-scribe:open ──▶ Drive
```

## For the user

- The AI button is in the toolbar of the document, for a text document or a presentation the user can edit.
- With the flag `cozy.assistant.enabled`, the editor has no AI tab of its own: Drive leaves out the AI plugin of OnlyOffice (`editorConfig.plugins.disable`), which would sit beside the assistant.
- A click opens the assistant in a panel beside the document. Another click, or the cross of the panel, closes it.
- A text selected in a text document shows a small sparkle button under its end, "Scribe Menu": a click opens the assistant on it in a popover, see [The button under the selection](#the-button-under-the-selection).
- The popover, "Scribe Menu", opens 12 px under the selected text, or above it without room, and dims the rest of the page. It holds a compact assistant: its prompts, a "Scribe panel" row, the composer, then the latest exchange only. Escape, a click elsewhere in Drive, a click in the document that leaves a cursor, or another text selected close it. The "Scribe panel" row moves the conversation to the panel, with the text being written in the composer; the popover closes. On a small screen the popover is a drawer at the bottom of the screen, closed by a tap on its grip, a swipe down, a tap out of it, or Escape. See [The popover](#the-popover).
- A text document also has a floating button, "Scribe Panel", 12 px inside the top right corner of the area that shows the document, faded until the pointer is over it. Its mark plays while the pointer is over it, unless the system asks for reduced motion. A click opens the panel, or closes it. Until the plugin has given the place of that area, the button waits in the bottom right corner of the window. A presentation has none: the plugin gives no geometry there.
- Where the AI button is shown, the toolbar of the editor has the scribe too: a "Scribe" button in its Plugins tab, and an "Assistant" tab with "Inline Scribe" and "Scribe panel". "Scribe" and "Inline Scribe" open the popover on the selected text, and do nothing without a selection. "Scribe panel" opens the panel, or closes it. See [The entries of the editor's toolbar](#the-entries-of-the-editors-toolbar).
- With a selection, the assistant works on the selected text, and each answer can be inserted after it or can replace it. An answer is text, so a selection that holds what it cannot give back can only have the answers inserted after it: a chart, an equation, an endnote, a field, a content control or a form, a comment, a page or column break, a footnote in a cell of a table or in a code, or an image the plugin cannot give a marker. So can a selection that crosses the end of a section, or the edges of more than two tables or of a table in a table. See [What an answer can replace](#what-an-answer-can-replace).
- The underlined text of the selection is given between `<u>` tags, and its footnotes, its links to a heading or a bookmark of the document and its images as markers. They are written back where the answer keeps them, as underlined text, new notes, links and copies of the images, see [Markers](#markers).
- Without a selection, the assistant works on the whole document, and each answer can be inserted at the cursor. Nothing replaces a whole document.
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

The entries of the scribe in the toolbar of the editor follow the same rule: Drive asks the plugin for them only then, see [The entries of the editor's toolbar](#the-entries-of-the-editors-toolbar).

The plugin only loads in the editors of text documents and presentations, in edit mode. Without it Drive is unchanged.

## Requirements

- The flag `cozy.assistant.enabled` on. Without it the AI button is not shown, and Drive is unchanged.
- The Twake Assistant app ([linagora/twake-assistant](https://github.com/linagora/twake-assistant), slug `assistant`) installed on the instance. It serves the Assistant intent in scribe mode, and reads the `capabilities` and `suggestions` of its data. The button does not check that the app is installed. For the popover, an assistant that reads `layout`, `draft` and `conversation`: an older one shows its panel layout in the popover, without the "Scribe panel" row.
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
| `scripts/scribe.js` | Messages with Drive; sends the functions below to the editor |
| `scripts/markdown.js` | Turns the Markdown of an answer into blocks (paragraphs, headings, quotes, list items, blocks of code, tables and images) with its markers, and into lines for a presentation |
| `scripts/document.js` | Functions run inside the text editor: read the text with its markers, write the blocks and the copies of the images |
| `scripts/markers.js` | Function run inside the text editor, in the command that writes an answer, once it is written: write the notes and the links of its markers |
| `scripts/geometry.js` | Reads where the selection is drawn, from the page of the editor and without a command, see [The button under the selection](#the-button-under-the-selection) |
| `scripts/toolbar.js` | The entries of the scribe in the toolbar of the editor, and their labels, see [The entries of the editor's toolbar](#the-entries-of-the-editors-toolbar) |
| `scripts/presentation.js` | Functions run inside the presentation editor: read a slide, write lines in its shapes |
| `resources/` | The icons of the entries of the editor's toolbar, for the light and the dark themes |

It relies on the editor for both ways:

- the text given to the assistant is the Markdown the editor makes of the selection, or of the whole document (`ApiDocument.ToMarkdown`). A part of a paragraph is given without the mark of the paragraph (`#`, `-`, `1.`, `>`) the editor adds, which is not in its text: the assistant would write a heading for a word of a heading. What that Markdown leaves out, or gives in a form of its own, as the underline, the footnotes, the links to a place of the document and the images, is given as markers, see [Markers](#markers);
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

Drive and the plugin talk with `postMessage`. Drive only listens to the origin of the Document Server and, once the plugin has said it is ready, to the window of the plugin only: another plugin of the Document Server has the same origin. `twake-scribe:ready` itself is trusted on its origin alone, since it is what gives Drive the window of the plugin, which changes when the editor starts the plugin again; every later message also checks that window. The plugin only listens to the window that shows the editor. The plugin sends its messages to the origin of Drive only: the first one, before Drive has written to it, to the origin the `api.js` of the Document Server gives the editor (`parentOrigin` in the address of its frame).

| Direction | `type` | Fields | Meaning |
| --- | --- | --- | --- |
| Plugin → Drive | `twake-scribe:ready` | — | The plugin is loaded. Drive shows the AI button. Not sent when the editor has no `parentOrigin`. |
| Drive → Plugin | `twake-scribe:showToolbar` | — | Sent once the plugin is ready, where Drive shows its AI button (see [When the button is shown](#when-the-button-is-shown)). The plugin adds its entries to the toolbar of the editor, once. Without it, the editor shows none, see [The entries of the editor's toolbar](#the-entries-of-the-editors-toolbar). |
| Drive → Plugin | `twake-scribe:getContent` | — | Asks for the text to work on. |
| Plugin → Drive | `twake-scribe:content` | `content`, `target`, `canReplace` | The text in Markdown, what it is (`selection`, `document` without a selection, or `slide` in a presentation, see [Presentations](#presentations)), and whether an answer can take its place, see [What an answer can replace](#what-an-answer-can-replace). A presentation sends no `canReplace`: a selection of a slide can always be replaced. Drive opens with it the panel or the popover it asked the text for. |
| Plugin → Drive | `twake-scribe:selection` | `content`, `target`, `canReplace` | Another text selected, once Drive has asked for one: not for a cursor that moves, nor for an answer just written. Drive gives it to the open assistant of the panel (new `data` of the intent), and closes the popover when the text is not the one it opened on. |
| Drive → Plugin | `twake-scribe:close` | — | Neither the panel nor the popover stays open, nor is awaiting its text: the plugin stops reading the selection, until Drive asks for the text again. |
| Drive → Plugin | `twake-scribe:applyAnswer` | `answerAction`, `text`, `format` | A result of the Assistant intent, as it is, or the table of an `insert_table` call, written in Markdown by Drive. The plugin writes `text`, in Markdown, in the document. |
| Plugin → Drive | `twake-scribe:applied` | `skippedCells` | The answer of an `applyAnswer` is handled, once Drive has asked for the text and until the panel is closed. `skippedCells` counts the selected cells the answer had no cell for (see [Tables](#tables)), 0 otherwise. |
| Drive → Plugin | `twake-scribe:insertSlide` | `title`, `bullets` | A slide the assistant has made, checked by Drive. The plugin adds it after the current slide. Presentations only. |
| Plugin → Drive | `twake-scribe:geometry` | `selection`, `viewer`, `page` | Where the selection is, in pixels of the editor frame, sent from the start and each time it changes. Drive shows its button under the selection with it, see [The button under the selection](#the-button-under-the-selection), and places its popover, see [The popover](#the-popover). |
| Plugin → Drive | `twake-scribe:open` | `source` | An entry of the editor's toolbar is clicked: `toolbar-inline` for "Scribe" or "Inline Scribe" with a text selected, `toolbar-panel` for "Scribe panel". Drive opens the popover for `toolbar-inline`, and the panel for `toolbar-panel`, or closes it when it is open, where its AI button is shown (see [When the button is shown](#when-the-button-is-shown)), and does nothing elsewhere. |

`content` is the `content` of the Assistant intent, and the fields of `applyAnswer` are those of its result.

### The button under the selection

The plugin reads where the selection is drawn from the page of the editor, without a command, which would empty the redo: `editor.asc_GetSelectionBounds()` and the box of `#id_viewer`. It sends `twake-scribe:geometry` when a selection ends (the editor starts the plugin again, and the plugin reads the selected text with `GetSelectedText`), when the editor moves its cursor (`onTargetPositionChanged`), zooms (`asc_onZoomChange`) or resizes its viewer, and every 125 ms while a text is selected, since the editor tells no scroll. A geometry that has not changed is not sent again.

- `selection`: `{ rect: { left, top, width, height, corners }, hasText }`, or `null` for a cursor alone (its start has no height), a selection without text (an image alone), and while the editor has no document. `corners` are the four corners the editor gives (start top, start bottom, end top, end bottom), moved from the top left of its viewer, where the editor counts them, to the top left of its frame; `rect` is their box. A selection that ends at the start of a paragraph has a box with no width: it is still a selection.
- `viewer`: the box of `#id_viewer` in the frame, the part of the editor that shows the document.
- `page`: `null`.

The answer the plugin has just written is left selected, and gets its button. Another selection made by code, and not by the user, may not start the plugin, as one the builder API makes from the page of the editor: it gets its button once the user changes it. The presentation editor has no `asc_GetSelectionBounds`: a presentation has no button under its selection.

Drive adds the box of the editor frame, taken when a geometry comes and when the window is resized. It shows a sparkle button 4 px below and right of the end of the selection (`corners[3]`), over the editor, while the AI button is shown (see [When the button is shown](#when-the-button-is-shown)), the selection has text, the disc of the button is inside the viewer (a selection scrolled out of it has no button), and the popover is closed. A click opens the popover on the selection.

### The popover

`openPopover` asks the plugin for the text, as the panel does; the content that comes back opens the popover instead of the panel. The popover needs the place of the selection, which the plugin gives in a text document only: without a selection in the last geometry, as in a presentation, the panel opens instead.

- On a large screen, a `Popper` of cozy-ui anchored to the part of the selection rect inside the viewer, moved by the box of the editor frame: a selection scrolled out of the viewer leaves the popover at its edge. It goes 12 px under the selection, from its left edge (`bottom-start`), flips above it without room, and keeps 8 px from the edges of the window, with an arrow toward the selection. A veil dims the page under it, and lets the clicks through to the document. The card is 380 px wide, and as high as the compact assistant says in its `resize` messages, which `cozy-interapp` sets on the element of the intent: at least 120 px, at most `min(500px, 70vh)`, scrolled beyond.
- On a small screen (`isMobile` of cozy-ui), a `Drawer` at the bottom, at most 85 % of the screen high, with a grip.

The assistant is the same intent as in the panel, with `layout: 'compact'` and the `source` it was opened from (`selection` or `editor-toolbar`). A click in the editor does not reach Drive: the popover closes on what the plugin tells instead, a geometry whose selection is `null` (a cursor) or a `twake-scribe:selection` with another text. It also closes on Escape while the focus is in the page of Drive (the assistant closes itself on Escape in its composer), on a click elsewhere in Drive, and when the assistant cancels. The button under the selection is hidden while it is open.

The "Scribe panel" row of the compact assistant sends `{ request: 'panel', draft, conversation }`. Drive closes the popover and opens the panel on a new intent, with that `draft` and `conversation` in its data and `source: 'popover'`; it never sends them to an open intent, which reads them at its opening only. The panel goes on with the text of the popover, without asking the plugin again: another text selected would have closed the popover. The draft and the conversation are forgotten once the panel closes.

The panel and the popover can be open at once. `twake-scribe:close` is sent once neither is open, nor awaiting its text.

The compact assistant is a single card: the popover cannot be dragged nor resized.

### The data of the intent

Drive gives the Assistant intent, in the panel and in the popover:

- `content`, the text of the plugin, and `answerActions`, see [What an answer can replace](#what-an-answer-can-replace);
- `capabilities` and `suggestions`, see [Capabilities and suggestions](#capabilities-and-suggestions);
- `theme`, the theme of Drive;
- `layout`: `panel`, or `compact` in the popover;
- `source`: where the scribe was opened from, `toolbar` (the AI button), `floating`, `selection`, `editor-toolbar`, `restored` (the panel open at the last visit) or `popover` (the panel the popover handed over to). The assistant does not act on it;
- `draft` and `conversation`, only in the panel the popover hands over to.

The assistant reads `layout`, `source`, `draft` and `conversation` at its opening only.

### The entries of the editor's toolbar

When Drive sends `twake-scribe:showToolbar`, the plugin adds its entries to the toolbar of the editor, once, with the `AddToolbarMenuItem` method of the plugin API (Document Server 8.1 or later): a "Scribe" button in the Plugins tab (`scribe`), and an "Assistant" tab (`scribeAssistantTab`) with "Inline Scribe" (`scribeInline`) and "Scribe panel" (`scribePanel`). The editor sends a click to a plugin only for an event it has asked for: the plugin listens to `onToolbarMenuClick` with `attachEditorEvent`.

- "Scribe" and "Inline Scribe" read the selected text with `GetSelectedText`, a method of the editor and not a command, when clicked. With a text selected, the plugin sends `twake-scribe:open` with `source: 'toolbar-inline'`; without one, nothing.
- "Scribe panel" always sends `twake-scribe:open` with `source: 'toolbar-panel'`.

Drive records the panel or the popover as opened from `editor-toolbar`. The editor shows the texts as they are given: the plugin labels the entries in French when the `lang` of the editor's address starts with `fr`, in English otherwise. The icons are the images of `resources/`, at their address next to the page of the plugin, in the version of the current theme of the editor (light or dark); `config.json` gives the icon of "Scribe" to the plugin in the list of background plugins of the editor. The entries are locked in view mode (`lockInViewMode`).

The plugin cannot know whether the app that shows the editor offers the scribe: it adds no entry until it is asked. On a public link, in a read-only document, without the flag `cozy.assistant.enabled`, or in another app that shows the same Document Server, nothing sends `twake-scribe:showToolbar`, and the editor has no entry of the scribe. Drive also ignores `twake-scribe:open` there.

### What an answer can replace

A `replace` answer takes the place of the selection when `canReplace` is true, and is written as an `insert` otherwise; across the edge of a table, only an answer with a table takes the place of the selection, see [Where an answer is written](#where-an-answer-is-written). `canReplace` is false for the whole document, and for a selection that holds what an answer cannot give back:

- a chart, an equation, an endnote, a field, a content control or a form, a comment, a page or column break;
- the end of a section, in any paragraph but the last;
- a footnote in a cell of a table or in a code, which gets no marker, and an image that gets none, see [Markers](#markers);
- a selection across the edge of a table that takes the cells of more than two tables, or of a table in a table;
- a part the editor does not let change, as a locked content control.

The plugin checks `canReplace` again before it replaces a text: it never replaces a selection that holds what an answer cannot give back, even when Drive asks, nor a selection the editor was too busy to read.

### Where an answer is written

| `answerAction` | Selection | Result |
| --- | --- | --- |
| `replace` | Whole paragraphs | The answer takes their place: a single paragraph in the line, keeping the paragraph, its blocks otherwise. |
| `replace` | A part of a paragraph | A single block, except a table or a block of code, is written in the line, whatever its kind: the paragraph keeps its style, as a heading or a list item. Another answer is written as a pasted text, as for parts of paragraphs. |
| `replace` | Parts of paragraphs | The answer is written as a pasted text: a plain paragraph at its start continues the text before the selection, one at its end the text after it, both in the style of their paragraph. Any other block (a heading, a quote, a list item, a block of code, an image, a table) stays a block of its own. |
| `replace` | Across the edge of a table: a text and cells, or the cells of two tables | An answer with a table takes its place, see [Tables](#tables). Another answer, as a summary, is written as for `insert`, and `canReplace` stays true. |
| `replace` | A text that `canReplace` refuses, or none | Same as `insert`. |
| any other | A text | The answer is written at the end of the selection, as at a cursor. An answer with a table is written in new paragraphs under the last paragraph of the selection. When the selection ends in a table, the answer goes under the table if the selection takes more than one cell, or a cell and a text outside it, and an answer with a table goes there in any case, see [Tables](#tables). |
| any other | None (cursor in a text) | A single paragraph is written in the line at the cursor, with the space the text needs on each side. Another answer without a table splits the paragraph, as a pasted text: a plain paragraph at its start or end joins the text on that side. At the end of a paragraph, in an empty one, where the cursor is not found, or when the answer has a table, the answer is written in new paragraphs under the paragraph, in its cell when it is in a table (a table there goes under the table, see [Tables](#tables)). |

A text inserted in a line, at the cursor or at the end of a selection, is kept apart from the text around it: a space before it when the character before is not a space, one after it likewise, never two. The spaces are selected with the answer.

The editor gives no position for a cursor, only the text of its sentence on each side: the plugin finds the cursor there. Where it cannot, the answer is written in new paragraphs under the paragraph: in a sentence that holds an image or a field, in an inline content control, in a sentence that occurs twice in the run of the cursor.

An empty paragraph where the answer goes, as the one of an empty document, takes the answer itself; a paragraph that holds only a page break, an image or a field, or that ends a section, is not empty, and one between a table and a table of the answer stays, to keep the two tables apart. Whole paragraphs replaced by several blocks leave the end of their last paragraph after them: it is removed when empty, and kept when it holds a note or an image that followed the text, or the end of a section. The spaces around a part of a paragraph are kept: the answer of a LLM never has them. A selection that starts at the end of a line does not take the paragraph of that line. List items written in place of items of a list stay in that list, numbered after the items above them; a heading numbered by its style is no list. The answer is left selected.

A text written in place of another one has the look of its first character, as a text typed over it; new paragraphs have the look of most of the text of the paragraph above them, so that a word in italics or a link does not give its look to the answer. The emphasis is the one of the answer. A block of code is written as a paragraph per line, in Courier New, light on a dark shading, in the size of the text around it; in a cell, as the lines of a paragraph in Courier New. The code paragraphs of a selection are given to the assistant as a single fenced block.

### Markers

The Markdown of the editor leaves out the underline and the reference of a footnote, gives a link to a place of the document as `[text]()` and a picture as `![](its address)`. The plugin gives them to the assistant as markers, numbered from 1 in the order of the document, and writes back the markers an answer keeps.

| In the selection | Marker | In the answer, it becomes |
| --- | --- | --- |
| An underlined text | `<u>text</u>` | The text, underlined |
| A footnote | `[^scribe-fn-1]`, where its reference is | A new note at the marker |
| A link to a heading or a bookmark of the document | `{{REF:scribe-ref-1:text}}` | The text the answer gives the marker, as a link to the place the link went to |
| An image, a picture or another drawing as a shape | `![image 1]` | A copy of the image |

What holds for every marker:

- A marker the answer keeps twice gives two notes, two links, two copies.
- A note, a link or an image whose marker the answer leaves out is not written.
- A marker the text did not give is removed for a note, leaves its text plain for a link, and is written as `[image]` for an image.
- A marker, or a `<u>` tag, in a code of the answer stays text. In a cell of a table of the answer, the marker of a note or of a link stays text, and the marker of an image is a copy in that cell.
- The notes, the links and the images are written with the answer, in the same command: one undo takes them all away.

**Underline.** A text between `<u>` tags in the answer is written underlined, and so is a link whose whole text is. The plugin leaves the tags out where they would be text or break the Markdown, in a block of code, in a part of a code span and where they would break the marks of an emphasis: that text is given without its underline.

**Notes.** A new note has the plain text of the first paragraph of the note it stood for. An answer inserted after its text gives the note again. A note in a cell of a table or in a code gets no marker, and the selection that holds it is not replaced.

**Links to a place of the document.** The editor gives such a link as `[text]()`, with its text as it is, and the marker has that text: `{{REF:scribe-ref-1:text}}` for the first one. Each marker the answer keeps becomes a link of the text the answer gives it, to the place the link went to: its bookmark, the hidden one that Word and the editor put on a heading included, unless the answer replaced the text that held it. A link to a heading whose bookmark is gone, as when the answer rewrote the heading, goes to the heading of its name: its anchor without the leading `_`, a `_` for each space, in any case. That heading gets one bookmark for all the markers that go to it, `scribe_heading_N` for the marker N, or the next free number. A marker whose place is not found leaves its text plain. A link in a cell of a table or in a code, cut by the selection, or whose text holds a `}` or a line break, gets no marker: an answer gives back its text without the link.

**Images.** The images of the selection are numbered in the order of the document; a picture of the whole document, which has no selection, is given as `[image]`. The Markdown of the editor gives each picture as `![](its address)`, which the marker takes the place of, and no other drawing: the marker of one is put after the text before it. Each marker the answer keeps becomes a copy of its image at its place: a floating image keeps its wrapping, and the copy takes the alternative text, the name and the link of the image. A paragraph of a single marker is a paragraph of the image. The next answer of the conversation, written over the answer left selected, names the images the same way: its marker is a copy of the image the answer wrote for that marker. Every marker of an answer is written as `[image]` where the selection does not hold as many images as its markers name, as after an undo or a redo: the markers may name other images. Where the plugin cannot place every image of the selection, or the Markdown does not give each picture, as a picture in code, no image gets a marker and each picture is given as `[image]`; an image in a code gets none either. A selection with an image that gets no marker is not replaced.

### Tables

The tables are given and taken in the HTML tags of the Markdown of the editor, with the `colspan` and `rowspan` of the cells merged with others, the way a browser and a LLM know them. A table in Markdown pipes is taken too, without merged cells.

| Selection | Answer | Result |
| --- | --- | --- |
| Two cells or more of a table, a row, a whole table, to replace | A table with the same rows and cells | Written in the cells, which keep their look: the table keeps its style and its merged cells. |
| A whole table, to replace | A table of another shape, or other blocks | Takes the place of the table. A table of the answer is a copy of the table, see below. |
| Cells or a whole table, to insert after, or cells to replace by a table of another shape | A table | Written under the table, as a copy of it, see below. |
| Some cells, or a whole table to insert after | Any other answer | Written under the table. |
| A text, or the cursor, in a cell | An answer with a table | Written under the table, as a new table: the editor would write a table in a table over its cells. |
| A text | A table | A new table, 100 % wide with single borders, with the merged cells of the answer. |
| A text and cells of one or two tables, or cells of two tables, to replace | At least a table | Each table of the answer is written in the selected cells of a table, in order, row by row, and the cells keep their look; a whole table selected, with a table of another shape, is replaced by a copy of it in that shape, see below. Each other block takes the place of the selected text of a paragraph, in order, in its line: the text around it is kept. A selected cell without a cell of the answer, and a selected text without a block, stay as they were; the cell is counted in `twake-scribe:applied`. A block of the answer with no selected text or table is not written. The text and the cells are left selected. |

A table of the answer written under the table of the selection, or in place of a whole table, is a copy of that table when it can be: it keeps the style, the borders, the widths and the fonts.

- The copy of the selected cells is cut down to their rows and columns. Then, as the copy of a whole table, it is given the shape of the answer: its last rows and columns are removed, or new ones added after them in their look.
- Each cell takes the text of the answer in the look of the text it replaces, with the emphasis of the answer added. A cell the answer leaves empty is emptied: an image of a cell is kept by its marker.
- A table with merged cells, with a table in a cell or with rows of different lengths is neither cut down nor given another shape. A table of the shape of the selected cells, to insert after such a table, is a copy of the whole table, with those cells rewritten and left selected. Any other table of the answer gives a new table, as for a text.
- A table of the answer with merged cells, for a table without, gives a new table too.

When an answer with a table replaces a selection across the edge of a table, `twake-scribe:applied` carries the count of the selected cells the answer had no cell for. It is 0 for any other answer.

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

### Both editors

- Text documents and presentations only: the plugin does not load in spreadsheets and PDF forms.
- While the panel is open, the plugin reads every other text the user selects with `callCommand`, and a command of a plugin empties the redo of the editor. It reads a selection only when its text changes, and not for 3 s after an undo or a redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, or the buttons of the toolbar), so a redo right after an undo works. Another text selected later is read, and the redo is lost. Once the panel is closed, nothing is read.

### Text documents

- A paragraph that replaces several ones has the default paragraph style of the document: the alignment or the spacing set by hand on the replaced paragraphs are not kept. A text replaced in its line keeps them.
- A table the assistant makes through `insert_table` has a header row and plain rows: no merged cells, unlike a table written in an answer. The capability tells the LLM to change a table of the selection in an answer instead, which takes its place.

### Notes and links

- A note written back keeps the first paragraph of its note as plain text, a tab or a line break as a space: its other paragraphs, its look, and what it holds besides text are lost, and a note with a mark of its own, as `*`, comes back with an automatic number.
- A paragraph that holds only a footnote reference gives its marker to the next paragraph.
- In an answer that has notes or links to a place of the document, a footnote reference or an image at the very start or end is left out of the answer left selected: the next answer that replaces it gets no marker for the note, and writes the markers of the image as `[image]`, the image staying beside it.
- A link whose anchor the document lost, and that names no heading, is written as its text. A link to a heading whose bookmark is gone finds the heading only when its anchor holds the whole text of the heading: the editor names the bookmark of a heading after its first ten characters. A link to a hidden bookmark that is not on a heading, as the `_Ref…` that Word puts on a caption, is given back as its text without the link.
- A bold or italic link reaches the assistant without its emphasis: the editor writes no emphasis marks inside a link.

### Images

- An image of an answer is written only from its marker: another one is not loaded, and its alternative text is written.
- An image whose marker the answer leaves out is lost when the answer replaces its text.
- An image of the selection that the editor's Markdown does not give, as a shape, gets its marker after the text before it, and gives it to the next paragraph when its own paragraph has no text.
- A copy loses the stacking order of a floating image among the others, its size relative to the page, and the outline of a tight wrapping, which keeps its type.
- The plugin tells the images of the selection apart by their count and their order only: an answer written over another selection that holds as many images, and that was not read again because its text is the same, copies the images of that selection.

### In presentations

- In a presentation, the look of a word set apart from the rest of its paragraph (a color, a size) is not kept when the paragraph is replaced, nor the emphasis of an answer written in a part of a paragraph. A table is written one row per line, and the scribe does not add shapes or speaker notes: the builder API has no access to the notes. It adds a slide only through the `insert_slide` capability, with a title and bullets.
