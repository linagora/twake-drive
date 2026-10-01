# File Picker Intent

This document specifies the revised **File Picker intent** API. It is a draft for collaborative review, not a statement that the proposed extensions are already implemented. Existing link actions retain their public contract; `documents` is an explicit opt-in extension. Options marked as proposals remain open product questions.

It assumes you already know how to create and run a Cozy intent (requesting an intent, loading the returned service URL, and handling the generic `ready` / `done` / `error` / `cancel` postMessage flow). It only documents what is specific to the File Picker service.

## Intent identity

Use the File Picker by requesting this intent:

```ts
action = 'PICK'
type = 'io.cozy.files'
```

The service lets the user browse Drive, select a file or folder, and choose one of the configured actions. For the existing selection actions, several files or folders can be selected by default. Set `multiple: false` to limit that selection to one item; its result is still returned as a `FilePickerEntry[]` array containing at most one entry.

The explicit opt-in `move` action uses the same `PICK` / `io.cozy.files` intent identity. It chooses a single destination for the already-uploaded local file identified by `move.fileId` and executes the move. It is distinct from `documents` and is not enabled by `fileId` alone. Its destination flow is described in the provisional section.

## Configuration

Pass the File Picker configuration in the intent data.

- With `IntentDialogOpener`, pass it as the `options` prop.
- In raw intent attributes, it must be placed in `attributes.data`.

It is not a top-level `actions` field.

The `move` action is explicitly enabled with `move: { fileId: "…" }`; `fileId` is required inside the action object and identifies an already-uploaded local `io.cozy.files` file on the Drive instance, not an arbitrary remote source ID. It is not a global configuration option. Enabling `documents` does not implicitly activate `move`. `move` is exclusive with `documents`, `sharingLink` and `downloadLink`: explicitly enabling any of them alongside `move` is invalid configuration and must be rejected. When `move` is enabled, omitted `sharingLink` and `downloadLink` actions remain disabled; explicit `null` values are not required. Explicitly enabled conflicting actions are rejected, not silently hidden. The destination flow is described in the provisional section; the link-action examples below do not replace the move configuration or its complete-document success result.

This example retains the existing link-action configuration:

```json
{
  "action": "PICK",
  "type": "io.cozy.files",
  "permissions": ["GET"],
  "data": {
    "theme": { "type": "dark" },
    "multiple": false,
    "sharingLink": { "label": "Share as link" },
    "downloadLink": {
      "label": "Attach file",
      "maxFileSize": 52428800,
      "allowedMimeTypes": ["image/*", "application/pdf"]
    }
  }
}
```

To choose a destination and move an already-uploaded local file, use:

```json
{
  "action": "PICK",
  "type": "io.cozy.files",
  "data": {
    "move": { "fileId": "already-uploaded-local-file-id" }
  }
}
```

The move executes inside Drive using Drive's existing permissions; no additional move-specific permission scheme is required. Omitted link actions stay disabled in this move configuration. This does not grant the calling application Drive's access rights.

## FilePickerConfig

