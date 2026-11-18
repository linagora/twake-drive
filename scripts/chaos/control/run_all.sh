#!/bin/bash
# Runs every script of features.yaml (in parallel), prints one line each: exit code, seconds, its last line.
# Not part of the contract: a helper to check the scripts by hand. ./run_all.sh [feature...]
DIR="$(cd "$(dirname "$0")" && pwd)"
features=("$@")
[ ${#features[@]} -gt 0 ] || mapfile -t features < <(sed -n 's/^    script: \(.*\)\.sh$/\1/p' "$DIR/features.yaml")
out="$(mktemp -d)"
default="$(sed -n 's/^timeout_seconds: //p' "$DIR/features.yaml")"
for f in "${features[@]}"; do
  ( s=$SECONDS; timeout "$(sed -n "/^  $f:/,/^  [a-z]/s/^    timeout_seconds: //p" "$DIR/features.yaml" | head -1 | grep . || echo "$default")" \
      bash "$DIR/$f.sh" >"$out/$f.log" 2>&1; echo "$? $((SECONDS - s))" >"$out/$f.rc" ) &
done
wait
for f in "${features[@]}"; do
  read -r rc t <"$out/$f.rc"
  printf '%-22s %3s %3ss  %s\n' "$f" "$rc" "$t" "$(tail -1 "$out/$f.log")"
done
rm -rf "$out"
