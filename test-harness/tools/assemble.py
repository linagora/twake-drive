#!/usr/bin/env python3
"""Forcesave an OO doc and download its .docx into a golden bundle, verifying the
edit landed (the unique token must appear in word/document.xml). Retries because
forcesave is async and `error:4` just means "autosave already up to date".

Usage: assemble.py <outDir> <fileName> <docKey> <expectToken> [maxTries]
  <fileName>  OO example storage name, e.g. "table-plain (11).docx" (spaces/parens literal)
  <docKey>    window.config.document.key of the open editor
  <expectToken> a string that MUST be in the saved docx (proves the inject persisted)
Writes <outDir>/after.docx. Exits non-zero if the token never appears.
"""
import sys, time, json, zipfile, io, subprocess, urllib.parse, os

def curl(args):
    return subprocess.run(["curl", "-s"] + args, capture_output=True).stdout

def forcesave(key):
    out = curl(["-X", "POST", "http://localhost/command/", "-H", "Content-Type: application/json",
                "-d", json.dumps({"c": "forcesave", "key": key})])
    try: return json.loads(out.decode("utf-8", "replace"))
    except Exception: return {"raw": out.decode("utf-8", "replace")}

def download(file_name):
    url = "http://localhost/example/download?fileName=" + urllib.parse.quote(file_name, safe="().")
    return curl([url])

def token_in_docx(blob, token):
    try:
        z = zipfile.ZipFile(io.BytesIO(blob))
        xml = z.read("word/document.xml").decode("utf-8", "replace")
        return token in xml
    except Exception:
        return False

def main():
    out_dir, file_name, key, token = sys.argv[1:5]
    max_tries = int(sys.argv[5]) if len(sys.argv) > 5 else 8
    os.makedirs(out_dir, exist_ok=True)
    last = None
    for i in range(max_tries):
        fs = forcesave(key)
        time.sleep(1.2)
        blob = download(file_name)
        last = blob
        if token_in_docx(blob, token):
            with open(os.path.join(out_dir, "after.docx"), "wb") as f:
                f.write(blob)
            print(f"OK try={i+1} forcesave={fs} bytes={len(blob)} token={token!r} present")
            return 0
        print(f"retry {i+1}/{max_tries}: forcesave={fs} bytes={len(blob)} token not yet present")
    if last:
        with open(os.path.join(out_dir, "after.docx"), "wb") as f:
            f.write(last)
    print(f"FAIL: token {token!r} never appeared after {max_tries} tries (wrote last download anyway)")
    return 1

if __name__ == "__main__":
    sys.exit(main())
