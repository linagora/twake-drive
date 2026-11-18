# Chaos environment: the resilience claims of Twake Drive

`claims.yaml` says, for each service Twake Drive (cozy-stack and its Drive web app) relies on, what it survives:

| Key | Meaning |
|---|---|
| `faultTolerance` | nodes that can be lost with no impact at all (absent: a single node) |
| `downImpact` | what stops working while the whole component is down; every other feature keeps working |
| `accidentRecovery` | `live`: once the component is back, everything works again without restarting cozy-stack |
| `requiredOnStartup` | `false`: cozy-stack starts without it, degraded as `downImpact` says |

This folder is the stack that checks them: every node of a replicated service is its own compose service, so that a
tool (twake-chaos, the Twake QA tooling) can pause, stop and restart them one by one while control scripts check the
features. `topology.yaml` maps each component of `claims.yaml` onto its services.

| Component | Nodes | Replication |
|---|---|---|
| CouchDB 3.4 | `couchdb1..3`, behind `couchdb-lb` (HAProxy, never faulted) | one cluster, n=3 (each database on each node), quorum reads / writes (r=w=2) |
| Redis 8.0 | `redis1..3` | a Sentinel set: one master, 2 replicas, 3 sentinels (quorum 2, down after 5s); `min-replicas-to-write 1` |
| S3 (MinIO) | `s3` | |
| OnlyOffice 9.4 | `onlyoffice` | |
| OpenLDAP | `ldap` (the users: alice, bob) | |
| Mailpit | `mail` | |
| LemonLDAP::NG | `sso` (OIDC, never faulted) | |

Each container has a memory limit (~8.6 GB in all; cozy-stack and MinIO with a `GOMEMLIMIT` under theirs). cozy-stack
runs the image of build.sh: the cozy-stack image with the build of Drive of the commit, installed into S3 in the
instances `alice.chaos.localhost:8080` and `bob.chaos.localhost:8080` (context `chaos`), signing in through LemonLDAP.

cozy-stack runs with `--dev` (as the repository's e2e stack): without TLS, the instances are http only in a dev build.
`--dev` also creates every database with `?q=1&n=1`, a single copy: `couchdb-lb` rewrites it to `n=3`, and sends all
the creations of one database to one node (cozy-stack creates it from several goroutines at once, and two CouchDB
coordinators racing on it answer 500 "conflict", fatal at startup). start.sh checks that every database has 3 copies.

`healthy` of Redis (common.sh) also waits for no sentinel in TILT: a paused sentinel stops acting for 30s once it runs
again, and a failover in that window would lack its quorum.

## Usage

```bash
scripts/chaos/build.sh   # the Drive bundle of this commit (the toolbox of scripts/qa-environment) in a cozy-stack image
                         # COZY_STACK_DIR=<cozy-stack checkout>: that cozy-stack built; DRIVE_IMAGE=<image>: pulled instead
scripts/chaos/start.sh   # the backing services, the clusters formed and checked, cozy-stack healthy, an SSO sign-in
                         # reaching the files API (a file written and read back)
scripts/chaos/probe.sh   # does Drive answer? an SSO sign-in, a file written, read back, the root folder listed
scripts/chaos/stop.sh    # everything removed, volumes included
```

`CHAOS_REPO_DIR=<twake-drive checkout>` when this folder is not inside the checkout under test.

Published on 127.0.0.1: the API 19800 (`Host: alice.chaos.localhost:8080`), the admin API 19801 (admin / cozy), the SSO
19802 (`Host: sso.example.com`), CouchDB 19803, S3 19804, OnlyOffice 19805, Mailpit 19806. start.sh writes the URLs,
accounts and an OAuth client of alice's instance to `~/.cache/twake-chaos/drive-chaos/env`. A token for the API: the
SSO's (password grant, client `twake-drive`) exchanged on `POST /oidc/access_token` of the instance, as start.sh does.
A fault by hand:

```bash
docker compose -p drive-chaos pause couchdb2     # a hung node; `stop` for a crashed one
docker compose -p drive-chaos unpause couchdb2
```
