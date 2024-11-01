import { FastifyInstance, FastifyPluginCallback, FastifyRegisterOptions } from "fastify";

import { routes } from "./routes";

export default async (
  fastify: FastifyInstance,
  options: FastifyRegisterOptions<{
    prefix: string;
  }>,
): Promise<void> => {
  // awaiting the routes promise here, as would be appropriate,
  // makes fastify fail loading and changes applied after "root" plugin is loaded
  fastify.register(routes as unknown as FastifyPluginCallback, options);
};
