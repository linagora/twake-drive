import registerDBServiceProvider from "./database-service";
import registerStorageServiceProvider from "./storage-service";
import registerPlatformProvider from "./platform-started";
import registerProcessProvider from "./process";

export default () => {
  registerDBServiceProvider();
  registerStorageServiceProvider();
  registerPlatformProvider();
  registerProcessProvider();
};
