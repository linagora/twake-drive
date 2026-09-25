# End-to-end tests

The end-to-end suite runs Playwright against Cozy Stack, CouchDB, and
OnlyOffice Docs Community started in one Docker Compose project. It provisions
Alice, Bob, and Charlie and installs Drive in each instance. It does not use a
native Stack or a personal OnlyOffice container.
The E2E context redirects to Drive because the Home app is not installed.

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

## Run the suite

```sh
yarn e2e
```

### Test an unpublished Stack revision

Build a local image from the exact Stack commit you want to test. Exporting the
commit to a fresh directory keeps uncommitted files and the checkout's `.git`
out of the Docker build context. For example, from the Drive worktree:

```sh
STACK_REPO=/path/to/cozy-stack
STACK_SHA=$(git -C "$STACK_REPO" rev-parse HEAD)
test -z "$(git -C "$STACK_REPO" status --porcelain)" || exit 1
STACK_CONTEXT=$(mktemp -d -p . .stack-source-XXXXXX)
git -C "$STACK_REPO" archive "$STACK_SHA" | tar -x -C "$STACK_CONTEXT"
docker build \
  -f "$STACK_CONTEXT/scripts/docker/production/Dockerfile" \
  --build-arg "VERSION_STRING=e2e-$STACK_SHA" \
  --label "org.opencontainers.image.revision=$STACK_SHA" \
  -t "twake-stack-e2e:$STACK_SHA" \
  "$STACK_CONTEXT"
STACK_IMAGE_ID=$(docker image inspect --format '{{.Id}}' "twake-stack-e2e:$STACK_SHA")
```

Check that this revision's production Dockerfile accepts `VERSION_STRING`
before building; older revisions may differ. Keep the build context until the
build finishes, then remove it when it is no longer needed. The image label and
tag record the chosen commit, but are claims made at build time; the exported
commit, recorded image ID and the running Stack's `/version` response provide
the provenance check. Selecting the image ID also keeps a later tag change from
changing the image under test.

Select the image explicitly for a disposable E2E project. Use a unique project
name in Treehouse worktrees, whose directory basenames are all `twake-drive`.
Leave `E2E_PERSIST` unset so a fresh container uses the chosen image:

```sh
COZY_E2E_STACK_IMAGE="$STACK_IMAGE_ID" \
COZY_E2E_STACK_PULL_POLICY=never \
E2E_PROJECT_NAME="twake-e2e-stack-$(date +%s)-$$" \
yarn e2e
```

Set both image variables for a local run. `pull_policy: never` makes a missing
image fail instead of fetching another one. With neither variable, the ordinary
`cozy/cozy-stack:latest` image and `pull_policy: always` apply. Verify the
selected container's image ID with `docker compose images` and its `/version`
response before attributing test results to a Stack revision. Returning to the
standard image requires omitting both variables on a fresh run.
The Stack healthcheck also verifies that its entrypoint created CouchDB's
`_users` and `_replicator` databases with the configured credentials.
The PDF/OnlyOffice E2E flows additionally need a separate Document Server
integration; selecting a Stack image alone does not provide it.

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
cleanup. Compose recreates services when their configuration changes, while
keeping the project volumes. Setup is idempotent: existing instances, Drive
installations, feature flags, and contacts are reused. Use `yarn e2e:reset`
when changing the Stack image so old Stack data are discarded.

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

The harness applies this explicit Compose identity to every startup, lifecycle,
and teardown command. Concurrent suites launched from the same worktree must
use distinct project names and explicit, non-overlapping port overrides because
they share the same saved configuration file.

The Compose project provides Docs on
`http://onlyoffice.<root-domain>:<office-port>`. The browser and Stack reach
Docs through that origin; Docs reaches the three Stack instance domains for
source downloads and save callbacks. JWT is disabled in this local E2E
runtime, as in Stack's `scripts/start-oo.sh`.

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
