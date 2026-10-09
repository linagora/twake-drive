# Move Intent

This document specifies the standalone **Move intent** for moving one or more already-uploaded local files to a single destination selected in Drive. It is a draft for collaborative review, not a statement that the proposed behavior is already implemented.

It assumes you already know how to create and run an intent (requesting an intent, loading the returned service URL, and handling the generic `ready` / `done` / `error` / `cancel` postMessage flow). It only documents what is specific to the Move service.

## Intent identity

Request this intent to move a file:

```ts
action = 'MOVE'
type = 'io.cozy.files'
```

The calling application uploads the files before invoking the intent. The Move intent receives their local `io.cozy.files` IDs, lets the user choose one destination folder in Drive, and moves each file there. It does not upload bytes or accept remote source identifiers.

## Configuration

Pass the Move configuration in the intent data.

- With `IntentDialogOpener`, pass it as the `options` prop.
- In raw intent attributes, it must be placed in `attributes.data`.

The source files are identified by the required, non-empty `fileIds` array in intent data. To move one file, pass a one-element array; IDs are not top-level intent attributes.

```json
{
  "action": "MOVE",
  "type": "io.cozy.files",
  "data": {
    "fileIds": ["first-local-file-id", "second-local-file-id"],
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
   * IDs of already-uploaded local io.cozy.files files on the Drive instance.
   * Required, non-empty array. Remote source identifiers are not supported.
   */
  fileIds: string[]

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

When no configuration other than the required `fileIds` is provided, Drive uses:

```js
{
  theme: { type: undefined },
  restrictToDefaultDir: false,
  tabs: ['drive', 'recents', 'sharings']
}
```

When `restrictToDefaultDir` is true and `tabs` is omitted, only Drive is displayed. `defaultDirId` is optional without a restriction and required with one.

Use `theme.type` with `light` or `dark` to force the picker theme. An omitted, `undefined` or invalid value preserves the existing behavior: the iframe follows the instance theme, with the system color scheme as a fallback. Following the instance theme requires a backend request, so the theme may change after that request succeeds. If the client app knows its theme, it should pass it to avoid a theme glitch.

For `undefined`, omit `theme` from the options passed to `IntentDialogOpener`, which only accepts explicit `light` or `dark` values. `IntentDialogOpener` and `IntentIframe` from `cozy-ui-plus >= 12.2.0` apply an explicit theme to their dialog, close button and loading surface. Older versions still pass the option to Drive, so the iframe is themed but the calling application's surrounding UI keeps its own theme. Custom intent containers remain responsible for styling their own UI. The option never changes instance settings, local storage or the caller's global theme.

## Destination selection

The picker displays folders, not files, and allows confirmation of exactly one destination folder for all source files. Use current-folder confirmation as in MoveTo. The picker performs the moves after confirmation and destination validation; disabling confirmation on files is not sufficient to meet the folders-only requirement.

The destination must be accessible and writable. Any eligible folder in a displayed tab may be selected, including shared folders and Shared Drive locations, subject to access controls and any restricted subtree. Apply MoveTo's destination eligibility checks and revalidate the destination before moving, preserving the shared-drive context. An inaccessible or non-writable folder must not be presented as a valid destination.

Any source may be outside a `defaultDirId` restricted subtree. The restriction bounds navigation and destination selection; it does not impose a source-location condition. Receiving file IDs alone does not grant access or permission to move the files. These application permissions do not bypass user, file or destination access controls.

## Starting folder and restricted subtree

`defaultDirId` accepts only a local `io.cozy.files` folder document on the Drive instance, not a remote folder identifier. A shared folder stored on this instance is local. A remote folder supplied for this option is invalid configuration; do not attempt to resolve it through a remote sharing.

`restrictToDefaultDir` defaults to `false`. When absent or false, `defaultDirId` is optional and only sets the starting location. When true, `defaultDirId` is required and defines both the starting folder and the hard navigation and destination-selection boundary. The permitted subtree includes `defaultDirId` itself and its descendants. There is no separate starting folder below a distinct restricted root.

Without a restriction, if `defaultDirId` refers to a deleted or inaccessible folder, Drive falls back to the usual root without a user-visible message and logs a warning to the browser console. The starting folder does not itself restrict navigation or change the configured tabs.

With `restrictToDefaultDir: true`, Recents and Sharings are forbidden. Omitted `tabs` shows Drive alone. An explicit list may contain only `drive` (duplicates are ignored); any other identifier, including `recents` or `sharings`, is rejected rather than silently hidden. The existing empty-list rejection still applies. When `restrictToDefaultDir` is absent or false, there is no imposed subtree; the general tab rules apply, including the always-visible Drive tab.

A supplied `tabs` list filters the visible tabs, but Drive must always remain visible. A list missing `drive` is invalid and rejected, not silently amended. Empty lists and unknown identifiers are also rejected, not silently replaced by defaults. Duplicate identifiers are ignored after their first occurrence. Drive displays the remaining tabs in its usual order, regardless of the caller's order. When `restrictToDefaultDir` is absent or false, omitting `tabs` uses the defaults listed above.

## Success result

Once all requested move operations have succeeded, the intent result document is an array of the surviving selected files' complete updated documents, each enriched with its full path:

```ts
import type { IOCozyFile } from 'cozy-client/types/types'

