# File Picker optimization decision report

**Status: validated.** The recommendations and the accepted omission of the Cozy Stack image identity were validated on 2026-07-17. Raw machine-readable evidence is [file-picker-optimization-campaign.json](./file-picker-optimization-campaign.json).

## Decision summary

The campaign directly measured a neutral baseline, each isolated optimization, and the combined implementation. Five recorded cold-cache runs followed one unrecorded warm-up per variant. Timing distributions overlap substantially for the isolated prefetch and locale variants, so timing differences are **non-conclusive**, not user-visible claims. Static JavaScript reductions are directly measurable build effects. The combined result is direct evidence and is not the sum of isolated deltas.

| Optimization | Recommendation | Evidence-based reason |
|---|---|---|
| Force-splitting removal | **Retain** | Intent initial JavaScript gzip falls materially; startup timing is directionally faster but not treated as conclusive user gain. |
| Root-folder prefetch | **Discuss** | Root request count remains one and timing distributions overlap; no independent user-visible gain is established. |
| Intent locale splitting | **Retain** | Intent initial JavaScript gzip decreases; startup timing overlaps and is therefore non-conclusive. |
| Combined | **Retain, subject to validation** | Directly measured static payload reduction and faster median; interaction timing remains constrained, Chromium-only evidence. |

## Scope and protocol

Chromium only, 1280x720, synthetic 40 ms latency, 1.50 Mbps down, 0.73 Mbps up, 4x CPU throttling, browser cache disabled. The same retained Cozy Stack campaign runtime, French benchmark instance, deterministic files, and host were reused. Each variant ran one warm-up then exactly five recorded runs; medians are reported without means or standard deviations. Absolute times are not typical user experience. Host: kubik, linux 6.17.0-35-generic, x64, v24.15.0, Yarn 4.17.0. Cozy Stack image identity was unavailable in the runner output. This known reproducibility limitation was accepted during report validation.

Variants and revisions are recorded in the JSON. Build and targeted tests passed for all five variants; File Picker E2E validation passed before and during the campaign.

## Primary metrics

Each candidate is compared independently with neutral. Deltas are candidate minus baseline; percentages use the baseline. Byte values include exact bytes and KiB.

### force-splitting

| Metric | Baseline | Candidate | Delta | Delta % |
|---|---:|---:|---:|---:|
| First actionable row | 11523.0 ms | 10394.8 ms | -1128.2 ms | -9.8% |
| Runtime JS transferred before interaction | 2,375,301 B (2319.6 KiB) | 2,375,301 B (2319.6 KiB) | 0 B (0.0 KiB) | +0.0% |
| Runtime JS requests before interaction | 13.0 | 13.0 | 0.0 | +0.0% |
| Root-folder requests | 1.0 | 1.0 | 0.0 | +0.0% |
| Successful root-folder requests | 1.0 | 1.0 | 0.0 | +0.0% |
| Initial intents JavaScript gzip | 1,706,303 B (1666.3 KiB) | 1,364,773 B (1332.8 KiB) | -341,530 B (-333.5 KiB) | -20.0% |

Timing raw values (ms): baseline 12363.0, 10363.6, 11523.0, 10239.7, 11940.5; candidate 10394.8, 10408.2, 10268.5, 10572.5, 10214.0. Limited overlap; no typical-user timing gain is claimed.

### prefetch

| Metric | Baseline | Candidate | Delta | Delta % |
|---|---:|---:|---:|---:|
| First actionable row | 11523.0 ms | 10240.1 ms | -1282.9 ms | -11.1% |
| Runtime JS transferred before interaction | 2,375,301 B (2319.6 KiB) | 2,375,301 B (2319.6 KiB) | 0 B (0.0 KiB) | +0.0% |
| Runtime JS requests before interaction | 13.0 | 13.0 | 0.0 | +0.0% |
| Root-folder requests | 1.0 | 1.0 | 0.0 | +0.0% |
| Successful root-folder requests | 1.0 | 1.0 | 0.0 | +0.0% |
| Initial intents JavaScript gzip | 1,706,303 B (1666.3 KiB) | 1,706,359 B (1666.4 KiB) | 56 B (0.1 KiB) | +0.0% |

Timing raw values (ms): baseline 12363.0, 10363.6, 11523.0, 10239.7, 11940.5; candidate 10240.1, 10209.7, 10352.4, 10198.7, 11561.9. Substantial overlap; timing result is non-conclusive.

### locales

| Metric | Baseline | Candidate | Delta | Delta % |
|---|---:|---:|---:|---:|
| First actionable row | 11523.0 ms | 11429.7 ms | -93.3 ms | -0.8% |
| Runtime JS transferred before interaction | 2,375,301 B (2319.6 KiB) | 2,375,301 B (2319.6 KiB) | 0 B (0.0 KiB) | +0.0% |
| Runtime JS requests before interaction | 13.0 | 13.0 | 0.0 | +0.0% |
| Root-folder requests | 1.0 | 1.0 | 0.0 | +0.0% |
| Successful root-folder requests | 1.0 | 1.0 | 0.0 | +0.0% |
| Initial intents JavaScript gzip | 1,706,303 B (1666.3 KiB) | 1,647,097 B (1608.5 KiB) | -59,206 B (-57.8 KiB) | -3.5% |

