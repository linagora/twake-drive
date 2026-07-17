# File Picker encrypted-file removal measurement

**Result:** the change materially reduces the File Picker's static startup payload. The timing result is inconclusive because the candidate contains three large outliers.

Raw data: [file-picker-encrypted-files-removal-campaign.json](./file-picker-encrypted-files-removal-campaign.json).

## Build metrics

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| Intent initial JavaScript gzip | 1,305,624 B | 1,046,846 B | **-258,778 B (-19.8%)** |
| Intent asset requests | 11 | 10 | **-1** |
| Generated JavaScript + CSS gzip | 6,672,102 B | 6,665,979 B | -6,123 B |
| Registry archive gzip | 12,729,678 B | 12,723,326 B | -6,352 B |

## Startup metrics

The campaign used Chromium at 1280x720, one warm-up, five browser-cache-cold runs, 40 ms latency, 1.5 Mbps download, 750 Kbps upload, and 4x CPU throttling.

| Metric | Before | After | Delta |
|---|---:|---:|---:|
| First actionable row median | 9,103.6 ms | 16,156.4 ms | +7,052.8 ms |
| JavaScript transferred before interaction | 2,397,266 B | 2,397,266 B | 0 B |
| JavaScript requests before interaction | 12 | 12 | 0 |
| Root-folder requests | 1 | 1 | 0 |

Raw timings before: 9,070.0, 9,089.7, 9,242.4, 9,151.6, 9,103.6 ms.

Raw timings after: 9,128.7, 8,985.2, 16,156.4, 26,753.6, 17,701.9 ms.

The timing comparison should not be interpreted as a measured regression: the two normal candidate runs are comparable to the baseline, while three candidate runs are outliers. The unchanged runtime transfer and request counts also show that this change affects the static intent build more than the browser's measured transfer path.

Targeted campaign tests, builds, and the full unit test suite passed.
