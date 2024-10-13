import { FastifyPluginCallback } from "fastify";
import * as express from "express";
import fastifyExpress from "@fastify/express";
import { adapterServiceReady, getAdapterService } from "../nephele/adapter";
import { createAuthenticator } from "../nephele/authenticator";
import { NepheleModule, NephelePromise } from "../nephele/loader";

const webdavUrl = "webdav";
function builder(nephele: NepheleModule): FastifyPluginCallback {
  const routes: FastifyPluginCallback = async (fastify, options, next) => {
    await adapterServiceReady;
    fastify.register(fastifyExpress).after(() => {
      const server = nephele.createServer({
        adapter: getAdapterService(),
        authenticator: createAuthenticator(nephele),
        plugins: {},
      });

      const webdavMiddleware = express.Router();
      webdavMiddleware.use(express.urlencoded({ extended: true }));
      webdavMiddleware.use((req, res, next) => {
        server(req, res, err => {
          if (err) {
            fastify.log.error("Nephele error:", err);
            res.status(500).send("Internal Server Error");
          } else {
            next();
          }
        });
      });
      fastify.use(`${webdavUrl}`, webdavMiddleware);
    });

    // DO NOT REMOVE THESE ROUTES
    // I think fastify doesn't run the middleware if there isn't a matching route
    fastify.all("webdav/*", (request, reply) => {
      reply.send({ error: "Unexpected route" });
    });
    fastify.all("webdav", (request, reply) => {
      reply.send({ error: "Unexpected route" });
    });
    next();
  };

  return routes;
}
export const routes = NephelePromise.then(builder);
