# File Picker Intent

This document describes the **File Picker intent** exposed by Drive.

It assumes you already know how to create and run a Cozy intent (requesting an intent, loading the returned service URL, and handling the generic `ready` / `done` / `error` / `cancel` postMessage flow). It only documents what is specific to the File Picker service.

## Intent identity

Use the File Picker by requesting this intent:

```ts
action = 'PICK'
type = 'io.cozy.files'
```

The service lets the user browse Drive, select a file or folder, and choose one of the configured link actions. By default, several files or folders can be selected. Set `multiple: false` to limit the selection to one item; the result is still returned as a `FilePickerEntry[]` array containing at most one entry.

## Configuration

Pass the File Picker configuration in the intent data.

- With `IntentDialogOpener`, pass it as the `options` prop.
- In raw intent attributes, it must be placed in `attributes.data`.

It is not a top-level `actions` field.

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
   * Whether folders are allowed for this action.
   */
  allowFolder?: boolean

  /**
   * Allowed MIME type patterns for files.
   * Supports exact values and wildcards: "image/png", "image/*", "*/*".
   * Empty or absent means no MIME restriction.
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
  sharingLink: { allowFolder: true },
  downloadLink: { allowFolder: false }
}
```

Default labels:

| Action | Default label |
| --- | --- |
| `sharingLink` | `Share with public link` |
| `downloadLink` | `Attach with temporary link` |

### Theme

Use `theme.type` with `light` or `dark` to force the File Picker theme. The
theme is fixed when the intent is created and does not change while it remains
open.

`undefined`, an invalid value or an omitted value preserves the existing behavior:
the iframe follows the Cozy instance theme, with the system color scheme as a
fallback. But following the Cozy instance theme imply to send a request to the backend
and the theme may change after the request succeed. So if the client app knows its theme,
it should pass it to ensure no theme glitch.

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

Drive evaluates constraints independently for each action button.

When the selected item violates an action constraint, the corresponding button is disabled and Drive displays a tooltip explaining why.

| Constraint | Behavior |
| --- | --- |
| `allowFolder: false` and selected item is a folder | Button disabled |
| `allowedMimeTypes` does not match selected file MIME | Button disabled |
| selected file size > `maxFileSize` | Button disabled |
| selected items count > `maxFileCount` | Button disabled |
| total selected file size > `availableSize` | Button disabled |

MIME matching supports:

```txt
image/png       exact match
image/*         any image type
*/*             any MIME type
```

`maxFileCount` and `availableSize` are enforced when present. Folders count
toward `maxFileCount` but are excluded from the `availableSize` total.

## Success result

On success, the intent result document is a **bare array** of file entries:

```ts
{
  document: FilePickerEntry[]
}
```

### FilePickerEntry

```ts
interface FilePickerEntry {
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
```

Exactly one of `sharingLink` or `downloadLink` is present, depending on the action selected by the user.

Example:

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
        "link": "https://cdn.example.com/files/pdf.jpg"
      }
    }
  ]
}
```

For folders, `size` is `0` and `mimeType` is `null`.

### Thumbnails

The File Picker may provide a thumbnail (an illustration or a preview) that may be used by the caller. The thumbnail link is public and has an unlimited lifetime. It is currently a 60x60 png image. Folders use a dedicated `folder.png` thumbnail.

## Error handling

Business errors (such as a missing file or failure to generate a link) are handled internally by the File Picker.
It displays an error message directly to the user, allowing them to select another file or cancel.

The intent does not throw business errors back to the caller application. It will only return a success document or a cancellation.

## Cancel result

User cancellation uses the generic intent `cancel` channel.

There is no File Picker cancellation payload and no `CANCELLED` error code.

## `readyToUse` signal

In addition to the generic intent `ready` handshake, the File Picker sends a
`readyToUse` message once its UI is rendered and the root folder has loaded.

The signal fires exactly once per intent. Navigating into subfolders does not
re-fire it. It fires even if the initial folder query errors, since the picker
is still interactive.

## Handling both link modes

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
  }
}
```

## Limitations

The count and size limits are checked on the currently selected items only:
`maxFileCount` counts every selected item including folders, while
`availableSize` sums only selected files (folders are excluded).
