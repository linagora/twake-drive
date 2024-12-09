import diagnostics from "../../../framework/api/diagnostics";
import globalResolver from "../../../../../services/global-resolver";

export default () =>
  diagnostics.registerServiceProviders("storage", () => globalResolver.platformServices.storage, {
    stats_basic: false,
    stats_track: false,
    stats_deep: false,
  });
