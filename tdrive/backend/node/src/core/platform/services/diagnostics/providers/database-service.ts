import diagnostics from "../../../framework/api/diagnostics";
import globalResolver from "../../../../../services/global-resolver";

export default () => diagnostics.registerServiceProviders("db", () => globalResolver.database);
