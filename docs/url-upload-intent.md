# URL Upload Intent

This document describes the **URL Upload intent** proposed for Drive.

**Draft for review, not implemented.** The contract below does not describe an
already available service.

It assumes you already know how to create and run a Cozy intent (requesting an
intent, loading the returned service URL, and handling the generic
`ready` / `done` / `error` / `cancel` postMessage flow). It only documents what
is specific to the URL Upload service, separate from the
[File Picker](file-picker-intent.md).

## Intent identity

Request the URL Upload service with this intent:

```ts
action = 'UPLOAD'
type = 'io.cozy.files'
```

The action is confirmed; `io.cozy.files` is the proposed type, consistent with
existing file intents.

The service lets a calling application upload **one file from a URL** into
**a local Drive folder**, then receive the created file's metadata or an error.
It does not ask the user to select a file or destination.

## Configuration

Pass the URL Upload configuration in the intent data.
In raw intent attributes, it must be placed in `attributes.data`.

The inputs are `url`, `folderId` and `name`, all required. The caller explicitly
provides the file name. No credentials, folder translation, path or replacement
option is accepted.

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

The example does not prescribe protocol permissions or a visible dialog wrapper.
The caller must keep the service's container invisible.

## UrlUploadConfig

The following type describes the intent data; it is not an existing library export.

```ts
interface UrlUploadConfig {
  /**
   * Source file URL, accessible by the server without additional credentials.
   * Required, non-empty string.
   */
  url: string

  /**
   * Actual local folder ID or supported magic-folder reference.
   * Required, non-empty string.
   */
  folderId: string

  /**
   * Requested file name, including the extension when applicable, not a path.
   * Required, non-empty string. May change on a name collision.
   */
  name: string
}
```

### `url`

Identifies the source file, not a local path or binary content. It must be
publicly accessible by the server without additional credentials, cookies or
authentication headers supplied by the caller. A signed URL that alone allows
the file to be retrieved meets this requirement. No caller or Cozy credentials
may be forwarded to the download host.

### `folderId`

Accepts either the actual ID of the target folder's `io.cozy.files` document or
a supported magic-folder reference. It does not identify a file, a name or a
path. The intent resolves the destination on the instance where Drive runs.

### `name`

The requested file name, including its extension when applicable, not a path.
The caller must provide a valid, non-empty name. The intent does not infer it
from the source URL or a `Content-Disposition` header. Existing file-name
validation applies; a missing or invalid name returns an error.

Automatic collision renaming may change the requested name. The success result
contains the final name actually stored in `document.name`.

## Defaults

All three inputs are required. There is no default URL, destination or file name.
Automatic creation applies only to supported magic-folder references, as
specified below.

## Magic folders

Only Mail and Notes references are supported:

| Magic folder | Reference |
| --- | --- |
| `MAIL` | `io.cozy.apps/mail` |
| `NOTES` | `io.cozy.apps/notes` |

These are **`io.cozy.apps` reference identifiers**, not fixed `io.cozy.files`
folder IDs [S2]. The reference alone does not establish that the folder exists.

For a supported reference, the service delegates resolution to the Stack.
The Stack finds the existing folder through its reference or creates it under
the Drive root using its own translations. It can reuse a folder with the
translated name and attach the reference [S2]. No intent-specific labels or
client-side folder creation are needed. An existing referenced folder retains
its name and location. The root is the new folder's parent, never a fallback
destination.

The resolved or created folder remains subject to the same authorization
checks as any other folder. Its actual `_id` is used for the upload and returned
as the file's `dir_id`.

Example data for the `MAIL` magic folder:

```json
{
  "url": "https://documents.example/invoice.pdf",
  "folderId": "io.cozy.apps/mail",
  "name": "invoice.pdf"
}
```

## Constraint behavior

Existing Cozy access controls apply to writes in the target folder. Neither
the intent nor a magic-folder reference grants additional privileges.