```ts
interface FilePickerConfig {
  /**
   * Theme used to render the File Picker.
   * Defaults to { type: undefined }.
   */
  theme?: { type: 'light' | 'dark' | undefined }

  /**
   * Whether several files or folders can be selected.
   * Defaults to true. When false, modifier-key selection shortcuts are disabled.
   */
  multiple?: boolean

  /**
   * Local folder on the Drive instance initially opened; remote folders are
   * not supported. Does not itself restrict navigation or hide tabs.
   * Required when restrictToDir is true; then also defines the restricted root.
   * Without a restriction, omit to retain the existing starting location;
   * if deleted or inaccessible, use the usual root with a console warning.
   * With a restriction, an invalid root produces an intent error, not a fallback.
   */
  defaultDirId?: string

  /**
   * Restrict navigation and selection to defaultDirId and its descendants.
   * Defaults to false. When true, defaultDirId is required and must resolve
   * to an accessible local folder; otherwise report a generic intent error.
   * For move, this bounds destinations, not the supplied source file.
   */
  restrictToDir?: boolean

  /**
   * Visible tabs; Drive must always be visible. Omission keeps existing defaults.
   * With restrictToDir: true, omission shows Drive alone; only "drive" is allowed.
   * Reject lists missing "drive", empty lists, unknown identifiers and tabs
   * forbidden by the restriction; never silently add the Drive tab.
   * Ignore duplicates and display in Drive's usual order, not the supplied order.
   */
  tabs?: Array<'drive' | 'recents' | 'sharings'>

  /**
   * Move an already-uploaded local file after choosing its destination.
   * fileId identifies a local io.cozy.files file on the Drive instance.
   * It is required inside the action object, not at the top level.
   * Omitted or null means hidden; an object explicitly enables move.
   * Exclusive with enabled documents, sharingLink and downloadLink actions.
   */
  move?: { fileId: string } | null

  /**
   * Configuration for the documents action (proposed extension).
   * Explicitly pass an object to enable it. Omitted or null means hidden.
   */
  documents?: ActionConfig | null

  /**
   * Configuration for the public sharing link action.
   * Omit to use defaults. Set to null to hide the action.
   */
  sharingLink?: ActionConfig | null

  /**
   * Configuration for the temporary download link action.
   * Omit to use defaults. Set to null to hide the action.
   */
  downloadLink?: ActionConfig | null
}
```

### ActionConfig

```ts
interface ActionConfig {
  /**
   * Button label displayed by Drive.
   * Resolve it in your app locale before sending it.
   * When absent, Drive uses its own localized fallback.
   */
  label?: string

  /**
   * Accepted types: "file", "folder", exact MIME types and MIME wildcards.
   * Entries use OR matching. An empty list accepts nothing.
   * When supplied, overrides allowFolder and allowedMimeTypes.
   */
  accept?: string[]

  /**
   * Whether folders are allowed for this action when accept is absent.
   * @deprecated Use accept instead. Ignored when accept is supplied.
   */
  allowFolder?: boolean

  /**
   * Allowed MIME type patterns for files when accept is absent.
   * Supports "image/png", "image/*" and "*/*".
   * Empty or absent means no MIME restriction.
   * @deprecated Use accept instead. Ignored when accept is supplied.
   */
  allowedMimeTypes?: string[]

  /**
   * Maximum allowed file size, in bytes.
   * Absent means no per-file size restriction.
   */
  maxFileSize?: number

  /**
   * Maximum number of selectable items.
   * Absent means no count restriction.
   */
  maxFileCount?: number

  /**
   * Maximum total size of selected files, in bytes.
   * Folders do not count toward the total.
   * Absent means no total-size restriction.
   */
  availableSize?: number
}
```

## Defaults

When no config is provided, Drive uses:

```js
{
  theme: { type: undefined },
  multiple: true,
  restrictToDir: false,
  documents: null,
  move: null,
  sharingLink: { allowFolder: true },
  downloadLink: { allowFolder: false }
}
```

When no action is configured, Drive enables `sharingLink` and `downloadLink`, preserving the historical behavior. The `documents` and `move` actions must each be enabled explicitly; neither is offered by default. `fileId` alone does not enable `move` or change the default actions.

Outside `move`, an omitted link action keeps its default; an object overrides its default options; `null` hides it. Configuring one selection action does not implicitly hide the other link action. Options such as `theme`, `multiple`, `defaultDirId`, `restrictToDir` and `tabs` do not enable `documents` or change these action defaults.

`move` cannot coexist with an enabled selection action. Explicit combinations with `documents`, `sharingLink` or `downloadLink` are rejected, not silently hidden. When `move` is explicitly enabled, omitted `sharingLink` and `downloadLink` actions remain disabled rather than inheriting their historical enabled defaults. The caller does not need to set them to `null`. This move-specific normalization does not change the historical defaults outside `move`.

For example, `{ "downloadLink": {} }` still offers both link actions. To offer only Documents, pass `{ "documents": {}, "sharingLink": null, "downloadLink": null }`. To offer Documents alongside the default link actions, pass `{ "documents": {} }`. Explicitly hiding every action leaves no confirmation action; cancellation remains available.

Default labels (`documents` is proposed):

