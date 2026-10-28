# Upload Intent

The Upload intent stores files in Drive. It accepts two data shapes:

- From a URL: the Stack retrieves one file from an HTTP(S) URL into a folder of the user's local Drive. The browser does not download it.
- Local files: files picked in the calling app go to a folder of the user's Drive or to the root of a shared drive. Twake Space uses it to put files shared in a space's feed into the space's shared drive.

Drive picks the shape from the data: a `files` field means local files, anything else is a URL upload.

It uses the usual Cozy intent lifecycle (`ready`, then `done`, `error` or `cancel`). This page describes only the Upload-specific contract.

## Request

```ts
action = "UPLOAD";
type = "io.cozy.files";
```

## From a URL

Pass the configuration as the intent data (for example, as `options` with `IntentDialogOpener`, or in `attributes.data` for a raw intent):

```json
{
  "url": "https://documents.example/invoice.pdf",
  "folderId": "local-folder-id",
  "name": "invoice.pdf"
}
```

All three fields are required:

- `url`: absolute HTTP(S) URL. It must be retrievable by the Stack without extra credentials. Self-contained signed URLs are supported; caller cookies and headers are not forwarded.
- `folderId`: ID of a folder in the user's local Drive. The native Mail and Notes references `io.cozy.apps/mail` and `io.cozy.apps/notes` are also supported. Shared-drive destinations are not supported.
- `name`: desired file name, not a path. It must be valid and nonempty; the intent does not infer it from the URL or response headers.

On success, the caller receives the created file's metadata through the normal `done` result:

```ts
{
  document: IOCozyFile;
}
```

The document contains the final stored name and destination. A name collision is resolved by keeping both files with an automatically adjusted name.

### Limitations

- The Stack must be able to reach the URL and pass its network-safety checks. Browser CORS does not apply, but Stack DNS, connectivity, TLS and egress restrictions do. `localhost` refers to the Stack host, not the browser.
- The destination must be an accessible local folder where the user can create files. Missing ordinary folders are not created. Mail and Notes references resolve to their corresponding local folders.
- This shape uploads one file per call. It has no picker, progress UI or batch mode; the calling app is responsible for user feedback.
- Closing the intent does not guarantee that an upload already in progress is cancelled or rolled back. A failed or interrupted request may have an ambiguous outcome.
- Name-conflict retries can retrieve the source URL again. Short-lived or single-use signed URLs may therefore fail on retry.
- The Stack determines the file's MIME type from the supplied name. Use an appropriate extension.

### Deployment

URL Upload requires a Stack with [SourceURL creation support](https://github.com/linagora/cozy-stack/pull/4968). Verify Stack compatibility before enabling the intent: an older Stack may create an empty file instead of retrieving the source.

## Local files

The stack keeps intent data as JSON, which cannot hold a `File`. Send the data in reply to the service's `ready` message instead, through the usual intent handshake:

```ts
{ folderId: string, files: File[] } // a folder of the user's Drive
{ driveId: string, files: File[] }  // the root of a shared drive
```

- `folderId`: ID of a folder in the user's Drive, with the same rules as the URL shape's `folderId`.
- `driveId`: ID of the shared drive. The files go to its root folder.
- `files`: one or more `File` objects.

Pass exactly one of `folderId` and `driveId`.

On success, the caller receives the created files' metadata through the normal `done` result, in the order of `files`.

If any file fails, the intent ends with `error`. The error is the first failure, plus a `results` list with one entry per file, in the order of `files`:

```ts
{ document: IOCozyFile }                   // stored
{ error: { message: string, status?: number } } // failed
```

Retry only the files whose entry has an `error`.

### Behavior

- A name already taken keeps both files, with an adjusted name for the new one.
- Files upload one at a time.
- A failed file does not stop the others. The files that were stored stay.
- The intent has no UI. The calling app gives the user feedback.
