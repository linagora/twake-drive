# Upload Intent: Local Files

This is the same intent as the [URL Upload](./url-upload-intent.md): same action, same type, same handler. It accepts a second data shape that stores files picked in the calling app at the root of a shared drive. Twake Space uses it to put files shared in a space's feed into the space's Drive.

Drive picks the shape from the data: a `files` field means local files, anything else is a URL upload.

## Request

```ts
action = 'UPLOAD'
type = 'io.cozy.files'
```

The stack keeps intent data as JSON, which cannot hold a `File`. Send the data in reply to the service's `ready` message instead, through the usual intent handshake:

```ts
{ driveId: string, files: File[] }
```

- `driveId`: ID of the shared drive. The files go to its root folder.
- `files`: one or more `File` objects.

On success, the caller receives the created files' metadata through the normal `done` result, in the order of `files`.

## Behavior

- A name already taken keeps both files, with an adjusted name for the new one.
- Files upload one at a time.
- A failed file does not stop the others. The intent then ends with `error`, and the files that were stored stay. Retrying the whole batch stores them again under adjusted names.
- The intent has no UI. The calling app gives the user feedback.