| Action | Default label |
| --- | --- |
| `documents` | `Select` |
| `sharingLink` | `Share with public link` |
| `downloadLink` | `Attach with temporary link` |

### Theme

Use `theme.type` with `light` or `dark` to force the File Picker theme. The
theme is fixed when the intent is created and does not change while it remains
open.

`undefined`, an invalid value or an omitted value preserves the existing behavior:
the iframe follows the Cozy instance theme, with the system color scheme as a
fallback. Following the Cozy instance theme requires a backend request, so the
theme may change after that request succeeds. If the client app knows its theme,
it should pass it to avoid a theme glitch.

For `undefined`, omit `theme` from the options passed to
`IntentDialogOpener`, which only accepts explicit `light` or `dark` values.
`IntentDialogOpener` and `IntentIframe` from `cozy-ui-plus >= 12.2.0` apply an
explicit theme to their dialog, close button and loading surface.
Older versions still pass the option to Drive, so the iframe is themed but the
calling application's surrounding UI keeps its own theme.

Custom intent containers remain responsible for styling their own UI. For raw
intents, pass the `theme` object in `attributes.data` like the other File Picker
options. The option never changes Cozy settings, local storage or the caller's
global theme.

## Actions

As an alternative to the selection actions below, `move` is an explicit opt-in action for choosing a destination and moving the existing file identified by `fileId`, following MoveTo. It is exclusive with `documents`, `sharingLink` and `downloadLink`; explicitly enabling any of them alongside it is rejected. It creates no upload and does not change the behavior of `documents`. Its destination requirements and intent-boundary behavior are specified in the provisional section.

### `documents`

Returns the complete `io.cozy.files` documents selected by the user, as provided by cozy-client.

- Must be explicitly enabled with an object, for example `documents: {}`.
- Works for files and folders by default.
- Creates no sharing link, download link or permission.
- Does not grant the calling application additional access to the selected resources.
- Use `accept: ["folder"]` for folder-only confirmation or `accept: ["file"]` for files only. A selection constraint alone does not hide files from the browser.

### `sharingLink`

Creates a permanent public sharing link.

- Works for files and folders by default.
- Uses a GET-only permission on `io.cozy.files`.
- Viewer-equivalent: read/download only, no edit/delete/share permission.

### `downloadLink`

Creates a temporary download link.

- Works for files only (folders disabled by default).
- Uses a GET-only permission on `io.cozy.files` with a 5-minute TTL.
- The returned URL is intended to be consumed quickly by the calling app.

## Hiding an action

Set an action to `null` to hide its button:

```json
{
  "sharingLink": null,
  "downloadLink": {
    "label": "Attach file",
    "maxFileSize": 52428800
  }
}
```

## Constraint behavior

Drive evaluates the following selection constraints independently for each selection-action button. The `move` action instead uses the destination eligibility and validation rules described in the provisional section.

When the selected item violates an action constraint, the corresponding button is disabled and Drive displays a tooltip explaining why.

| Constraint | Behavior |
| --- | --- |
| `allowFolder: false` and selected item is a folder | Button disabled |
| `allowedMimeTypes` does not match selected file MIME | Button disabled |
| selected item does not match `accept` | Button disabled |
| selected file size > `maxFileSize` | Button disabled |
| selected items count > `maxFileCount` | Button disabled |
| total selected file size > `availableSize` | Button disabled |

`accept` is the preferred type-filtering option. The existing options with the same scope, `allowFolder` and `allowedMimeTypes`, are deprecated but remain supported for backward compatibility. When `accept` is explicitly supplied, it overrides both; their constraints are ignored rather than combined with it. This precedence also applies to `accept: []`, which accepts nothing. When `accept` is absent, both deprecated options retain their historical behavior, including no MIME restriction for empty or absent `allowedMimeTypes`. Size and count constraints remain independent and are not deprecated. No `onlyFolder` alias is specified.

The `accept` vocabulary is:

```txt
file            any file
folder          any folder
image/png       file with an exact MIME type
image/*         file with any image MIME type
*/*             file with any MIME type
```

