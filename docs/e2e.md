# End-to-end tests

The end-to-end suite runs Playwright against a local Cozy Stack and CouchDB
started with Docker Compose. It provisions two test instances, Alice and Bob,
and installs the Drive app in each instance.

## Prerequisites

- Node version from `.nvmrc` and dependencies installed with `yarn install`
- Docker with the Compose plugin available as `docker compose`
- The host ports `80`, `5984`, and `6060` available
- A production build of Drive
- Playwright Chromium installed

Prepare the environment once:

```sh
yarn build
yarn e2e:setup
```

## Run the suite

```sh
yarn e2e
```

The default lifecycle is destructive. It removes the E2E Compose runtime
before the suite starts and after it finishes. Use it when a clean E2E state
is wanted.

The suite uses one Playwright worker because its scenarios share Alice and Bob
fixture state. Do not run two local suites at the same time: they target the
same Compose project and host ports.

## Reuse a local runtime

Set `E2E_PERSIST=1` to leave the runtime running and reuse it on the next run:

```sh
yarn e2e:persist
yarn e2e:persist
```

`yarn e2e:persist` sets `E2E_PERSIST=1`. Persistent runs do not run Compose
cleanup and start with `--no-recreate`. Setup is idempotent: existing Alice
and Bob instances, Drive installations,
feature flags, and contacts are reused.

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
docker compose -f docker-compose.e2e.yml down --volumes
```

## Debugging and reports

```sh
# Run headed with the Playwright inspector
yarn e2e:debug

# Open the last HTML report
yarn e2e:report
```
