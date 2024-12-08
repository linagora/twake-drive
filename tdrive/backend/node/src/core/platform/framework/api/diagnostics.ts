import assert from "node:assert";
import config from "../../../config";
import { logger } from "../logger";

/**
 * Values that can match a set of diagnostic providers.
 *
 * `startup`, `ready` and `live` are meant to match the meanings of the corresponding
 * kubernetes probes:
 * https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
 */
export type TDiagnosticTag =
  | "*" // Special value that includes everything, and is always included
  | "startup" // Tests that are absolutely required (and light) to even begin the other tests
  | "ready" // Tests required before traffic can be sent our way
  | "live" // Tests required to prevent from being restarted
  | "stats" // Expensive diagnostics that should not often be ran, but can be system wide
  | "stats-full"; // Expensive diagnostics that should not often be ran, and then probably for a single key

/** Detail requested from platform service self-diagnostics */
export enum TServiceDiagnosticDepth {
  /** Minimal cost information that tests functioning service */
  alive = "alive",
  /** Statistics that have a little impact enough for periodic tracking into a time series */
  stats_track = "stats_track",
  /** Statistics that should be included when looking specifically at general statistics */
  stats_basic = "stats_basic",
  /** Statistics possibly expensive and large to calculate, for occasional debug operations */
  stats_deep = "stats_deep",
}

const serviceDiagnosticDepthToTags: { [depth in TServiceDiagnosticDepth]: TDiagnosticTag[] } = {
  [TServiceDiagnosticDepth.alive]: ["startup", "live", "ready"],
  [TServiceDiagnosticDepth.stats_track]: ["ready", "stats"],
  [TServiceDiagnosticDepth.stats_basic]: ["stats", "stats-full"],
  [TServiceDiagnosticDepth.stats_deep]: ["stats-full"],
};

interface IDiagnosticsConfig {
  // Diagnostic keys that should be considered ok without evaluation
  skipKeys?: string[];
  // This secret must be provided to the diagnostic endpoints as a query param
  // therefor it's likely to leak, through logs etc, for ex. and should not
  // relied on for security because disabling diagnostics. At worst this
  // provides access to the DB statistics.
  probeSecret?: string;
  // This secret is required to sign more dangerous diagnostic endpoints, such
  // the heap snapshot. It should never be sent over the network.
  secret?: string;
  // Maximum time to keep the same challenge token for diagnostic endpoints, in seconds.
  // Must be large enough to have a reasonable chance of running the token request
  // then the action on the same backend instance.
  secretChallengeRefreshS: number;
}

export const getConfig = (): IDiagnosticsConfig => {
  let configSection = config.get("diagnostics") as IDiagnosticsConfig;
  if (typeof configSection.skipKeys === "string")
    configSection = {
      ...configSection,
      skipKeys: (configSection.skipKeys as string)
        .trim()
        .split(/[,\s]+/g)
        .filter(x => !!x),
    };
  if (typeof configSection.secretChallengeRefreshS === "string")
    configSection = {
      ...configSection,
      secretChallengeRefreshS: parseInt(configSection.secretChallengeRefreshS, 10),
    };
  return configSection;
};

/** Code-wide unique key for each provider */
export type TDiagnosticKey = string;

/** Each provider should return an object of this format. The key of the provider defines the schema. */
export type TDiagnosticResult = { ok: boolean; warn?: string } & { [key: string]: unknown };

/** Implemented by objects that want to provide data to the diagnostic check */
export interface IDiagnosticProvider {
  /** Code-wide unique key underwhich the result of `get` will be included */
  key: TDiagnosticKey;

  /** This result is present in any included request tag */
  tags: TDiagnosticTag[] | "*";

  /**
   * If set, this provider will be polled at that interval.
   * If `undefined`, this provider will be ran at each request.
   */
  pollPeriodMs?: number;

  /**
   * Returns an object as presented to a diagnostic requester.
   * Warning: this could be public and readable to the internet.
   * @param completeButSlow If `true`, perform additional operations for a
   * more informative
   */
  get(): Promise<TDiagnosticResult>;
}

/**
 * Platform services that can provide generic diagnostic implementations may use this interface.
 *
 * Matching from {@link TDiagnosticTag} to {@link TServiceDiagnosticDepth} is expected to
 * be done by intermediary providers. This is because not all services are equally critical,
 * or have the same tolerable down times.
 */
export interface IServiceDiagnosticProvider {
  /** The return format is specific to each service, but should include a `{ok: boolean}` field. */
  getDiagnostics(depth: TServiceDiagnosticDepth): Promise<TDiagnosticResult>;
}

const isProviderIncludedInTag = (
  tag: TDiagnosticTag,
  provider: IDiagnosticProvider,
  config: IDiagnosticsConfig,
) =>
  (provider.tags === "*" || provider.tags.indexOf(tag) >= 0 || provider.tags.indexOf("*") >= 0) &&
  (!config.skipKeys?.length || !config.skipKeys.includes(provider.key));

