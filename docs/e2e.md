# End-to-end tests

The end-to-end suite runs Playwright against Cozy Stack, CouchDB, and
OnlyOffice Docs Community started in one Docker Compose project. It provisions
Alice, Bob, and Charlie and installs Drive in each instance. It does not use a
native Stack or a personal OnlyOffice container.
The E2E context redirects to Drive because the Home app is not installed.
Setup enables Office viewing and editing by default for all three instances,
including when starting the development runtime with `yarn stack up`.

## Prerequisites

- Node version from `.nvmrc` and dependencies installed with `yarn install`
- Docker with the Compose plugin available as `docker compose`
- Host ports are selected automatically, starting from `18080`, `15984`,
  `16060`, and `18081`. They can be forced with `COZY_E2E_STACK_PORT`,
  `COZY_E2E_COUCHDB_PORT`, `COZY_E2E_ADMIN_PORT`, and
  `COZY_E2E_ONLYOFFICE_PORT`.
- A production build of Drive
- Playwright Chromium installed

The default `cozy.localhost` names resolve to host loopback in the browser.
Stack reaches its instance names on loopback. Document Server uses a separate
Compose network where those names resolve to the proxy, which forwards source
downloads and save callbacks to Stack. Stack reaches Docs through the proxy's
`onlyoffice.cozy.localhost` alias on the default network.

Prepare the environment once:

```sh
yarn build
yarn e2e:setup
```

## URL-upload source fixture

URL uploads now send `SourceURL` to Stack instead of downloading in the browser.
The committed dependencies resolve cozy-client 60.40.0 and cozy-stack-client
60.37.0. The published collection does not support this creation path despite
sharing the draft's version. This migration is **local-only until the client
extension is published and Drive's dependency versions/lockfile are updated**.
Do not activate it on a Stack that ignores SourceURL: it can create an empty file.

For local validation, use the built cozy-stack-client package from the client
implementation revision `7aee70f4b452bc5ec0eddebed2e0aa2bc80be753` on
`fm/url-upload-client-source-url`. With Yarn 4 in this Drive worktree:

```sh
CLIENT=/path/to/cozy-client-at-that-revision
yarn link "$CLIENT/packages/cozy-stack-client"
node -p 'require.resolve("cozy-stack-client/dist/FileCollection")'
yarn build
```

The existing locked cozy-client can use the new collection through its normal
creation path; linking cozy-client itself is unnecessary. Its newer local
package has incompatible portal dependency resolutions in this worktree.
The library package must already be built by its owner; do not edit node_modules
or change another checkout to build it. Yarn link changes local resolutions and
the lockfile: **do not commit those machine-specific changes**. After qualification,
`yarn unlink "$CLIENT/packages/cozy-stack-client"` removes the local resolution.
Do not infer sourceURL support from the package's unchanged version alone.

Tests require a verified Stack build containing SourceURL support (inspected
revision `eae9d5597bb7be0312edea6bd703600c61c8a217`), not an assumed `latest` tag.
Use the image-ID workflow below, with an isolated Compose project; never restart
another lane's runtime. Test setup/teardown can delete that project's data.

`e2e/helpers/urlUploadSource.ts` starts a CORS-free Node source **inside the test
Stack container** on loopback with an ephemeral port, and closes it after the
suite. No host port, extra production server or browser CSP exception is needed.
`e2e/cozy.yml` narrowly trusts `127.0.0.1/32` for these test sources. Production
safehttp settings remain unchanged. This test exception does not demonstrate
that loopback/private sources are allowed in production.

The tests observe browser requests (no source fetch, empty Stack creation body),
read actual stored bytes back, exercise native folders/file and directory
collisions, read-only permission denial before source GET, serialized failures
and the manual form. Source and body timeout failures are separate cases; their
HTTP statuses need not match. Do not interpret a passing HTTP fixture unit test
as proof of actual Stack retrieval.

## Manual URL-upload caller

