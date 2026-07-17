# File Picker optimization campaign

Run the five variants from their existing worktrees with one retained E2E
stack and write the complete machine-readable result set:

```sh
yarn measure:file-picker-campaign \
  --output docs/performance/file-picker-optimization-campaign.json \
  --variant neutral=/tmp/twake-drive-variants \
  --variant force-splitting=/tmp/twake-drive-force \
  --variant prefetch=/tmp/twake-drive-prefetch \
  --variant locales=/tmp/twake-drive-locales \
  --variant combined=/tmp/twake-drive-combined
```

Each variant is built and validated before its measurement. The browser test
performs one unrecorded warm-up and exactly five browser-cache-cold runs. It
retains every raw interaction timing, JavaScript request/transfer metric, and
root-folder request count. The runner also records each revision, generated
asset report, host identity, Node/Yarn versions, Cozy Stack image identity, and
throttling profile.

The campaign fails on a failed build, targeted test, or File Picker E2E test;
therefore a result file never presents a failed variant as performance evidence.
The runner does not push branches or modify pull requests. Keep the generated
JSON under review with the report rather than replacing raw runs with medians.
