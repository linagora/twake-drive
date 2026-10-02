# Move Intent

This document specifies the standalone **Move intent** for moving an already-uploaded local file to a destination selected in Drive. It is a draft for collaborative review, not a statement that the proposed behavior is already implemented.

It assumes you already know how to create and run a Cozy intent (requesting an intent, loading the returned service URL, and handling the generic `ready` / `done` / `error` / `cancel` postMessage flow). It only documents what is specific to the Move service.

## Intent identity

Request this intent to move a file:

```ts
action = 'MOVE'
type = 'io.cozy.files'
```

The calling application uploads the file before invoking the intent. The Move intent receives the ID of that existing local `io.cozy.files` file, lets the user choose one destination folder in Drive, and executes the move. It does not upload bytes or accept a remote source identifier.

## Configuration

Pass the Move configuration in the intent data.

- With `IntentDialogOpener`, pass it as the `options` prop.
- In raw intent attributes, it must be placed in `attributes.data`.

The source file is identified by the required `fileId` property. It is not a top-level intent attribute.

```json
{
  "action": "MOVE",
  "type": "io.cozy.files",
  "data": {
    "fileId": "already-uploaded-local-file-id",
    "defaultDirId": "local-destination-folder-id",
    "restrictToDefaultDir": true,
    "tabs": ["drive"]
  }
}
```

Drive executes the move using its existing application permissions and MoveTo behavior. No additional move-specific permission scheme is required. This does not grant the calling application Drive's access rights.

## MoveIntentConfig

```ts
interface MoveIntentConfig {
  /**
   * ID of an already-uploaded local io.cozy.files file on the Drive instance.
   * Required. Remote source identifiers are not supported.
   */
  fileId: string

  /**
   * Theme used to render the Move picker.
   * Defaults to { type: undefined }.
   */
  theme?: { type: 'light' | 'dark' | undefined }

  /**
   * Local destination folder on the Drive instance initially opened.
   * Remote folders are not supported. It does not itself restrict navigation.
   * Required when restrictToDefaultDir is true; then it also defines the root.
   * Without a restriction, omit to retain the existing starting location;
   * if deleted or inaccessible, use the usual root with a console warning.
   * With a restriction, an invalid root produces an intent error, not a fallback.
   */
  defaultDirId?: string

  /**
   * Restrict navigation and destination selection to defaultDirId and its
   * descendants. Defaults to false. When true, defaultDirId is required and
   * must resolve to an accessible local folder; otherwise report an intent error.
   */
  restrictToDefaultDir?: boolean

  /**
   * Visible tabs; Drive must always be visible. By default, display
   * ['drive', 'recents', 'sharings'] in that order; with restrictToDefaultDir: true,
   * display only ['drive'] by default.
   * Reject lists missing "drive", empty lists, unknown identifiers and tabs
   * forbidden by the restriction; never silently add the Drive tab.
   * Ignore duplicates and display in Drive's usual order, not the supplied order.
   */
  tabs?: Array<'drive' | 'recents' | 'sharings'>
}
```

### Defaults

When no configuration other than the required `fileId` is provided, Drive uses:

```js
{
  theme: { type: undefined },
  restrictToDefaultDir: false,
  tabs: ['drive', 'recents', 'sharings']
}
```

When `restrictToDefaultDir` is true and `tabs` is omitted, only Drive is displayed. `defaultDirId` is optional without a restriction and required with one.

Use `theme.type` with `light` or `dark` to force the picker theme. An omitted, `undefined` or invalid value preserves the existing behavior: the iframe follows the Cozy instance theme, with the system color scheme as a fallback. Following the Cozy instance theme requires a backend request, so the theme may change after that request succeeds. If the client app knows its theme, it should pass it to avoid a theme glitch.

For `undefined`, omit `theme` from the options passed to `IntentDialogOpener`, which only accepts explicit `light` or `dark` values. `IntentDialogOpener` and `IntentIframe` from `cozy-ui-plus >= 12.2.0` apply an explicit theme to their dialog, close button and loading surface. Older versions still pass the option to Drive, so the iframe is themed but the calling application's surrounding UI keeps its own theme. Custom intent containers remain responsible for styling their own UI. The option never changes Cozy settings, local storage or the caller's global theme.

## Destination selection

The picker displays folders, not files, and allows confirmation of exactly one destination folder. Use current-folder confirmation as in MoveTo. The picker performs the move after confirmation and destination validation; disabling confirmation on files is not sufficient to meet the folders-only requirement.

The destination must be accessible and writable. Any eligible folder in a displayed tab may be selected, including shared folders and Shared Drive locations, subject to access controls and any restricted subtree. Apply MoveTo's destination eligibility checks and revalidate the destination before moving, preserving the shared-drive context. An inaccessible or non-writable folder must not be presented as a valid destination.

The source may be outside a `defaultDirId` restricted subtree. The restriction bounds navigation and destination selection; it does not impose a source-location condition. Receiving a file ID alone does not grant access or permission to move the file. These application permissions do not bypass user, file or destination access controls.

