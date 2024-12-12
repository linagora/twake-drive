import type { FastifyInstance, FastifyRegisterOptions } from "fastify";
import probeRoutes from "./probe-routes";
import heapRoutes from "./heap-routes";

export default (
  fastify: FastifyInstance,
  opts: FastifyRegisterOptions<{ prefix: string }>,
): void => {
  fastify.register(probeRoutes, opts);
  fastify.register(heapRoutes, opts);
};
