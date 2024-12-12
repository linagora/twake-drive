import "reflect-metadata";
import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { init, TestPlatform } from "../setup";
import { getConfig as getDiagnosticsConfig } from "../../../src/core/platform/framework/api/diagnostics";
import { e2eTestOverride as processDiagnosticProviderE2EOverride } from "../../../src/core/platform/services/diagnostics/providers/process";

describe("The diagnostics infrastucture", () => {
  let platform: TestPlatform;
  const diagnosticConfig = getDiagnosticsConfig();
  beforeEach(async () => {
    platform = await init({
      services: [
        "webserver",
        "database",
        "applications",
        "search",
        "storage",
        "diagnostics",
        "message-queue",
        "user",
        "files",
        "auth",
        "statistics",
        "platform-services",
        "documents",
      ],
    });
  });

  afterAll(async () => {
    await platform?.tearDown();
    // @ts-ignore
    platform = null;
  });

  const getDiagnosticTags = (tag: string, secret: string) =>
    platform.app.inject({
      method: "GET",
      url: `/diagnostics/t/${encodeURIComponent(tag)}?secret=${encodeURIComponent(secret)}`,
    });

  it("should refuse invalid probe secrets", async () => {
    const result = await getDiagnosticTags("ready", "ooooh look at me ! I'm like totally such an invalid probeSecret value");
    expect(result.statusCode).toBe(403);
  });

  it("should at least report alive", async () => {
    const result = await getDiagnosticTags("ready", diagnosticConfig.probeSecret!);
    expect(result.statusCode).toBe(200);
    expect(result.json().ok).toBe(true);
  });

  it("should aggregate failure", async () => {
    try {
      processDiagnosticProviderE2EOverride.forceFail = true;
      const result = await getDiagnosticTags("ready", diagnosticConfig.probeSecret!);
      expect(result.statusCode).toBe(503);
      expect(result.json().ok).toBe(false);
    } finally {
      processDiagnosticProviderE2EOverride.forceFail = false;
    }
  });
});
