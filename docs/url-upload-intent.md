# URL Upload Intent

**Draft for review, not a promise of availability in a released version.**
The service delegates URL retrieval to Cozy Stack; it does not download the
source in the browser. Deployment requires a compatible Stack and the
cozy-stack-client `sourceURL` creation support described below.

This document describes the intent-specific contract, separate from the
[File Picker](file-picker-intent.md). It assumes the usual Cozy intent
creation and `ready` / `done` / `error` / `cancel` handshake.

## Intent identity

```ts
action = 'UPLOAD'
type = 'io.cozy.files'
```

Each call imports **one file** into **one local Drive folder**, returning the
created file's metadata or an error. It is not a batch, a picker or a job API.

## Configuration

All three inputs are required, without defaults. In a raw intent request,
place them in `attributes.data`:

```json
{
  "action": "UPLOAD",
  "type": "io.cozy.files",
  "data": {
    "url": "https://documents.example/invoice.pdf",
    "folderId": "local-folder-id",
    "name": "invoice.pdf"
  }
}
```

```ts
interface UrlUploadConfig {
  /** Absolute HTTP(S) source URL, without embedded credentials. */
  url: string
  /** Concrete local folder ID or supported native magic-folder reference. */
  folderId: string
  /** Explicit file name, including its extension when applicable, not a path. */
  name: string
}
```

### `url`

The source must be retrievable **by the Stack** without additional credentials.
A self-contained signed URL is accepted; neither Cozy authentication nor caller
cookies/headers are forwarded to the source. HTTP and HTTPS are supported;
relative URLs, other schemes and embedded username/password are rejected.

Browser CORS, mixed-content and source `connect-src` rules do not constrain this
server-side transfer. Stack DNS, connectivity, TLS validation, egress and
`safehttp` restrictions do. A publicly accessible URL does not guarantee that
a particular Stack deployment can retrieve it. `localhost` refers to the
Stack's machine/container, not the caller's browser.

There is no preliminary capability probe, proxy, browser-download fallback or
source-credential parameter. Existing server redirect rules apply. Go may
produce its own Referer on redirects; the caller's headers are not forwarded.

### `folderId`

Use the target folder's actual `io.cozy.files` ID, or a supported reference below.
This is not a path, a folder name, a file ID or a shared-drive destination.

### `name`

The caller supplies a valid nonempty file name. No name is inferred from the
source URL or its Content-Disposition. Existing filename validation applies.
The result contains the final name, including automatic collision renaming.

The creation request uses `application/octet-stream`. Stack infers the file
MIME from the explicit name, not the source response's Content-Type. Choose an
appropriate extension; there is no new MIME input on this intent.

## Magic folders

Only the native Mail and Notes references are supported:

| Folder | Reference |
| --- | --- |
| Mail | `io.cozy.apps/mail` |
| Notes | `io.cozy.apps/notes` |

These are `io.cozy.apps` reference identifiers, **not fixed file IDs**. The
Stack resolves the reference to an existing folder, or creates/reuses the
folder under the Drive root with Stack-provided translations. No Drive-side
translation catalog or folder-creation algorithm is introduced.

An existing referenced folder keeps its name and location. The root is the
new folder's parent, never a fallback destination. The resolved `_id` is used
for creation and returned as the file's `dir_id`.

Resolution happens **before source retrieval**. A failed source can therefore
leave a newly resolved magic folder empty. The service does not compensate by
deleting a folder another operation may already be using.

```json
{
  "url": "https://documents.example/invoice.pdf",
  "folderId": "io.cozy.apps/mail",
  "name": "invoice.pdf"
}
```

## Local destinations and permissions

Destination reads reuse Drive's local query definition and cozy-client cache.
The service rejects non-directories, trash/trashed folders and documents with
a shared-drive context. Ordinary missing folders are not created. Invalid or
forbidden destinations do not fall back to another folder.

Existing Cozy authorization remains authoritative. A cached folder does not
prove write permission; the Stack checks file creation permission before its
source GET. Neither the intent nor magic-folder resolution grants additional
privileges. The Drive service uses its existing Cozy token, not credentials
forwarded from the calling application to the source.

## Service UI

The service renders **nothing**, while processing and after failures: no
picker, form, button, confirmation or progress indicator. The caller must keep
its frame/container invisible and provide its own feedback. A blank component
is not a new frameless execution mode or background service.

## Transfer and collisions

Drive makes an authenticated, cache-aware `client.create('io.cozy.files', ...)`
with `sourceURL`, the resolved directory and the candidate name. The Stack
retrieves the source and writes the file. Its synchronous 201 response contains
the created document after transfer; there is no 202 job, polling or progress
API. Ordinary client mutation/realtime behavior remains in use.

The browser does not fetch source bytes or construct a File/Blob. Server size,
quota and transfer rules apply instead of the former browser implementation's
50,000,000-byte and 60-second limits. **FILE_TOO_LARGE and DOWNLOAD_TIMEOUT are
no longer intent error codes.** The inspected Stack HTTP client has a 10-second
timeout covering its source request/read; this is not an intent-specific
configurable timeout or a guarantee about every future Stack version.

The inspected Stack requires source HTTP **200**: 204 and 206 are errors, not
successful imports. Restrictions on private/loopback/link-local destinations
and ports come from `safehttp`; narrowly trusted networks and development
exceptions are deployment rules, not permissions granted by this intent.

A name conflict returns HTTP 409. Drive reuses the existing keep-both suffix
algorithm and bounded retry loop, without overwriting or asking the user.
Only 409 is retried; other failures are not automatically replayed.

**Each creation attempt can retrieve the source again**, including attempts
that fail with a collision. Single-use or short-lived signed URLs may fail
during a rename retry. There is no browser byte cache to work around this.

