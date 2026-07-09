#!/usr/bin/env python3
"""Génère les tableaux markdown de SELECTION-CASES.md depuis les CSV.

Source de vérité = cases.csv / content-fixtures.csv. Sens UNIQUE CSV => MD.
NE PAS éditer les tableaux générés à la main (zones entre marqueurs
<!-- cases:table:KEY:start --> ... <!-- cases:table:KEY:end -->).

Usage: python3 .planning/tools/gen_matrices.py [--check]
  --check : échoue (exit 1) si le MD n'est pas à jour (pour CI), sans écrire.
"""
import csv, re, sys, pathlib

PLANNING = pathlib.Path(__file__).resolve().parent.parent
CASES = PLANNING / "cases.csv"
CONTENT = PLANNING / "content-fixtures.csv"
TARGET = PLANNING / "SELECTION-CASES.md"

BADGE = {"pass": "✅ ", "xfail": "⚠️ ", "na": "— ", "deferred": "🔜 ", "unsupported": "❌ "}


def esc(s):
    return (s or "").replace("|", "\\|").strip()


def fmt_limits(lim):
    lim = (lim or "").strip()
    if not lim:
        return ""
    out = []
    for p in lim.split(";"):
        p = p.strip().lstrip("Ll").lstrip("#")
        if p:
            out.append(f"**L#{p}**")
    return " ".join(out)


def etat(si, sr, lim, notes):
    statuses = (si, sr)
    if "unsupported" in statuses:
        badge = "❌ hors scope"
    elif "deferred" in statuses:
        badge = "🔜 à spécifier"
    elif "xfail" in statuses:
        badge = "⚠️"
    else:
        badge = "✅"
    parts = [badge]
    fl = fmt_limits(lim)
    if fl:
        parts.append(fl)
    if notes and notes.strip():
        parts.append(esc(notes))
    return " · ".join(parts)


def cell(status, text):
    return esc(BADGE.get(status, "") + (text or ""))


def read(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def gen_cases(groups):
    rows = [r for r in read(CASES) if r["group"] in groups]
    out = [
        "| # | Sélection *(description)* | Insérer | Remplacer | État / limite |",
        "|---|---|---|---|---|",
    ]
    for r in rows:
        sel = f"`{esc(r['selection'])}` *({esc(r['description'])})*"
        out.append(
            f"| {r['id']} | {sel} | {cell(r['status_insert'], r['expected_insert'])} | "
            f"{cell(r['status_replace'], r['expected_replace'])} | "
            f"{etat(r['status_insert'], r['status_replace'], r['limits'], r['notes'])} |"
        )
    return "\n".join(out)


def gen_content():
    out = ["| Contenu | Insérer | Remplacer | État / limite |", "|---|---|---|---|"]
    for r in read(CONTENT):
        out.append(
            f"| {esc(r['content'])} | {cell(r['status'], r['expected_insert'])} | "
            f"{cell(r['status'], r['expected_replace'])} | "
            f"{etat(r['status'], r['status'], r['limits'], r['notes'])} |"
        )
    return "\n".join(out)


BLOCKS = {
    "paragraph": lambda: gen_cases({"paragraph"}),
    "table": lambda: gen_cases({"table", "guard"}),
    "content": gen_content,
}


def replace_block(text, key, content):
    start = f"<!-- cases:table:{key}:start -->"
    end = f"<!-- cases:table:{key}:end -->"
    pat = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if not pat.search(text):
        sys.exit(f"ERREUR: marqueurs absents pour '{key}' dans {TARGET.name}")
    return pat.sub(lambda m: f"{start}\n{content}\n{end}", text)


def main():
    check = "--check" in sys.argv
    text = TARGET.read_text(encoding="utf-8")
    new = text
    for key, fn in BLOCKS.items():
        new = replace_block(new, key, fn())
    if check:
        if new != text:
            sys.exit("MD désynchronisé du CSV — relance gen_matrices.py")
        print("MD à jour ✓")
        return
    if new != text:
        TARGET.write_text(new, encoding="utf-8")
        print(f"régénéré: {TARGET.name}")
    else:
        print("déjà à jour ✓")


if __name__ == "__main__":
    main()