// registered providers with `pollPeriodMs === undefined`
const immediateDiagnosticProviders: IDiagnosticProvider[] = [];
// registered providers with `pollPeriodMs !== undefined`
const periodicDiagnosticProviders: IDiagnosticProvider[] = [];

const now = () => Math.round(process.uptime() * 1000);

const isKeyAlreadyRegistered = (key: TDiagnosticKey) =>
  immediateDiagnosticProviders.some(provider => key == provider.key) ||
  periodicDiagnosticProviders.some(provider => key == provider.key);

// stores results of all the `pollPeriodMs` truthy providers
const latestPeriodicDiagnostics: { [key: TDiagnosticKey]: object } = {};
const recordDiagnostic = (startMs: number, key: TDiagnosticKey, data?: object, error?: object) =>
  (latestPeriodicDiagnostics[key] = {
    durationMs: Math.round(now() - startMs),
    ...(error ? { ok: false, error } : { ...data }),
  });

const runProvider = async provider => {
  const startMs = now();
  try {
    const result = await provider.get();
    if (!result.ok)
      logger.error(
        { provider: provider.key, result },
        "Got diagnostic provider result with ok=false",
      );
    else if (result.warn)
      logger.warn(
        { provider: provider.key, result },
        "Got diagnostic provider result with ok=true but a warning",
      );
    return recordDiagnostic(startMs, provider.key, result);
  } catch (err) {
    logger.error({ err, provider: provider.key }, "Failed to read diagnostic provider");
    return recordDiagnostic(startMs, provider.key, undefined, err);
  }
};

const pendingTimeouts: number[] = []; // Pending return values from `setTimeout` calls
const forgetPendingTimeout = (timeoutId: number) => {
  const index = pendingTimeouts.indexOf(timeoutId);
  assert(index >= 0);
  pendingTimeouts.splice(index, 1);
};

let hasShutdown = false;
const ensureHasntShutdown = () => {
  if (hasShutdown) throw new Error("Diagnostics service already shutdown");
};

export default {
  /** Add a provider to be included in diagnostics output */
  registerProviders(...providers: IDiagnosticProvider[]) {
    ensureHasntShutdown();
    providers.forEach(provider => {
      if (isKeyAlreadyRegistered(provider.key)) throw new Error("Provider with duplicate key");
      if (provider.pollPeriodMs) {
        periodicDiagnosticProviders.push(provider);
      } else {
        immediateDiagnosticProviders.push(provider);
        return;
      }
      let triggerUpdate: () => void = () => undefined; // The empty function is for the linter. I love you linter <3
      const updateProvider = (timeoutId: number) => async () => {
        forgetPendingTimeout(timeoutId);
        await runProvider(provider);
        triggerUpdate();
      };
      triggerUpdate = () => pendingTimeouts.push(setTimeout(updateProvider, provider.pollPeriodMs));
      triggerUpdate();
    });
  },

  /** Create providers to match from {@link IServiceDiagnosticProvider} to multiple {@link IDiagnosticProvider}s */
  registerServiceProviders(
    name: string,
    getService: () => IServiceDiagnosticProvider,
    overrideTags: Partial<
      typeof serviceDiagnosticDepthToTags | { [key in TServiceDiagnosticDepth]: false }
    > = {},
  ) {
    this.registerProviders(
      ...Object.values(TServiceDiagnosticDepth)
        .map(depth => {
          const defaultTags = serviceDiagnosticDepthToTags[depth];
          if (!defaultTags) throw new Error(`Unknown depth ${JSON.stringify(depth)}`);
          const tags = overrideTags[depth] ?? defaultTags;
          if (tags === false) return null;
          return {
            key: `${name}-${depth}`,
            tags,
            get: () => getService().getDiagnostics(depth),
          };
        })
        .filter(x => !!x),
    );
  },

  /** Cancel all pending diagnostic updates */
  shutdown() {
    ensureHasntShutdown();
    pendingTimeouts.forEach(timeout => clearTimeout(timeout));
    hasShutdown = true;
  },

  /** Return the values of all providers which include the provided tag */
  async get(
    tag: TDiagnosticTag,
  ): Promise<{ ok: boolean } | { [key: TDiagnosticKey]: TDiagnosticResult }> {
    const config = getConfig();
    const result = { ok: true };
    let atLeastOneCheck = false;
    periodicDiagnosticProviders.forEach(provider => {
      if (!isProviderIncludedInTag(tag, provider, config)) return;
      atLeastOneCheck = true;
      result[provider.key] = latestPeriodicDiagnostics[provider.key];
      if (!result[provider.key].ok) result.ok = false;
    });
    await Promise.all(
      immediateDiagnosticProviders.map(async provider => {
        if (!isProviderIncludedInTag(tag, provider, config)) return;
        atLeastOneCheck = true;
        const providerResult = await runProvider(provider);
        if (!providerResult.ok) result.ok = false;
        return (result[provider.key] = providerResult);
      }),
    );
    if (!atLeastOneCheck) result.ok = false;
    return result;
  },
};