`file` and `folder` are picker tokens, not MIME types stored in the documents. Entries are combined with OR: `["folder", "image/*"]` accepts folders or images. Every selected item must match for the action to be enabled. An empty `accept` list accepts nothing. Without an explicit filter, Documents and sharing links accept files and folders, while download links retain their files-only default.

Folder navigation remains available even when folders cannot be selected for an action. Constraints control confirmation, not the types displayed in the browser; displaying only folders is a separate destination-picker requirement.

`maxFileCount` and `availableSize` are enforced when present. Folders count
toward `maxFileCount` but are excluded from the `availableSize` total.

## Success result

On success, the intent result document is a **bare array** of file entries:

```ts
{
  document: FilePickerEntry[]
}
```

All entries come from the action selected by the user. There is no new result wrapper or action discriminator.

After a successful `move`, `result.document = [updatedFileDocument]`: exactly one complete Cozy document for the moved file, reflecting its new location. This is the file document, not the destination folder document. It uses the same document result shape as `documents`, adds no sharing or download link, and contains no binary file content. Success is returned after the move, not merely after choosing the destination.

Keep successful mutation separate from obtaining its updated result. If the move has succeeded but retrieving the updated document fails, retry obtaining the result in its new location, not the move itself. Do not repeat a known-successful mutation or return the stale input document as success.

### FilePickerEntry

```ts
import type { IOCozyFile, IOCozyFolder } from 'cozy-client/types/types'

type FilePickerDocument = IOCozyFile | IOCozyFolder

interface FilePickerLinkEntry {
  id: string
  name: string
  size: number
  mimeType: string | null
  sharingLink?: string
  downloadLink?: string
  thumbnail?: {
    link: string
  }
}

type FilePickerEntry = FilePickerDocument | FilePickerLinkEntry
```

The `documents` action returns complete Cozy documents, preserving their fields and types, including metadata and relationships. The `move` action returns the same complete-document form for its single updated file after the move. It does not include binary file contents or recursively load a folder's children. It adds neither link nor a generated thumbnail and must not mutate the source document in cozy-client.

The link actions retain their historical result: `id`, `name`, numeric `size`, `mimeType`, the generated link and an optional thumbnail. They do not switch to complete Cozy documents. Exactly one of `sharingLink` or `downloadLink` is present for the corresponding link action.

Example of a download result:

```json
{
  "document": [
    {
      "id": "file-id",
      "name": "invoice.pdf",
      "size": 123456,
      "mimeType": "application/pdf",
      "downloadLink": "https://alice.example/files/download/...",
      "thumbnail": {
        "link": "https://files.twake.app/email-assets/file-picker/pdf.png"
      }
    }
  ]
}
```

For link-action folders, `size` is `0` and `mimeType` is `null`. For `documents`, folders retain their original document fields; Drive does not synthesize those values or rename `_id` to `id`.

Caller-controlled projection (`fields`) is deferred to a possible future option, outside this contract. No configuration support, projection behavior or projected result type is promised. Documents and move return complete documents; link actions retain their historical payload.

### Thumbnails

For link actions, the File Picker may provide a thumbnail (an illustration or a preview) that may be used by the caller. The `documents` and `move` actions return their documents without generating a thumbnail. The thumbnail link is public and has an unlimited lifetime. It is currently a 60x60 png image. Folders use a dedicated `folder.png` thumbnail.

## Error handling

For the selection actions, business errors (such as a missing file or failure to generate a link) are handled internally by the File Picker.
It displays an error message directly to the user, allowing them to select another file or cancel.

For `move`, follow MoveTo: display a move error inside the picker and allow the user to retry. A failed move does not produce a success result. Success is returned only after the move succeeds, with the complete updated file document.

Business errors remain inside the picker; they are not thrown back to the caller. Invalid configuration and fatal initialization errors instead terminate through the existing generic intent `error` channel to the caller. This includes incompatible actions, invalid tab lists, a remote folder supplied as `defaultDirId`, `restrictToDir: true` without `defaultDirId`, and a missing, deleted, inaccessible or unverifiable folder required as the restricted root. No new error codes are introduced. The specified recoverable starting-folder fallbacks remain fallbacks, not fatal errors.

