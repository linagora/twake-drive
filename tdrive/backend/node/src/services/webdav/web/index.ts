import { FastifyInstance, FastifyRegisterOptions } from "fastify";

import { routes } from "./routes";

export default async (
  fastify: FastifyInstance,
  options: FastifyRegisterOptions<{
    prefix: string;
  }>,
): Promise<void> => {
  fastify.register(routes, options);
};
