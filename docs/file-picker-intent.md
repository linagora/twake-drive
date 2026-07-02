# File Picker Intent

This document describes the **File Picker intent** exposed by Drive.

It assumes you already know how to create and run a Cozy intent (requesting an intent, loading the returned service URL, and handling the generic `ready` / `done` / `error` / `cancel` postMessage flow). It only documents what is specific to the File Picker service.

## Intent identity

Use the File Picker by requesting this intent:

```ts
action = 'PICK'
type = 'io.cozy.files'
```

The service lets the user browse Drive, select a file or folder, and choose one of the configured link actions.

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
   * Reserved for multi-file selection. Currently not enforced.
   */
  maxFileCount?: number

  /**
   * Reserved for multi-file selection. Currently not enforced.
   */
  availableSize?: number
}
```

## Defaults

When no config is provided, Drive uses:

```js
{
  sharingLink: { allowFolder: true },
  downloadLink: { allowFolder: false }
}
```

Default labels:

| Action | Default label |
| --- | --- |
| `sharingLink` | `Share with public link` |
| `downloadLink` | `Attach with temporary link` |

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

MIME matching supports:

```txt
image/png       exact match
image/*         any image type
*/*             any MIME type
```

`maxFileCount` and `availableSize` are currently accepted in the config shape but are not enforced until multi-file selection is implemented.

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
      "downloadLink": "https://alice.example/files/download/..."
    }
  ]
}
```

For folders, `size` is `0` and `mimeType` is `null`.

## Error result

Business errors are sent through the intent `error` channel, not inside `document`.

The serialized error contains:

```ts
interface FilePickerError {
  message: string
  code: 'ITEM_NOT_FOUND' | 'SHARING_LINK_FAILED' | 'DOWNLOAD_LINK_FAILED'
  id?: string
  fileName?: string
}
```

| Code | Meaning |
| --- | --- |
| `ITEM_NOT_FOUND` | The selected Drive item could not be fetched. |
| `SHARING_LINK_FAILED` | Drive could not create the public sharing link. |
| `DOWNLOAD_LINK_FAILED` | Drive could not create the temporary download link. |

Switch on `error.code` for programmatic handling.

## Cancel result

User cancellation uses the generic intent `cancel` channel.

There is no File Picker cancellation payload and no `CANCELLED` error code.

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

- Multi-file selection is not wired yet.
- `maxFileCount` is reserved but not enforced.
- `availableSize` is reserved but not enforced.