If the mutation has already succeeded, failure to obtain its updated document must not cause another move attempt; retry only result retrieval as described under Success result.

## Cancel result

User cancellation uses the generic intent `cancel` channel.

There is no File Picker cancellation payload and no `CANCELLED` error code. For `move`, user cancellation also uses the generic `cancel` channel and does not delete the already-uploaded file.

## `readyToUse` signal

In addition to the generic intent `ready` handshake, the File Picker sends a
`readyToUse` message once its UI and the actual validated initial location are
usable, after applying any specified fallback. This location may be a custom
starting folder or the restricted root, not the ordinary Drive root.

The signal fires once when the picker becomes usable; navigating into subfolders
does not re-fire it. A recoverable query error does not prevent the signal if the
picker remains interactive. Invalid configuration or a terminal initialization
error is reported through the generic intent `error` channel instead; do not
announce `readyToUse` for an unusable picker.

## Handling result modes

```js
const handleComplete = result => {
  const entry = result.document?.[0]
  if (!entry) return

  if (entry.downloadLink) {
    attachRemoteFile(entry.downloadLink)
    return
  }

  if (entry.sharingLink) {
    insertLink(entry.sharingLink)
    return
  }

  useDocument(entry)
}
```

## Limitations

The count and size limits are checked on the currently selected items only:
`maxFileCount` counts every selected item including folders, while
`availableSize` sums only selected files (folders are excluded).

`defaultDirId` accepts only local `io.cozy.files` folder documents on the Drive instance, not remote folder identifiers. A remote folder supplied for this option is invalid configuration and is reported through the generic intent `error` channel; do not attempt to resolve it through a remote sharing. Locality does not itself mean unshared: a shared folder stored on this instance is still local. This input restriction does not remove eligible shared destinations reached through navigation.

A supplied `tabs` list filters the visible tabs, but Drive must always remain visible. A list missing `drive` is invalid and is rejected, not silently amended. Empty lists and unknown identifiers are also rejected, not silently replaced by defaults. Duplicate identifiers are ignored after their first occurrence. Drive displays the remaining tabs in its usual order, regardless of the caller's order. When `restrictToDir` is absent or false, omitting `tabs` retains the existing defaults.

`restrictToDir` defaults to `false`. When absent or false, `defaultDirId` is optional and only sets the starting location. When true, `defaultDirId` is required and defines both the starting folder and the hard navigation and selection boundary. `restrictToDir: true` without `defaultDirId` is invalid configuration, reported through the generic intent `error` channel; no implicit root is substituted.

The permitted subtree includes `defaultDirId` itself and its descendants. Users cannot navigate above it or select an item outside it through the picker. For `move`, this bounds destination selection, not the location of the source supplied through `move.fileId`: that local source may be outside the subtree. This configuration does not define a separate starting folder below a distinct restricted root.

With `restrictToDir: true`, Recents and Sharings are forbidden. Omitted `tabs` shows Drive alone. An explicit list may contain only `drive` (duplicates are ignored); any other identifier, including `recents` or `sharings`, is rejected rather than silently hidden. The existing empty-list rejection still applies. When `restrictToDir` is absent or false, there is no imposed subtree; the general tab rules above apply, including the always-visible Drive tab.

Without a restriction, if `defaultDirId` refers to a deleted or inaccessible folder, Drive falls back to the usual root without a user-visible message and logs a warning to the browser console. The starting folder does not itself restrict navigation or change the configured tabs.

With `restrictToDir: true`, a missing, deleted, inaccessible or unverifiable `defaultDirId` folder terminates the intent through the generic `error` channel to the caller. It must never fall back to a broader location.

For example, this configuration starts in a local folder and confines destination choice to its subtree:

```json
{
  "move": { "fileId": "already-uploaded-local-file-id" },
  "defaultDirId": "local-destination-folder-id",
  "restrictToDir": true,
  "tabs": ["drive"]
}
```

### Provisional: external file to destination folder

