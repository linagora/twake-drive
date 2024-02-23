import { FastifyInstance, FastifyRegisterOptions } from "fastify";
import routes from "./routes";

export default (
  fastify: FastifyInstance,
  options: FastifyRegisterOptions<{ prefix: string }>,
): void => {
  fastify.log.debug("configuring /internal/services/documents/v1 routes");
  fastify.register(routes, options);
};
