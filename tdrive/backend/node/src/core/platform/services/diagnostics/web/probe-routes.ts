import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import diagnostics, {
  getConfig as getDiagnosticsGetConfig,
} from "../../../framework/api/diagnostics";

const routes: FastifyPluginCallback = (fastify: FastifyInstance, _opts, next) => {
  const diagnosticsConfig = getDiagnosticsGetConfig();
  if (diagnosticsConfig?.probeSecret?.length) {
    const tagParamName = "diagnosticTags";
    fastify.get(`/t/:${tagParamName}`, async (request, reply) => {
      const tag = request.params[tagParamName];
      if (
        tag === "*" ||
        (request.query as { secret: string }).secret !== diagnosticsConfig.probeSecret
      )
        return reply.status(403).send();
      const results = await diagnostics.get(tag);
      if (!results.ok) reply.status(503);
      return reply.send(results);
    });
  }
  next();
};

export default routes;
