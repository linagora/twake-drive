import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import { getConfig as getDiagnosticsGetConfig } from "../../../framework/api/diagnostics";
import { getHeapSnapshotSync } from "../utils";
import { createHash, randomUUID } from "node:crypto";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, _opts, next) => {
  const diagnosticsConfig = getDiagnosticsGetConfig();

  if (diagnosticsConfig?.probeSecret?.length && diagnosticsConfig?.secret?.length) {
    const getRunningToken = (() => {
      const newToken = () => [randomUUID(), randomUUID()].join("*");
      let token = newToken();
      let updatedS = process.uptime();
      return () => {
        const nowS = process.uptime();
        if (nowS - updatedS > diagnosticsConfig.secretChallengeRefreshS) {
          token = newToken();
          updatedS = nowS;
        }
        return token;
      };
    })();
    const hashToken = (token: string = getRunningToken()) =>
      createHash("sha512").update(`+${token}+${diagnosticsConfig.secret}+`).digest("hex");

    /*
      Example flow:
        Configuration:
          { secret: 'secretValue', probeSecret: 'probeSecretValue' }
        GET current token using the probeSecret:
          $ curl "$SERVER/api/diagnostics/heap?secret=probeSecretValue"
          {"token":"d5888f91-d929-4775-b9dc-de6e2fb4d7cd*b2a57b32-7029-4957-82e9-c7c25794727f"}
        Hash `+${token}+${secret}+` in SHA-512:
          Shell example:
            $ echo -n '+d5888f91-d929-4775-b9dc-de6e2fb4d7cd*b2a57b32-7029-4957-82e9-c7c25794727f+secretValue+' | sha512sum | cut -f1 -d' '
            320070a508da218baf0f3363e837080fdb902bd0d986bd0f33b806b1230608c0868accdd10bd25261ca91b57c0459edf76218deb26571c72f6b93b077846abe3
          JS example:
            require('crypto').createHash('sha512').update(`+${token}+${secret}+`).digest('hex')
        POST to download snapshot:
          $ curl "$SERVER/api/diagnostics/heap"

      Shell script example to download heap snapshot (requires curl, node and jq):
          set -euo pipefail
          SERVER="http://localhost:4000"
          DIAG_PROBE_SECRET="probeSecretValue"
          DIAG_SECRET="secretValue"

          urlencode() { node -e 'console.log(encodeURIComponent(process.argv[1]))' "$@" ; }
          DIAG_PROBE_SECRET_URLENCODED="$(urlencode "$DIAG_PROBE_SECRET")"
          TOKEN="$(curl --fail-with-body "$SERVER/api/diagnostics/heap?secret=$DIAG_PROBE_SECRET_URLENCODED" | jq -r .token)"
          HASHED="$(echo -n "+$TOKEN+$DIAG_SECRET+" | sha512sum | cut -f1 -d' ')"
          curl --fail-with-body --remote-name --remote-header-name \
              --header "Content-Type: application/json" \
              --data '{"hash":"'"$HASHED"'"}' \
              "$SERVER/api/diagnostics/heap"
          # The file should be downloaded as `twake-drive-snap-$date.heapsnapshot`
          ls twake-drive-snap-*.heapsnapshot
    */
    fastify.get("/heap", async (request, reply) => {
      if ((request.query as { secret: string }).secret !== diagnosticsConfig.probeSecret)
        return reply.status(403).send();
      return reply.send({ token: getRunningToken() });
    });

    fastify.post("/heap", async (request, reply) => {
      const hashExpected = hashToken();
      const hashProvided = (request.body as { hash: string })?.hash;
      if (hashProvided !== hashExpected) return reply.status(403).send();
      const filenameTimestamp = new Date()
        .toISOString()
        .replace(/(\.\d\d\d)?Z$/, "")
        .replace(/\D/g, "-");
      reply.header(
        "Content-Disposition",
        `attachment; filename="twake-drive-snap-${filenameTimestamp}.heapsnapshot"`,
      );
      let replyResult;
      getHeapSnapshotSync(readable => (replyResult = reply.send(readable)));
      return replyResult;
    });
  }

  next();
};

export default routes;