| Constraint | Behavior |
| --- | --- |
| Missing, empty or invalid input | Error returned to the caller |
| Nonexistent ordinary folder ID | Error; no automatic creation |
| Unsupported magic-folder reference | Error returned to the caller |
| Write access denied | Error; no authorization bypass |
| Magic-folder resolution or creation failure | Error returned to the caller |
| File name already in use | Automatic renaming; no overwrite or confirmation |

No alternative folder is silently selected when the requested destination is
invalid or forbidden.

## Service UI

The service UI is **blank**, including during processing and on failure:
no picker, upload form, button, confirmation or progress indicator.
The calling application is responsible for **keeping the service frame or
container invisible** while allowing it to run until a result is received.
A blank service UI does not itself hide the caller's container. The caller
provides its own indicators and error messages if needed.

## Upload behavior

The service passes the source URL, target folder ID or supported magic-folder
reference, and caller-supplied file name to the Stack for import. The destination
must resolve to an authorized local folder; magic-folder resolution is delegated
to the Stack.
It reports success only once the file has actually been created in that folder,
not merely when a task is accepted.

The caller supplies the initial file name; there is no source-derived fallback.
Accepted schemes, redirects, network restrictions, and size or duration limits
belong to Stack rules. The intent does not define a parallel policy; a server rejection or
failure is returned as an error. Availability of the required API remains to
be verified, as explained in the non-normative context below.

If the name collides with an existing item in the target folder, the imported
file is **automatically renamed**, without overwriting the existing item or
requesting confirmation. Drive's existing renaming behavior is reused, without
defining a new intent-specific suffix algorithm.

## Success result

On success, the intent result document is **one `io.cozy.files` document**:

```ts
{
  document: IOCozyFile
}
```

`IOCozyFile` is the normalized file document described by cozy-client [C3],
not an array, a sharing link or a simplified File Picker entry.
It contains the created file's metadata, not its binary content. Its `name`
field is the final name actually stored, including after automatic renaming.
The service passes this document through the usual success channel
(`terminate(document)` in the current convention [D2]).

Example caller-side result with an excerpt of normalized metadata (values are
illustrative; other document fields are preserved) [C3]:

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

## Error handling

Invalid inputs, an unauthorized destination, a nonexistent ordinary
folder ID, or a failure to resolve or create a magic folder, retrieve the source
or write the file result in **an error returned to the caller**, without a
success document. Unlike the File Picker, the service does not display an
interactive error inviting the user to retry [D1].

**Confirmed error contract**: cozy-stack errors are propagated through the
existing `error` channel; invalid inputs and destinations are also reported
through that channel. No intent-specific error-code catalog is introduced.

Transport and serialization follow existing intent conventions
(`service.throw(error)` in Drive [D2]), without promising raw transmission of
non-serializable server objects or exposing secrets. Illustrative logical error
content, **not a new postMessage envelope**:

```json
{
  "name": "Error",
  "message": "The requested destination is not an authorized local Drive folder."
}
```

## Cancel result

While the intent remains open, it waits for processing to succeed or fail.
Closing the intent or its frame **does not guarantee cancellation of the
server-side download, or deletion or rollback of an already-created file**.

Existing protocol cancellation signals remain applicable when emitted [D1],
without proving that server processing stopped, that a rollback occurred or
that the operation succeeded. This service adds no guaranteed cancellation
mechanism and displays no cancel button.

## Limitations

Each call uploads one file to a local destination. There is no file picker,
interactive upload flow or additional configuration beyond `url`, `folderId`
and `name`.

The service uses the existing intent protocol [D1, D2]. It introduces neither
a frameless execution mode nor a background service. A blank service UI does
not make the caller's container invisible or guarantee server cancellation
when that container closes.

Stack download rules apply; this intent defines no parallel redirect, network
or size/time policy. File names are explicit caller inputs, subject to existing
validation and automatic collision renaming. URL-upload API availability remains an
integration dependency, not an existing capability promised by this draft.

