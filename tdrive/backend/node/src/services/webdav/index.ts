import { Prefix, TdriveService } from "../../core/platform/framework";
import WebServerAPI from "../../core/platform/services/webserver/provider";
import web from "./web";

@Prefix("/internal/services/webdav/v1/")
export default class WebDAVService extends TdriveService<undefined> {
  version = "1";
  name = "webdav";

  public async doInit(): Promise<this> {
    const fastify = this.context.getProvider<WebServerAPI>("webserver").getServer();
    fastify.register((instance, _opts, next) => {
      web(instance, { prefix: this.prefix });
      next();
    });
    return this;
  }

  // TODO: remove
  api(): undefined {
    return undefined;
  }
}
