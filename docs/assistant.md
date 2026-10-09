# The assistant in the file list

The AI assistant opens beside the file list of Drive, through the Assistant intent of Twake Assistant (`OPEN` on `io.cozy.ai.chat.conversations`), on the documents of the user, with what Drive can do in the folder the user is looking at. The assistant proposes a call of one of these capabilities when a request needs it; the user confirms it, and Drive runs it.

```
Drive (folder view)
  └─ assistant button of the toolbar ── opens ──▶ side panel
                                                    └─ Assistant intent (iframe of Twake Assistant)
                                                         capabilities, documents: true, theme ◀── Drive
                                                         result { capability, params, text } ──▶ Drive
```

The scribe of the OnlyOffice editor is another use of the same intent, on a text of the document: see [the scribe in OnlyOffice](onlyoffice-scribe.md). The intent and its data are specified in [the Assistant intent](https://github.com/linagora/twake-assistant/blob/main/docs/assistant-intent.md).

## For the user

- The assistant button is in the toolbar of the file list, with the flag `cozy.assistant.enabled`. A click opens the assistant in a card beside the list; another click, or the close button of the assistant, closes it.
- The assistant answers from the documents of the user, with their sources. The user can turn the documents off in the composer.
- A request for a folder ("crée un dossier Factures 2026") or for a document ("rédige un rapport d'avancement du projet Atlas à partir de mes fichiers") gets a card: the name of the folder, or the document written by the assistant and its title, with a button. On the click, Drive creates the folder, or saves the document as a `.docx`, in the folder the user is looking at, and tells it with an alert. The list shows the new item.

## The capabilities

`src/modules/views/Drive/Assistant/capabilities.js` holds the definitions, written for the LLM in English, with the label of the button translated:

| Capability | Parameters | Run by Drive |
| --- | --- | --- |
| `create_folder` | `name` | `io.cozy.files` directory in the displayed folder (the root when the user is in the trash or in no folder) |
| `create_document` | content written by the assistant: `title`, and the Markdown `text` | `.docx` built from the Markdown (`markdownToDocx.js`), uploaded in the displayed folder, renamed on a conflict |

Both ask for a confirmation: they create something the user cannot take back by undoing.

A call Drive cannot use, for a capability it did not give or with params it cannot read, is logged and left alone.

## Code

| File | Role |
| --- | --- |
| `AssistantProvider.jsx` | The state of the panel, and `applyResult`, which runs a call |
| `AssistantPanel.jsx` | The panel, with `IntentIframe` of cozy-ui-plus |
| `AssistantLayout.jsx` | The file list and the panel side by side |
| `AssistantButton.jsx` | The button of the toolbar |
| `capabilities.js` | The definitions, and the checks of the params |
| `markdown.js`, `markdownToDocx.js` | The Markdown parser and the `.docx` writer of the documents |

## Requirements

- An app that serves the Assistant intent with capabilities, and a cozy-stack that knows the `actions` of the chat.
- A `cozy-interapp` and a `cozy-ui-plus` with the `result` message of intents (`onResult` prop of `IntentIframe`).
