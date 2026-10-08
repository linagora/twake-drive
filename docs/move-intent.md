# Move Intent

This document specifies the standalone **Move intent** for moving one or more already-uploaded local files to a single destination selected in Drive. It describes the service contract and its reuse of MoveTo operations and the File Picker v2 destination browser.

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

The source files are identified by the required, non-empty `fileIds` array in intent data. To move one file, pass a one-element array; IDs are not top-level intent attributes. Duplicate source IDs are processed once. Sources may come from different parents; the picker resolves their current parent paths to apply the existing sharing warnings before moving.

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
   * ['drive', 'sharings'] in that order; with restrictToDefaultDir: true,
   * display only ['drive'] by default.
   * Reject lists missing "drive", empty lists, unknown identifiers and tabs
   * forbidden by the restriction; never silently add the Drive tab.
   * Ignore duplicates and display in Drive's usual order, not the supplied order.
   */
  tabs?: Array<'drive' | 'sharings'>
}
```

### Defaults

When no configuration other than the required `fileIds` is provided, Drive uses:

```js
{
  theme: { type: undefined },
  restrictToDefaultDir: false,
  tabs: ['drive', 'sharings']
}
```

When `restrictToDefaultDir` is true and `tabs` is omitted, only Drive is displayed. `defaultDirId` is optional without a restriction and required with one. MOVE never displays Recents: it is a file listing, not a destination-folder source. An explicit `recents` tab is invalid, even without a restriction.

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

With `restrictToDefaultDir: true`, Sharings is also forbidden. Omitted `tabs` shows Drive alone. An explicit list may contain only `drive` (duplicates are ignored); any other identifier, including `recents` or `sharings`, is rejected rather than silently hidden. The existing empty-list rejection still applies. When `restrictToDefaultDir` is absent or false, there is no imposed subtree; the general tab rules apply, including the always-visible Drive tab.

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
      "_rev": "2-example-invoice-revision",
      "type": "file",
      "name": "invoice.pdf",
      "mime": "application/pdf",
      "size": 123456,
      "dir_id": "destination-folder-id",
      "path": "/Projects/invoice.pdf"
    },
    {
      "_id": "second-local-file-id",
      "_type": "io.cozy.files",
      "_rev": "2-example-notes-revision",
      "type": "file",
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

Use the authoritative `moved` document returned by the existing move operation when it is complete: do not systematically reread the moved file. Read its final parent in the appropriate local or Shared Drive context to compute the response-only path. Only a genuinely incomplete mutation response requires a file read. A cross-drive move may assign a new file ID, so callers must use the returned identity; an incomplete cross-drive response without that final identity cannot be resolved by assuming the source ID.

Keep each successful mutation separate from obtaining its updated result. If a move succeeds but retrieving a surviving file's updated document or final path fails, retry obtaining the result in its new location, not the move itself. Do not repeat a known-successful mutation or return a stale input document as success.

## Error handling

Moves are performed per file, not as an atomic batch. Follow MoveTo's per-file conflict handling and partial-failure behavior: show how many succeeded and failed, keep the picker open on failure, and retry only files not yet moved while keeping the destination fixed after partial success. Do not repeat successful moves. No success result is returned while some requested files remain unmoved. Business errors remain inside the picker; they are not thrown back to the caller.

Keep MoveTo's existing name-conflict handling, including replacement when it applies; do not add automatic renaming or a new collision rule. If two requested sources have the same name and one replaces a file moved earlier, only surviving selected files appear in `result.document`. The array can contain fewer documents than `fileIds` even though all move operations succeeded. Do not return a deleted earlier file as an updated result.

Invalid configuration and fatal initialization errors terminate through the existing generic intent `error` channel to the caller. This includes missing or empty `fileIds`, a remote source file or destination folder, `restrictToDefaultDir: true` without `defaultDirId`, and a missing, deleted, inaccessible or unverifiable folder required as the restricted root. Invalid, empty, unknown or restriction-forbidden tab lists are rejected. No new error codes are introduced. A recoverable starting-folder fallback remains a fallback, not a fatal error.

## Cancel result

User cancellation uses the generic intent `cancel` channel, without a Move-specific payload or `CANCELLED` error code. As in MoveTo, after partial success the user sees the successful-move notification and may close the picker; successful moves remain in place, while the files reported as failed remain pending for retry. Closing does not return partial results to the caller or roll back any moves. The caller cannot infer which files moved from a payload-free cancellation. The service's Cancel button is disabled during destination validation, folder creation, move execution and result finalization. The service also sends `hideCross` while busy and `showCross` when interactive again; the caller must prevent its own close controls from bypassing that protection.

### Calling with IntentDialogOpener

For `cozy-ui-plus`'s `IntentDialogOpener`, use `closable={false}` so the service owns cancellation:

```jsx
<IntentDialogOpener
  action="MOVE"
  doctype="io.cozy.files"
  options={{ fileIds, defaultDirId }}
  closable={false}
  waitForReadyToUse
  onComplete={handleComplete}
  onDismiss={handleDismiss}
>
  <Buttons label={t('Move.action')} />
