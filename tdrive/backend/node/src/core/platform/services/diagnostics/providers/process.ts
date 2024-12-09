import diagnostics from "../../../framework/api/diagnostics";

export default () =>
  diagnostics.registerProviders({
    key: "process",
    tags: ["live", "ready"],
    async get() {
      return {
        ok: true,
        gc: !!global.gc,
        pid: process.pid,
        mem: process.memoryUsage(),
        res: process.resourceUsage(),
      };
    },
  });