## Implementation notes (non-normative)

Integration with existing access controls remains to be verified: this
specification does not validate any specific OAuth scopes or manifest
permission set.

The inspected Stack supports `io.cozy.apps/mail` and `io.cozy.apps/notes`
directly as directory identifiers for file creation. `ResolveDirID` delegates
to `EnsureReferencedDir`, which finds the referenced folder or creates/reuses
one at the root. The Stack provides the `Tree Mail` and `Tree Notes`
translations [S2]. No Drive-side lookup, default path, translation catalog or
folder-creation helper is needed for these references. Native resolution requires
authentication; creation of a missing magic folder does not require a separate
directory-creation permission, but the requested operation still requires its
usual permissions on the resolved folder [S2].

This native magic-folder support is distinct from recursive directory creation
by path. It does not establish support for downloading a file from a URL.

Passing the URL, folder ID or supported reference, and explicit file name to the
Stack upload API through a possible cozy-client extension is the anticipated
integration. Its signatures and
mechanisms remain **out of scope**. The inspected cozy-client source exposes
`upload(data, dirPath, options)` and `createFile(data, { dirId, ... })`, without
establishing that a URL option is available [C2]. A later local inspection [N1]
confirms that `createFile` uses the explicit name or `data.name` and rejects a
missing name with default validation. The Stack creation path requires `Name`
and rejects an empty name with HTTP 422 [N2]. The explicit `name` intent input
therefore avoids depending on unverified server-side filename inference.

A bounded inspection of the Stack documentation and creation handler [S1]
shows creation through `POST /files/:dir-id` with `Type=file`, a name supplied
through `Name` and content read from the request body. It does not confirm an
existing endpoint that downloads a URL, or its naming and download rules.
Such support is an integration dependency to verify, not a new policy to decide
for this intent.

The documented creation operation returns HTTP 409 when the name already
exists [S1]: it therefore does not by itself provide the automatic renaming
approved for this intent. This observation changes neither the "rename without
overwriting" requirement nor the reuse of Drive code below; it does not justify
duplicating an algorithm on the server. Integration with URL upload must
preserve this behavior.

In Drive's current upload path, `uploadFile` calls `createFile`, and
`uploadOrResolveFileConflict` passes HTTP 409 errors to `resolveFileConflict`
[D3]. The latter automatically renames a file that collides with a folder;
for an existing file, the `KEEP_BOTH` strategy uses `uploadWithRenamedFile`
(without a choice, the current flow waits for interactive resolution).
This helper generates names through `generateUploadConflictName`, which reuses
cozy-client's `splitFilename` and `generateNewFileNameOnConflict`, then retries
conflicting creations, up to 1,000 attempts. Other errors are propagated [D3].

The future intent implementation must reuse this renaming code, automatically
applying the "keep both" behavior without adopting the dialog or replacement
branch. The current helper takes a `File` object: this inspection does not
establish existing URL support. The necessary adaptation remains out of scope.

## Intent-boundary acceptance criteria

To verify during future implementation, after addressing the integration
dependencies identified above:

- [ ] A self-contained public URL (including a signed URL), accepted by Stack
  rules, an authorized local folder ID and an explicit valid `name` create a
  file in that folder and return its `io.cozy.files` document.
- [ ] A missing, empty or invalid `name` returns an error; no name is inferred
  from the URL or `Content-Disposition`.
- [ ] No caller or Cozy cookies, authentication headers or credentials are
  forwarded to the download host; a source requiring additional credentials
  fails without an interactive authentication prompt.
- [ ] A local magic folder's actual `_id` or supported reference is accepted
  without special privileges; a supported reference with no existing folder
  delegates resolution or creation under the Drive root to the Stack, using
  its translated name, and any failure is returned to the caller.
- [ ] An existing magic folder remains the destination, without renaming or
  relocation; the root itself is never used as a fallback destination.
