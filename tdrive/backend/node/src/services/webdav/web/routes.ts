import { FastifyPluginCallback } from "fastify";
import type { Authenticator, AuthResponse, User } from "nephele";
import * as express from "express";
import fastifyExpress from "@fastify/express";
import { adapterServiceReady, getAdapterService } from "./adapter";
import gr from "../../global-resolver";
import { executionStorage } from "../../../core/platform/framework/execution-storage";

const webdavUrl = "webdav";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function builder(nephele: any) {
  const routes: FastifyPluginCallback = async (fastify, options, next) => {
    const authenticator = {
      authenticate: async (request: express.Request, response: AuthResponse): Promise<User> => {
        // console.log(request.headers, request.cookies, request.body, request.secret);
        if (request.headers.authorization) {
          // TODO: make auth just via login and password and not id's
          try {
            const base64Credentials = request.headers.authorization.split(" ")[1];
            const credentials = Buffer.from(base64Credentials, "base64").toString("utf8");
            const device_id = credentials.split(":")[0];
            const device_password = credentials.split(":")[1];
            const device = await gr.services.users.getDevice({
              id: device_id,
              password: device_password,
            });
            response.locals.user = {
              username: device.user_id,
              groupname: device.company_id,
            } as User;
            executionStorage.getStore().user_id = device.user_id;
            executionStorage.getStore().company_id = device.company_id;
            response.setHeader("WWW-Authenticate", "Basic");
            return response.locals.user;
          } catch (error) {
            throw new nephele.UnauthorizedError("Error while authorising");
          }
        } else {
          response.statusCode = 401;
          response.setHeader("WWW-Authenticate", "Basic");
          throw new nephele.UnauthorizedError("Unauthorized user!");
        }
      },
      cleanAuthentication: async (
        _request: express.Request,
        response: AuthResponse,
      ): Promise<void> => {
        // TODO: think about cleaning the user
        response.set("WWW-Authenticate", "Basic");
      },
    } as Authenticator;

    await adapterServiceReady;
    const adapter = getAdapterService();
    fastify.register(fastifyExpress).after(() => {
      // Create Nephele server
      const server = nephele.createServer({
        adapter: adapter, // You need to define this
        authenticator: authenticator, // You need to define this
        plugins: {},
      });

      // Create an Express middleware that uses the Nephele server
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
    next();
  };

  return routes;
}
export const routes = eval("import('nephele').then(builder)");