</IntentDialogOpener>
```

`onComplete` receives the result wrapper containing `document`; `onDismiss` has no partial result. When using the opener's default `exposeIntentFrameRemoval` behavior, call `result.removeIntentIframe?.()` from the completion handler, as for PICK.

The qualified `cozy-ui-plus` 14.0.1 `IntentDialogOpener` does not forward `hideCross` / `showCross` to its own close button. Its default `closable={true}` leaves the caller's cross and Escape dismissal available even while MOVE is busy. Setting only `showCloseButton={false}` hides the cross but does not disable other host dismissal paths. `closable={false}` prevents those host dismissals; the picker still offers Cancel whenever safe. Custom callers that offer a cross must consume the busy signals themselves. Closing the browser or forcibly removing the iframe cannot be prevented by the service and is not a rollback mechanism.

## `readyToUse` signal

In addition to the generic intent `ready` handshake, the Move picker sends a `readyToUse` message once its UI and actual validated initial location are usable, after applying any specified fallback. This location may be a custom starting folder or the restricted root, not the ordinary Drive root.

The signal fires once when the picker becomes usable; navigating into subfolders does not re-fire it. A recoverable query error does not prevent the signal if the picker remains interactive. Invalid configuration or a terminal initialization error is reported through the generic intent `error` channel instead; do not announce `readyToUse` for an unusable picker.

## In-app demo

Enable `drive.move-intent-demo.enabled` and open `/#/move-intent-demo` on the
Drive app. The desktop sidebar includes a link when the flag is enabled; the
same page works at mobile width. The flag is off by default outside the E2E
configuration.

The demo **really moves files**. Choose only disposable test files already on
this instance. Use **Choose local files** to open the existing PICK intent with
only My Drive, multiple selection and `documents: { accept: ['file'] }`.
Sharing/download actions are disabled, so selecting sources creates no links
or permissions and moves nothing. Only the selected file names are displayed;
cancelling PICK keeps the previous selection. The caller rejects non-local or
non-file results, and MOVE still revalidates sources before any mutation.
There is no source-ID input, source-count display or acknowledgment checkbox.
The visible warning about real movement, replacement and no rollback remains.
No sample files or folders are provisioned. Opening MOVE does not move files:
confirm a destination inside its picker. Successful completion clears the
source selection to avoid accidentally reusing old source identities.

Use **Choose default folder** for the optional starting directory. This opens
PICK with `multiple: false`, `tabs: ['drive']`,
`documents: { accept: ['folder'] }`, and both link actions set to `null`.
Folders remain navigable but only one local folder can be confirmed; files
cannot be confirmed. The page displays the folder path/name, not its ID.
Cancelling keeps the previous folder; **Clear default folder** omits
`defaultDirId` again. An invalid folder result clears the default and shows an
error rather than using a file or remote folder as the navigation root.

By default MOVE receives only `fileIds`: Drive and Sharings tabs, unrestricted
navigation and the instance theme. You can restrict destinations to the chosen
folder's subtree, select Drive-only destination tabs, or force light/dark.
Restriction requires a chosen starting folder; it does not constrain sources.
MOVE never offers Recents. A read-only JSON preview at the bottom shows the MOVE
options. After completion or cancellation it retains the submitted options,
including source IDs even after the selection is cleared. Editing the form or
opening a PICK returns the preview to the current configuration.

The demo uses the real `IntentDialogOpener` with `closable={false}` and
`waitForReadyToUse`. Completion shows the actual surviving documents and final
paths, which may have new IDs or fewer entries after replacements. Service
cancellation returns no result; completed moves remain in place. Business
failures and retries stay inside the service, including partial failures and
result-read retries. Do not reopen the intent as a substitute for Retry.

In cozy-ui-plus 14.0.1, the opener does not forward `onError`; its inner
`IntentIframe` displays a terminal error in the dialog. Returning to the form
may require **reloading the browser page**. Reloading or forcibly closing the
browser does not undo moves. Check Drive before retrying an interrupted
operation. The demo deliberately does not add host dismissal that could bypass
busy protection, and it does not infer partial results from cancellation.

## Acceptance criteria

- The intent identity is `MOVE` / `io.cozy.files`; the request identifies one or more already-uploaded local source files by a non-empty `data.fileIds` array.
- The picker presents folders only and confirms exactly one accessible, writable destination, using MoveTo's eligibility and revalidation behavior.
- Omitted `tabs` displays `drive`, `sharings` in that order; MOVE never displays Recents. With `restrictToDefaultDir: true`, omission displays only `drive`. Drive is always visible, and invalid tab lists are rejected.
- `defaultDirId` accepts only a local folder. Without restriction it sets the starting location and falls back to the usual root with a console warning if unavailable; with restriction it is required and bounds navigation and destination selection to itself and descendants, without a broader fallback.
- Restriction does not require any source file to be inside the destination subtree. It does not bypass access or writability checks.
- After all requested move operations succeed, success returns the surviving selected files' complete updated documents, each with a response-only full `path` including the filename. Same-name replacements follow MoveTo, so the result may contain fewer files than requested. Result retrieval retries do not repeat successful mutations. Moves are not atomic: failures leave successful moves intact and retry only remaining files.
- Business move errors remain in the picker with retry; invalid configuration uses the generic intent `error` channel. Cancelling after partial success uses the generic `cancel` channel without a partial result; successful moves remain in place.