From this worktree, with the local client link above, a graphical display and
Playwright Chromium installed. Use a verified compatible image ID and a new
project owned by this worktree; do not reuse or upgrade a shared runtime:

```sh
yarn build
E2E_PROJECT_NAME=my-url-upload-manual \
  COZY_E2E_ROOT_DOMAIN=url-upload-manual.localhost \
  COZY_E2E_STACK_IMAGE="$STACK_IMAGE_ID" \
  COZY_E2E_STACK_PULL_POLICY=never yarn stack up
node e2e/setup/url-upload-caller.js
```

`STACK_IMAGE_ID` must be the compatible image inspected/built as described below.
`yarn stack up` alone does not prove that an existing runtime supports SourceURL.

The launcher opens an authenticated Alice browser using the existing local test
runtime and auth helpers. It prints the actual Drive origin from this worktree's
`e2e/.dev-ports.json`; use that URL rather than assuming a port/domain. Inside
that browser only, a temporary caller page replaces Drive's content with `url`,
`folderId`, and `name` fields, an Upload button and a result/error display. Its
intent frame stays hidden. No production route, UI, embedded token or separate
web server is added. Refreshing the page returns to Drive; rerun the launcher
to restore the caller. Opening the printed URL in another browser opens Drive,
not this injected test page.

The source must be reachable from **Stack**, not the browser. CORS headers are
unnecessary. A host-side `127.0.0.1` source is not the Stack container's loopback.
With the compatible Stack and the test-only safehttp config above, run this in a
second terminal to create a known source inside the manual runtime:

```sh
docker compose -f docker-compose.e2e.yml \
  -p "$(node -p 'require("./e2e/.dev-ports.json").projectName')" \
  exec -T cozystack node -e 'const s=require("http").createServer((q,r)=>r.end("URL upload example"));s.listen(0,"127.0.0.1",()=>console.log("http://127.0.0.1:"+s.address().port+"/example.txt"))'
```

Copy the printed URL into the form. Stack uses that container-local URL; the
browser never reads it. Do not use this command against a shared runtime without
its owner's approval.

Use `io.cozy.files.root-dir` (the form default), `io.cozy.apps/mail`,
`io.cozy.apps/notes`, or a concrete local folder ID, and an explicit name such
as `example.txt`. Successful calls create real files in the disposable local
instance. The page displays metadata or the service error without echoing the
source URL. Do not use production credentials.

Close the browser to stop the launcher and Ctrl+C the sample source server.
The Stack remains running until `yarn stack down --volumes` removes this
worktree's local test runtime. No page is available while its launcher is stopped.

## Run the suite

```sh
yarn e2e
```

### Test an unpublished Stack revision