The future flow lets a calling application have the user choose a destination folder for a local `io.cozy.files` file already uploaded to the Drive instance. A separate process or application performs the upload before invoking the File Picker intent. Remote source identifiers are not supported by `move.fileId`. `defaultDirId`, which also defines the restricted root when `restrictToDir` is true, accepts only local folders on this instance. These input restrictions do not exclude eligible shared destinations reached through navigation, subject to any imposed subtree. The picker receives the uploaded file's ID through the `fileId` input, not its bytes, and is not responsible for uploading it. The picker then lets the user choose a destination and executes the move, following Drive's existing MoveTo flow.

The agreed configuration is `move: { fileId: "…" }`, with `fileId` required inside the action object for the existing, previously uploaded local file's ID. No global `fileId` option is defined. The caller explicitly enables the `move` action with this object under the existing `PICK` / `io.cozy.files` identity. `move` is exclusive with `documents`, `sharingLink` and `downloadLink`; explicitly enabling any of these selection actions alongside it is rejected. Historical link-action defaults remain unchanged outside move mode. Within move mode, omitted link actions remain disabled without requiring explicit `null`; explicitly enabled conflicting actions are rejected. The move success result is the one-element complete-document array specified above, containing the moved file after the move. No new intent identity or result wrapper is introduced. MoveTo is the reference for destination eligibility, validation and move behavior, subject to the explicit navigation and tab configuration specified here.

- **Folders only:** display folders, not files, and allow only folders as destinations. Disabling a confirmation button on files is not sufficient.
- **One destination:** confirm exactly one destination folder, not a multi-selection of files or folders, using current-folder confirmation as in MoveTo. The picker performs the move after confirmation and destination validation.
- **Configurable starting folder:** `defaultDirId` chooses a local folder initially opened. A remote starting folder is invalid configuration. Without a restriction, omission retains the existing starting location; a deleted or inaccessible starting folder falls back to the usual root with a browser-console warning and no user-visible message. Do not infer a restriction or hide tabs from `defaultDirId` alone.
- **Optional restricted subtree:** `restrictToDir: true` requires `defaultDirId` and confines navigation and destination selection to that folder and its descendants. The supplied local source file need not already be inside that subtree. An absent `defaultDirId` or a missing, deleted, inaccessible or unverifiable restricted folder produces a generic intent error to the caller, never a fallback to a broader location.
- **Exact visible tabs:** `tabs` chooses visible tabs using `drive`, `recents` and `sharings`, with Drive always visible. An explicit list missing `drive` is rejected, never silently amended. Without a restriction, omission retains the existing defaults. With `restrictToDir: true`, omission shows Drive alone and any explicit tab other than `drive` is rejected, not silently hidden. Reject empty lists and unknown identifiers. Ignore duplicates after their first occurrence and use Drive's usual display order.
- **Eligible destinations:** permit any accessible, writable folder in any displayed tab, including shared folders and Shared Drive locations, provided it is within the `defaultDirId` subtree when `restrictToDir` is true. An inaccessible or non-writable folder must not be presented as a valid placement destination. Apply MoveTo's destination eligibility checks and revalidate the destination before moving, preserving the shared-drive context. Receiving a file ID alone does not grant access or permission to move the file.

The picker executes the move inside Drive using Drive's existing application permissions, without a new move-specific permission scheme. Drive's manifest declares `ALL` access for `io.cozy.files` and `io.cozy.files.*`, and the intent entrypoint uses Drive's client and token. These application permissions do not bypass user, file or destination access controls: retain MoveTo's eligibility, accessibility and writability checks, including shared-drive context and destination revalidation. Passing `move.fileId` or receiving the updated document does not transfer Drive's credentials or grant the calling application broad access to Drive or additional rights on the file.

Exclusivity is settled: the single-destination move UI must not coexist with the selection-action UI. Existing MoveTo behavior remains the reference rather than a new conflict or move policy to design. Move errors are displayed inside the picker with retry available. User cancellation uses the generic `cancel` channel without deleting the already-uploaded file. Success returns exactly the complete updated moved file document in a one-element array after the move succeeds, as specified above. No new error codes, cancellation payloads, cleanup or rollback behavior are specified. No byte-transfer format or upload operation is required of the picker.