interface MoveIntentResult {
  document: Array<IOCozyFile & { path: string }>
}
```

For example:

```json
{
  "document": [
    {
      "_id": "first-local-file-id",
      "_type": "io.cozy.files",
      "name": "invoice.pdf",
      "mime": "application/pdf",
      "size": 123456,
      "dir_id": "destination-folder-id",
      "path": "/Projects/invoice.pdf"
    },
    {
      "_id": "second-local-file-id",
      "_type": "io.cozy.files",
      "name": "notes.txt",
      "mime": "text/plain",
      "size": 456,
      "dir_id": "destination-folder-id",
      "path": "/Projects/notes.txt"
    }
  ]
}
```

Each returned item is a moved file, not the destination folder. It is the complete updated `io.cozy.files` document reflecting its new location, with a full, absolute `path` that includes the filename (not just the destination folder path). Compute this response-only field from the final parent folder and final file name after each move, using the correct Shared Drive context when applicable; do not persist it in CouchDB or reuse a source file's old path. Results contain no binary file content or generated links or thumbnails. Do not return success merely because the user chose a destination: all requested move operations must have succeeded, and the surviving selected files' updated documents and paths must be available.

Keep each successful mutation separate from obtaining its updated result. If a move succeeds but retrieving a surviving file's updated document or final path fails, retry obtaining the result in its new location, not the move itself. Do not repeat a known-successful mutation or return a stale input document as success.

## Error handling

Moves are performed per file, not as an atomic batch. Follow MoveTo's per-file conflict handling and partial-failure behavior: show how many succeeded and failed, keep the picker open on failure, and retry only files not yet moved while keeping the destination fixed after partial success. Do not repeat successful moves. No success result is returned while some requested files remain unmoved. Business errors remain inside the picker; they are not thrown back to the caller.

Keep MoveTo's existing name-conflict handling, including replacement when it applies; do not add automatic renaming or a new collision rule. If two requested sources have the same name and one replaces a file moved earlier, only surviving selected files appear in `result.document`. The array can contain fewer documents than `fileIds` even though all move operations succeeded. Do not return a deleted earlier file as an updated result.

Invalid configuration and fatal initialization errors terminate through the existing generic intent `error` channel to the caller. This includes missing or empty `fileIds`, a remote source file or destination folder, `restrictToDefaultDir: true` without `defaultDirId`, and a missing, deleted, inaccessible or unverifiable folder required as the restricted root. Invalid, empty, unknown or restriction-forbidden tab lists are rejected. No new error codes are introduced. A recoverable starting-folder fallback remains a fallback, not a fatal error.

## Cancel result

User cancellation uses the generic intent `cancel` channel, without a Move-specific payload or `CANCELLED` error code. As in MoveTo, after partial success the user sees the successful-move notification and may close the picker; successful moves remain in place, while the files reported as failed remain pending for retry. Closing does not return partial results to the caller or roll back any moves. The caller cannot infer which files moved from a payload-free cancellation. Cancellation during an in-progress batch is disabled, as in MoveTo.

## `readyToUse` signal

In addition to the generic intent `ready` handshake, the Move picker sends a `readyToUse` message once its UI and actual validated initial location are usable, after applying any specified fallback. This location may be a custom starting folder or the restricted root, not the ordinary Drive root.

The signal fires once when the picker becomes usable; navigating into subfolders does not re-fire it. A recoverable query error does not prevent the signal if the picker remains interactive. Invalid configuration or a terminal initialization error is reported through the generic intent `error` channel instead; do not announce `readyToUse` for an unusable picker.

## Acceptance criteria

- The intent identity is `MOVE` / `io.cozy.files`; the request identifies one or more already-uploaded local source files by a non-empty `data.fileIds` array.
- The picker presents folders only and confirms exactly one accessible, writable destination, using MoveTo's eligibility and revalidation behavior.
- Omitted `tabs` displays `drive`, `recents`, `sharings` in that order; with `restrictToDefaultDir: true`, omission displays only `drive`. Drive is always visible, and invalid tab lists are rejected.
- `defaultDirId` accepts only a local folder. Without restriction it sets the starting location and falls back to the usual root with a console warning if unavailable; with restriction it is required and bounds navigation and destination selection to itself and descendants, without a broader fallback.
- Restriction does not require any source file to be inside the destination subtree. It does not bypass access or writability checks.
- After all requested move operations succeed, success returns the surviving selected files' complete updated documents, each with a response-only full `path` including the filename. Same-name replacements follow MoveTo, so the result may contain fewer files than requested. Result retrieval retries do not repeat successful mutations. Moves are not atomic: failures leave successful moves intact and retry only remaining files.
- Business move errors remain in the picker with retry; invalid configuration uses the generic intent `error` channel. Cancelling after partial success uses the generic `cancel` channel without a partial result; successful moves remain in place.