1. **Choose a Stack revision.** Use a clean checkout and record its commit SHA.
2. **Build a local image** following the Stack's
   [production image documentation](https://github.com/cozy/cozy-stack/blob/master/scripts/docker/production/README.md#building-the-image).
   Use the README and Dockerfile from the chosen revision. Give the image a
   distinct tag such as `twake-stack-e2e:<sha>`; do not overwrite
   `cozy/cozy-stack:latest`. No registry push is needed.
3. **Get the image ID.** Replace `<sha>` with the chosen commit and record the
   resulting ID alongside it:

   ```sh
   STACK_IMAGE_ID=$(docker image inspect --format '{{.Id}}' 'twake-stack-e2e:<sha>')
   ```

4. **Run the E2E tests** from the Drive worktree, with `E2E_PERSIST` and
   `E2E_SKIP_TEARDOWN` unset:

   ```sh
   COZY_E2E_STACK_IMAGE="$STACK_IMAGE_ID" \
   COZY_E2E_STACK_PULL_POLICY=never \
   E2E_PROJECT_NAME="twake-e2e-stack-$(date +%s)-$$" \
   yarn e2e
   ```

   A missing image fails without pulling a replacement. Before attributing
   results to a Stack commit, verify the running image ID and `/version` against
   the build; a tag alone does not prove source identity.

5. **Return to the standard image** by running without the two
   `COZY_E2E_STACK_*` variables. The defaults are `cozy/cozy-stack:latest` and
   `pull_policy: always`.

Selecting a Stack image does not add an OnlyOffice Document Server.

The default lifecycle is destructive. It removes the E2E Compose runtime
before the suite starts and after it finishes. Use it when a clean E2E state
is wanted.

The suite uses one Playwright worker because its scenarios share Alice and Bob
fixture state. Each worktree gets its own Compose project and available host
ports, so suites from different worktrees can run concurrently.

## Reuse a local runtime

Set `E2E_PERSIST=1` to leave the runtime running and reuse it on the next run:

```sh
yarn e2e:persist
yarn e2e:persist
```

`yarn e2e:persist` sets `E2E_PERSIST=1`. Persistent runs do not run Compose
cleanup and use `--no-recreate` to keep existing containers. Stack file storage
is inside the container, so recreating it would lose uploaded contents while
retaining their CouchDB metadata. Setup is idempotent: existing instances,
Drive installations, feature flags, and contacts are reused. Use
`yarn e2e:reset` when changing the Stack image or runtime configuration; this
explicitly discards the old Stack data.

`E2E_SKIP_TEARDOWN=1` is kept as a compatibility alias for `E2E_PERSIST=1`.
Use `E2E_PERSIST` in new commands.

## Reset a persistent runtime

To explicitly discard the current runtime data before running the suite while
keeping the newly provisioned runtime afterwards:

```sh
yarn e2e:reset
```

`yarn e2e:reset` sets both `E2E_PERSIST=1` and `E2E_RESET=1`. `E2E_RESET=1`
runs `docker compose down --volumes` before startup. Without `E2E_PERSIST=1`,
the normal teardown also runs after the suite.

To remove the runtime without running tests:

```sh
E2E_PROJECT_NAME=$(node -p "require('./e2e/.e2e-ports.json').projectName")
docker compose -f docker-compose.e2e.yml \
  --project-name "$E2E_PROJECT_NAME" down --volumes
```

## Isolate a test runtime

By default, the E2E suite derives a project name from the current worktree
path, such as `twake-e2e-twake-drive-1a2b3c4d`. Use `E2E_PROJECT_NAME` to
override that identity:

```sh
E2E_PROJECT_NAME=custom-harness yarn e2e
```

Existing `.e2e-ports.json` and `.dev-ports.json` configurations keep their saved
project identity and ports when the Office port is added, preserving the dev
instance domains. Run the port migration regression checks without starting
Docker:

```sh
node --test e2e/helpers/ports.spec.js
```

The harness applies this explicit Compose identity to every startup, lifecycle,
and teardown command. Concurrent suites launched from the same worktree must
use distinct project names and explicit, non-overlapping port overrides because
they share the same saved configuration file.

The Compose project provides Docs on
`http://onlyoffice.<root-domain>:<office-port>`. The browser and Stack reach
Docs through that origin; Docs reaches the three Stack instance domains for
source downloads and save callbacks. JWT is disabled in this local E2E
runtime. The nominal opening test therefore does not validate JWT authentication
or persistence through save callbacks. Published ports bind to host loopback;
this configuration is intended for disposable tests, not deployment.

Check the Office integration with a normal Word document:

```sh
yarn e2e e2e/tests/onlyoffice-open.spec.ts --project=chromium
```

The test uploads a DOCX, opens it from the Drive file list, and checks the
Stack's editor configuration and the loaded editor UI. PDF editing tests need
both the PDF frontend changes and a Stack image built from a revision that
includes the PDF Office backend; `cozy/cozy-stack:latest` is not proof of PDF
support.

## Debugging and reports

```sh
# Run headed with the Playwright inspector
yarn e2e:debug

# Open the last HTML report
yarn e2e:report
```
