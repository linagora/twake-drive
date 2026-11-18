# What the control scripts saw (2026-11-18, twake-drive bb0cc9df7cc6, cozy-stack of the chaos image)

Each component of claims.yaml stopped whole (`docker stop` of all its services), all the scripts run (`run_all.sh`),
then restarted and its `healthy` waited for. On the healthy stack every script passed 3 rounds in a row (0 to 7 s each;
sharing_sync is the slowest, its replication waited for, about 6 s). After each outage everything passed again without
restarting cozy-stack (accidentRecovery: live held for each component).

## Conform

| Component | Failing | As claimed |
|---|---|---|
| couchdb | all 21 (in about 7 s, `CouchDB(wrong_json)`: the load balancer's HTML error page parsed as JSON) | yes ("No service") |
| s3 | upload_download, thumbnail_generation, office_edit, empty_trash, notes, download_link, download_archive, office_open, preview, drive_web_app | yes: the metadata features (browse, modify, trash, sharings, shared drive, realtime) kept working |
| onlyoffice | office_open, office_edit | yes |
| ldap | sso_sign_in (`invalid_grant`) | yes: the tokens and sessions held kept working |
| smtp | share_invitation_mail | yes |

## Not conform: Redis

Claimed: "No upload / modification of files (VFS locks), no background jobs, no realtime, no download links /
archives", failFast. Seen with the 3 nodes stopped: every feature failed except admin_instances and drive_web_app
(the latter in 25 s).

- **Reading the files fails too** (browse_files, share_by_link, and the GET of the new token in sso_sign_in): not
  claimed. `GET /files/:id` answers 500 `redis: all sentinels specified in configuration are unreachable` after 5 s,
  even for a text file. Cause: the S3 VFS takes the VFS *read* lock in Redis for every metadata read
  (cozy-stack `model/vfs/vfss3/impl.go`, `DirByID` / `FileByID` / `DirOrFileByID`: `sfs.mu.RLock()`), so "browsing the
  metadata" needs Redis as much as writing does. Either the claim should say "no access to the files at all" or the
  read path should not need the lock to be reachable.
- **Signing in fails**: password_sign_in (`GET /auth/login` hung more than 60 s, the form never served) and
  sso_sign_in (the token exchanged, then its first call hangs). Not claimed: the downImpact does not name the sessions,
  although claims.yaml's comment says Redis holds them.
- **Not fail fast**: claims.yaml says failFast, but the calls that need Redis wait 5 s each on the sentinels and are
  served one after the other: under the load of the 21 probes most hit their 30 s timeout (uploads, folder creations),
  a single `POST /files/_find` of the recent files answered after 55 s (a 5 s wait per thumbnail link of the images
  listed, `vfs.GetStore().AddThumb`), the login page more than 60 s.
- drive_web_app kept working (session cookie held, the app's files in S3), but slowly: 25 s.

## Other findings (not about a claim)

- **An empty note cannot be created on S3** (healthy stack): `POST /notes` with no content, what Drive's "New note"
  sends (`client.collection('io.cozy.notes').create({dir_id})`), answers 500 `io: read/write on closed pipe`. The note's
  markdown is empty, and writing 0 bytes to the S3 file fails (`model/note/note.go writeFile`: `file.Write(content)`
  with an empty content; an empty upload through `POST /files` works, io.Copy writes nothing). The probe `notes` creates
  its note with a first paragraph to check the rest of the feature; the bug itself is for linagora/cozy-stack.
- **An archive made while S3 is down is served 200, incomplete**: `GET /files/archive/:secret/:name` answered 200 with a
  valid zip holding one 0-byte entry instead of the 2 files asked (the error comes after the headers are sent). A user
  gets a broken download with no error. download_archive counts the files of the zip to see it.
- The HTML part of every mail cannot be generated (`Cannot generate HTML mail: exec: no command`: no mjml in the image),
  the mails go out as text only. An image matter rather than a resilience one.
- The probes leave in alice's contacts one contact per run of share_invitation_mail (`invite-<token>@example.net`,
  created by the stack for the recipient given by email); the sharing and the mail are cleaned.

## How the probes hold their credentials

A token of the instance obtained once through the SSO (valid 7 days) and a session cookie obtained once on the login
page are kept in `$CHAOS_RUN/control` and reused, as a signed-in browser does; a 401 makes them be obtained again. Only
sso_sign_in and password_sign_in sign in anew each run. Fixtures kept there too (a text, an image with its thumbnails, a
.docx, a folder, the sync sharing accepted by bob, the shared drive): made on the first run while the stack is healthy,
made again when gone.
