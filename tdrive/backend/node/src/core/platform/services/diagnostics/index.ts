import { TdriveService, Consumes, Prefix, ServiceName } from "../../framework";
import web from "./web";
import DiagnosticsServiceAPI from "./service-provider";
import DiagnosticsServiceImpl from "./service";
import WebServerAPI from "../webserver/provider";
import registerBasicProviders from "./providers";

/**
 * The diagnostics service exposes endpoint that are of use for operational reasons.
 *
 */
@Prefix("/diagnostics")
@Consumes(["webserver"])
@ServiceName("diagnostics")
export default class DiagnosticsService extends TdriveService<DiagnosticsServiceAPI> {
  name = "diagnostics";
  service: DiagnosticsServiceAPI;

  api(): DiagnosticsServiceAPI {
    return this.service;
  }

  public async doInit(): Promise<this> {
    this.service = new DiagnosticsServiceImpl();
    const fastify = this.context.getProvider<WebServerAPI>("webserver").getServer();
    registerBasicProviders();

    fastify.register((instance, _opts, next) => {
      web(instance, { prefix: this.prefix });
      next();
    });

    return this;
  }
}
