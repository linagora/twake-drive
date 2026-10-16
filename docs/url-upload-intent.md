# URL Upload Intent

The URL Upload intent imports one file from an HTTP(S) URL into a folder in the user's local Drive. The Stack retrieves the file; the browser does not download it.

It uses the usual Cozy intent lifecycle (`ready`, then `done`, `error` or `cancel`). This page describes only the URL Upload-specific contract.

## Request

```ts
action = 'UPLOAD'
type = 'io.cozy.files'
```

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
{ document: IOCozyFile }
```

The document contains the final stored name and destination. A name collision is resolved by keeping both files with an automatically adjusted name.

## Limitations

- The Stack must be able to reach the URL and pass its network-safety checks. Browser CORS does not apply, but Stack DNS, connectivity, TLS and egress restrictions do. `localhost` refers to the Stack host, not the browser.
- The destination must be an accessible local folder where the user can create files. Missing ordinary folders are not created. Mail and Notes references resolve to their corresponding local folders.
- This intent uploads one file per call. It has no picker, progress UI or batch mode; the calling app is responsible for user feedback.
- Closing the intent does not guarantee that an upload already in progress is cancelled or rolled back. A failed or interrupted request may have an ambiguous outcome.
- Name-conflict retries can retrieve the source URL again. Short-lived or single-use signed URLs may therefore fail on retry.
- The Stack determines the file's MIME type from the supplied name. Use an appropriate extension.

## Deployment

URL Upload requires a Stack with [SourceURL creation support](https://github.com/linagora/cozy-stack/pull/4968). Verify Stack compatibility before enabling the intent: an older Stack may create an empty file instead of retrieving the source.