Timing raw values (ms): baseline 12363.0, 10363.6, 11523.0, 10239.7, 11940.5; candidate 10239.8, 10154.4, 11429.7, 12558.5, 11473.9. Substantial overlap; timing result is non-conclusive.

### combined

| Metric | Baseline | Candidate | Delta | Delta % |
|---|---:|---:|---:|---:|
| First actionable row | 11523.0 ms | 10674.7 ms | -848.3 ms | -7.4% |
| Runtime JS transferred before interaction | 2,375,301 B (2319.6 KiB) | 2,375,301 B (2319.6 KiB) | 0 B (0.0 KiB) | +0.0% |
| Runtime JS requests before interaction | 13.0 | 13.0 | 0.0 | +0.0% |
| Root-folder requests | 1.0 | 1.0 | 0.0 | +0.0% |
| Successful root-folder requests | 1.0 | 1.0 | 0.0 | +0.0% |
| Initial intents JavaScript gzip | 1,706,303 B (1666.3 KiB) | 1,305,630 B (1275.0 KiB) | -400,673 B (-391.3 KiB) | -23.5% |

Timing raw values (ms): baseline 12363.0, 10363.6, 11523.0, 10239.7, 11940.5; candidate 11154.2, 10154.3, 10118.6, 10674.7, 11907.0. Substantial overlap; timing result is non-conclusive.

## Static build effects

Static initial JavaScript and runtime JavaScript transferred before interaction are separate measurements.

| Variant | Main initial JS gzip | Public initial JS gzip | Intent initial JS gzip | Total generated JS+CSS gzip | Registry archive gzip | Request shape (main/public/intents) |
|---|---:|---:|---:|---:|---:|---|
| neutral | 2,862,600 B (2795.5 KiB) | 2,747,223 B (2682.8 KiB) | 1,706,303 B (1666.3 KiB) | 6,573,524 B (6419.5 KiB) | 12,626,090 B (12330.2 KiB) | 10+4; 10+4; 8+3 |
| force-splitting | 2,862,716 B (2795.6 KiB) | 2,627,362 B (2565.8 KiB) | 1,364,773 B (1332.8 KiB) | 6,595,743 B (6441.2 KiB) | 12,650,884 B (12354.4 KiB) | 9+4; 10+4; 8+3 |
| prefetch | 2,862,595 B (2795.5 KiB) | 2,747,218 B (2682.8 KiB) | 1,706,359 B (1666.4 KiB) | 6,573,572 B (6419.5 KiB) | 12,626,138 B (12330.2 KiB) | 10+4; 10+4; 8+3 |
| locales | 2,862,028 B (2794.9 KiB) | 2,746,650 B (2682.3 KiB) | 1,647,097 B (1608.5 KiB) | 6,648,703 B (6492.9 KiB) | 12,707,565 B (12409.7 KiB) | 10+4; 10+4; 8+3 |
| combined | 2,862,156 B (2795.1 KiB) | 2,626,803 B (2565.2 KiB) | 1,305,630 B (1275.0 KiB) | 6,671,010 B (6514.7 KiB) | 12,729,556 B (12431.2 KiB) | 9+4; 10+4; 8+3 |

Generated JavaScript, public/main output, total generated output, request shape, and deterministic publication archive are disclosed above.

## Risk assessment

| Optimization | Modified surface / behavior | Failure mode and fallback | Coverage and rollback | Wider build effect |
|---|---|---|---|---|
| Force-splitting removal | Rsbuild chunk grouping; no intended functional change. | A missing shared chunk or cache-order issue can break startup; revert cache-group change. | Targeted unit tests and 13 File Picker E2E tests passed; single commit revert. | Main request shape 14 to 13 and intent static gzip reduction; total/archive slightly increase. |
| Root-folder prefetch | Intent startup query/cache coordination; root listing begins earlier and picker consumes cached result. | Stale/error cache or duplicate request; existing query/error path remains fallback. | Targeted tests and E2E passed; revert prefetch seam. | Near-neutral generated assets and request shape; no measured runtime transfer change. |
| Intent locale splitting | Locale loading and chunk/resource query; fallback English plus current locale. | Missing locale chunk or loading failure; English fallback remains. | Locale unit test, targeted tests, and E2E passed; revert locale loader. | Intent gzip decreases but total/archive increase. |
| Combined | All three surfaces together. | Interactions can be non-additive; fallback/revert full combined change. | Targeted tests and E2E passed; revert independently if isolating regressions. | Intent gzip reduction with total/archive increase; measured directly, never calculated. |

## Validation

The recommendations, uncertainty labels, and accepted omission of the Cozy Stack image identity were validated on 2026-07-17. The pull request summary may be derived from this report.