## Starting folder and restricted subtree

`defaultDirId` accepts only a local `io.cozy.files` folder document on the Drive instance, not a remote folder identifier. A shared folder stored on this instance is local. A remote folder supplied for this option is invalid configuration; do not attempt to resolve it through a remote sharing.

`restrictToDefaultDir` defaults to `false`. When absent or false, `defaultDirId` is optional and only sets the starting location. When true, `defaultDirId` is required and defines both the starting folder and the hard navigation and destination-selection boundary. The permitted subtree includes `defaultDirId` itself and its descendants. There is no separate starting folder below a distinct restricted root.

Without a restriction, if `defaultDirId` refers to a deleted or inaccessible folder, Drive falls back to the usual root without a user-visible message and logs a warning to the browser console. The starting folder does not itself restrict navigation or change the configured tabs.

With `restrictToDefaultDir: true`, Recents and Sharings are forbidden. Omitted `tabs` shows Drive alone. An explicit list may contain only `drive` (duplicates are ignored); any other identifier, including `recents` or `sharings`, is rejected rather than silently hidden. The existing empty-list rejection still applies. When `restrictToDefaultDir` is absent or false, there is no imposed subtree; the general tab rules apply, including the always-visible Drive tab.

A supplied `tabs` list filters the visible tabs, but Drive must always remain visible. A list missing `drive` is invalid and rejected, not silently amended. Empty lists and unknown identifiers are also rejected, not silently replaced by defaults. Duplicate identifiers are ignored after their first occurrence. Drive displays the remaining tabs in its usual order, regardless of the caller's order. When `restrictToDefaultDir` is absent or false, omitting `tabs` uses the defaults listed above.

## Success result

On success, the intent result document is a one-element array containing the complete updated file document:

```ts
import type { IOCozyFile } from 'cozy-client/types/types'

interface MoveIntentResult {
  document: [IOCozyFile]
}
```

For example:

```json
{
  "document": [
    {
      "_id": "already-uploaded-local-file-id",
      "_type": "io.cozy.files",
      "name": "invoice.pdf",
      "mime": "application/pdf",
      "size": 123456,
      "dir_id": "destination-folder-id"
    }
  ]
}
```

The returned item is the moved file, not the destination folder. It is a complete Cozy document reflecting its new location, contains no binary file content, and does not include a generated link or thumbnail. Success is returned only after the move succeeds, not merely after the user chooses a destination.

Keep the successful mutation separate from obtaining its updated result. If the move succeeds but retrieving the updated document fails, retry obtaining the result in its new location, not the move itself. Do not repeat a known-successful mutation or return the stale input document as success.

## Error handling

Move errors are displayed inside the picker with retry available. A failed move does not produce a success result. Business errors remain inside the picker; they are not thrown back to the caller.

Invalid configuration and fatal initialization errors terminate through the existing generic intent `error` channel to the caller. This includes a missing `fileId`, a remote source or destination folder, `restrictToDefaultDir: true` without `defaultDirId`, and a missing, deleted, inaccessible or unverifiable folder required as the restricted root. Invalid, empty, unknown or restriction-forbidden tab lists are rejected. No new error codes are introduced. A recoverable starting-folder fallback remains a fallback, not a fatal error.

## Cancel result

User cancellation uses the generic intent `cancel` channel. There is no Move cancellation payload and no `CANCELLED` error code. Cancelling does not delete or otherwise undo the already-uploaded source file.

## `readyToUse` signal

In addition to the generic intent `ready` handshake, the Move picker sends a `readyToUse` message once its UI and actual validated initial location are usable, after applying any specified fallback. This location may be a custom starting folder or the restricted root, not the ordinary Drive root.

The signal fires once when the picker becomes usable; navigating into subfolders does not re-fire it. A recoverable query error does not prevent the signal if the picker remains interactive. Invalid configuration or a terminal initialization error is reported through the generic intent `error` channel instead; do not announce `readyToUse` for an unusable picker.

## Acceptance criteria

- The intent identity is `MOVE` / `io.cozy.files`; the request identifies exactly one already-uploaded local source file by `data.fileId`.
- The picker presents folders only and confirms exactly one accessible, writable destination, using MoveTo's eligibility and revalidation behavior.
- Omitted `tabs` displays `drive`, `recents`, `sharings` in that order; with `restrictToDefaultDir: true`, omission displays only `drive`. Drive is always visible, and invalid tab lists are rejected.
- `defaultDirId` accepts only a local folder. Without restriction it sets the starting location and falls back to the usual root with a console warning if unavailable; with restriction it is required and bounds navigation and destination selection to itself and descendants, without a broader fallback.
- Restriction does not require the source file to be inside the destination subtree. It does not bypass access or writability checks.
- Success returns exactly one complete updated moved file document after the mutation; a failed mutation does not return success, and result retrieval retries do not repeat a successful mutation.
- Business move errors remain in the picker with retry; invalid configuration uses the generic intent `error` channel; user cancellation uses the generic `cancel` channel without deleting the uploaded source.
