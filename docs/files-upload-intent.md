# Files Upload Intent

The Files Upload intent stores files picked in the calling app at the root of a shared drive. Twake Space uses it to put files shared in a space's feed into the space's Drive.

It shares its action and type with the [URL Upload intent](./url-upload-intent.md). Drive tells them apart by the data: a `files` field means a files upload.

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
- Up to three files upload at once.
- A failed file does not stop the others. The intent then ends with `error`, and the files stored before or alongside the failure stay. Retrying the whole batch stores those files again under adjusted names.
- The intent has no UI. The calling app gives the user feedback.