## Success result

The service terminates with the normalized `io.cozy.files` document through
the existing protocol. The caller receives metadata, not bytes, a sharing link,
a simplified picker entry or an array:

```ts
{
  document: IOCozyFile
}
```

Illustrative caller-side result:

```json
{
  "document": {
    "_id": "created-file-id",
    "_rev": "1-revision",
    "_type": "io.cozy.files",
    "type": "file",
    "dir_id": "local-folder-id",
    "name": "invoice.pdf",
    "mime": "application/pdf",
    "size": 123456
  }
}
```

Other metadata fields are preserved. `name` and `dir_id` are the actual stored
name and resolved destination, not merely the requested values.

## Errors and confidentiality

Invalid inputs, unavailable/nonlocal destinations and retrieval/write failures
use the existing intent error channel, without service UI or a success document.
HTTP status is retained when available; the message is deliberately generic:

```json
{
  "name": "Error",
  "message": "URL upload failed (HTTP 502)",
  "status": 502
}
```

This is illustrative error content, not a new postMessage envelope. There is
no general intent-specific error catalog. A 413 describes Stack rules, not the
former browser size limit. A source GET failure before response or a non-200
source response maps to 502 in the inspected Stack. Errors during body copying
can have a different status; not every timeout is a 502. A body-read failure may
leave an empty or partial file even though the intent returns an error. The
service does not promise rollback or automatically delete such a file.

Before `service.throw`, Drive replaces the raw failure with a safe Error.
It does not forward arbitrary messages/reasons, request/response URLs, nested
objects or original stack traces: these may contain the signed SourceURL.
Status-based conflict detection occurs before this sanitization.

This protects the caller-facing error, not every deployment log. SourceURL is
part of the Stack request query; operators must also handle sensitive query
logging in access logs, reverse proxies and error listeners. There is no new
URL logging in the intent implementation.

## Closure and ambiguous outcomes

While open, the intent waits for success or failure. Cleanup/pagehide prevents
starting further creations or rename retries and suppresses terminal messages
after closure. The current client mutation does not relay an AbortSignal to
the underlying POST.

Closing the frame **does not guarantee cancellation or rollback** of an active
Stack transfer, or deletion of a created file. A response lost after creation
is an ambiguous outcome, not evidence that nothing was written. The service
does not retry non-409 failures automatically or delete resolved folders.
Existing cancellation messages remain protocol signals, not transactional
guarantees. There is no service cancel button.

## Deployment prerequisites (non-normative)

1. Deploy a Stack containing [SourceURL creation](https://github.com/linagora/cozy-stack/pull/4968).
2. Publish and consume the cozy-stack-client creation extension from
   [the client draft](https://github.com/linagora/cozy-client/pull/1734).
3. Update Drive's real dependency versions/lockfile before publishing Drive.

The local migration is validated with a linked, exact client revision, not a
fabricated published package version. The current committed lock resolves
cozy-client 60.40.0 and cozy-stack-client 60.37.0. The published collection
**does not provide SourceURL support** despite sharing the draft's version.
See [local linking and server-source setup](e2e.md#url-upload-source-fixture).

An older Stack can ignore SourceURL and create an empty file. Do not expose this
intent before confirming both prerequisites, and do not probe compatibility by
creating a user file. Mixed-version deployment needs a reliable capability
boundary outside this local migration, not a silent browser fallback.

## Acceptance checklist

- [ ] A CORS-free source reachable by Stack imports real bytes and returns the
  normalized file metadata; the browser never requests that source origin.
- [ ] The Stack creation request carries an intact encoded SourceURL and no
  source binary body; mutations update the cozy-client store.
- [ ] Required inputs and local-folder restrictions are preserved, including
  missing, deleted and shared-drive destinations.
- [ ] Native Mail/Notes references resolve to actual local IDs, without renaming
  or relocating existing folders or silently writing to the root.
- [ ] Existing write authorization is checked before source retrieval; a
  read-only token causes no source GET and creates no file.
- [ ] File and directory name collisions preserve existing content and reuse
  keep-both names; retries may cause further source GETs.
- [ ] Source failures, HTTP errors and ambiguous interruptions never become
  premature success or automatic non-409 retries.
- [ ] Caller-received serialized errors retain useful HTTP status but no signed
  URL, arbitrary server body or obsolete browser limit code.
- [ ] The service remains blank; callers own hiding its frame and feedback.
- [ ] Stack/client compatibility is verified before deployment, not inferred
  from a version range, a mocked response or a successful empty-file creation.

## Verified implementation references

- Drive: [transfer and validation](../src/modules/services/uploadFromUrl.ts),
  [service lifecycle/error boundary](../src/modules/services/components/Upload.jsx),
  [routing](../src/modules/services/components/IntentHandler.jsx) and
  [shared collision loop](../src/modules/upload/conflictResolution.ts).
- cozy-client draft revision `7aee70f4b452bc5ec0eddebed2e0aa2bc80be753`:
  `packages/cozy-stack-client/src/FileCollection.js`, `create`/`createFile`,
  empty-body SourceURL creation and existing normalization; cozy-client's
  existing `create`/StackLink mutation path is unchanged.
- Cozy Stack revision `eae9d5597bb7be0312edea6bd703600c61c8a217`:
  `web/files/files.go` source retrieval, permissions and synchronous creation;
  `model/instance/instance.go`/`model/vfs/referenced_dir.go` native folder
  resolution; `pkg/safehttp/client.go` network restrictions and timeout.
- cozy-interapp 0.21.0 `errorSerializer` copies enumerable properties plus
  name/message; the caller boundary therefore must not receive raw FetchError.

These are inspected/locally qualified revisions, not claims that a particular
released package or deployed instance has these capabilities.