- [ ] A magic-folder reference outside the supported list returns an error.
- [ ] For a magic-folder reference, the returned `dir_id` is the actual folder ID.
- [ ] A name collision triggers automatic renaming using existing Drive behavior,
  without overwriting or displaying a dialog; the result contains the final
  name actually stored in `document.name`.
- [ ] cozy-stack errors and invalid inputs/destinations are reported through the
  existing error channel with its usual serialization, without an intent-specific
  code catalog, exposed secrets, premature success or a dialog in the service.
- [ ] The service stays blank; the caller can keep its container invisible while
  receiving completion through the usual protocol.
- [ ] Closing the service or receiving a cancellation signal is presented neither
  as success nor as a guarantee of server cancellation or deletion of the file.

## Verified sources

Drive, revision `32e21308aaae6d7f0daa3522bc5479700918e858`:

- [D1] [File Picker](file-picker-intent.md), configuration, result and cancellation
  sections; [manifest.webapp](../manifest.webapp), `OPEN` and `PICK` intents.
- [D2] [IntentHandler.jsx](../src/modules/services/components/IntentHandler.jsx),
  `createService`, `getIntent`, `getData`, `service.throw`;
  [Picker.jsx](../src/modules/services/components/Picker.jsx), `service.terminate`.
- [D3] [upload/index.js](../src/modules/upload/index.js), `uploadFile`,
  `uploadOrResolveFileConflict`;
  [conflictResolution.ts](../src/modules/upload/conflictResolution.ts),
  `resolveFileConflict`, `uploadWithRenamedFile`, `generateUploadConflictName`,
  `MAX_UPLOAD_CONFLICT_RENAME_ATTEMPTS`.

cozy-client, read-only local inspection of
`/home/doubleface/Workspace/cozy-client`, revision
`017067123b56ec0e19d61ea6ad96402a1582c386` (paths relative to that repository):

- [C2] `packages/cozy-stack-client/src/FileCollection.js`, `upload`, `create`,
  `createFile`.
- [C3] `packages/cozy-client/src/types.js`, `FileDocument` / `IOCozyFile`;
  `packages/cozy-stack-client/src/normalize.js`, `normalizeDoctypeJsonApi`.

Stack, upstream `master` sources consulted on October 1, 2026 (bounded inspection,
not a guarantee about the deployed version):

- [S1] [docs/files.md](https://raw.githubusercontent.com/cozy/cozy-stack/master/docs/files.md),
  file creation and status 409;
  [web/files/files.go](https://raw.githubusercontent.com/cozy/cozy-stack/master/web/files/files.go),
  `Create`, `createFileHandler` (`Name`, reading `c.Request().Body`).

Additional read-only local filename inspection on October 2, 2026:

- [N1] `/home/doubleface/Workspace/cozy-client`, revision
  `356c7ac84ab60db2f6f3c3f40002af82eba898c1`:
  `packages/cozy-stack-client/src/FileCollection.js`, `createFile` and
  `sanitizeAndValidateFileName`.
- [N2] `/home/doubleface/Workspace/cozy-stack`, revision
  `eddc8293869e66702fcfbe81841c1f477290c84f`:
  `web/files/files.go`, `createFileHandler`, `FileDocFromReq`, `WrapVfsError`;
  `model/vfs/file.go`, `NewFileDoc`; `model/vfs/vfs.go`, `checkFileName`;
  `pkg/jsonapi/errors.go`, `InvalidParameter`.
- [S2] Same local cozy-stack revision as [N2]: `docs/files.md`, "Magic folders";
  `model/instance/instance.go`, `magicFolders` and `ResolveDirID`;
  `model/vfs/referenced_dir.go`, `EnsureReferencedDir`;
  `assets/locales/en.po` and `assets/locales/fr.po`, `Tree Mail` and `Tree Notes`;
  `web/files/files_test.go`, `MagicFolder` integration test (inspected, not run).
