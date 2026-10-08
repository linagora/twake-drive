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

The Document Server has the scribe plugin of the worktree
(`plugins/onlyoffice-scribe/build`, built by the global setup).
`e2e/tests/onlyoffice-scribe.spec.ts` plays its selection cases on real
documents, see `e2e/fixtures/scribe/README.md`. Its tests are tagged
`@e2e-scribe`:

```sh
yarn e2e --grep @e2e-scribe --project=chromium
```

The E2E workflow runs them in a job of their own, `Scribe E2E`, and the rest
with `--grep-invert @e2e-scribe`.

## Debugging and reports

```sh
# Run headed with the Playwright inspector
yarn e2e:debug

# Open the last HTML report
yarn e2e:report
```
