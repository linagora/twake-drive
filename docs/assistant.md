# The assistant in the file list

The AI assistant opens beside the file list of Drive, through the Assistant intent of Twake Assistant (`OPEN` on `io.cozy.ai.chat.conversations`), on the documents of the user.

```
Drive (folder view)
  └─ assistant button of the toolbar ── opens ──▶ side panel
                                                    └─ Assistant intent (iframe of Twake Assistant)
                                                         documents: true, theme ◀── Drive
```

The scribe of the OnlyOffice editor is another use of the same intent, on a text of the document: see [the scribe in OnlyOffice](onlyoffice-scribe.md). The intent and its data are specified in [the Assistant intent](https://github.com/linagora/twake-assistant/blob/main/docs/assistant-intent.md).

## For the user

- The assistant button is in the toolbar of the file list, with the flag `cozy.assistant.enabled`. A click opens the assistant in a card beside the list; another click, or the close button of the assistant, closes it.
- The assistant answers from the documents of the user, with their sources. The user can turn the documents off in the composer.

## Code

| File | Role |
| --- | --- |
| `AssistantProvider.jsx` | The state of the panel |
| `AssistantPanel.jsx` | The panel, with `IntentIframe` of cozy-ui-plus |
| `AssistantLayout.jsx` | The file list and the panel side by side |
| `AssistantButton.jsx` | The button of the toolbar |

## Requirements

- An app that serves the Assistant intent.
