import diagnostics from "../../../framework/api/diagnostics";
import globalResolver from "../../../../../services/global-resolver";

export default () =>
  diagnostics.registerProviders({
    key: "platform",
    tags: "*",
    get: async () => {
      return {
        ok: globalResolver.isPlatformStarted(),
        uptimeMs: Math.floor((process.uptime() + Math.random()) * 1000),
      };
    },
  });
