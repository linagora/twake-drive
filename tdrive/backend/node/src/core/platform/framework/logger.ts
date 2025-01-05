import pino from "pino";
import { Configuration } from "./configuration";
import { executionStorage } from "./execution-storage";

const config = new Configuration("logger");

export type TdriveLogger = pino.Logger;

export const logger = pino({
  name: "TdriveApp",
  level: config.get("level", "info") || "info",
  mixin() {
    const store = executionStorage.getStore();
    return store ? { ...store } : {};
  },
  formatters: {
    level(label: string) {
      return { level: label.toUpperCase() };
    },
  },
  serializers: pino.stdSerializers,
});

export const getLogger = (name?: string): TdriveLogger =>
  logger.child({ name: `tdrive${name ? "." + name : ""}` });

export const platformLogger = getLogger("platform");

export const messageQueueLogger = getLogger("message-queue");
