#!/usr/bin/env python3
"""Génère les .docx source minimaux du corpus de cas de sélection (T-04).

Pourquoi un générateur plutôt qu'un .docx édité à la main : la SORTIE (.docx) est
versionnée (choix utilisateur), mais le contenu reste un texte diff-able et le doc
est minimal -> le modèle capturé par dumpState EST le golden, sans bruit.

Chaque fixture = un dict { 'name': fichier.docx, 'paras': [ [runs...] ] } où un run
est { 't': texte, 'b'?:1, 'i'?:1, 'u'?:1, 's'?:1 } (gras/ital/souligné/barré).

Lancer :  python3 test-harness/fixtures/gen_fixtures.py
"""
import os
import zipfile
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))

CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" '
    'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '</Types>'
)

RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" '
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
    'Target="word/document.xml"/>'
    '</Relationships>'
)

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def run_xml(run):
    props = ''
    if run.get('b'):
        props += '<w:b/>'
    if run.get('i'):
        props += '<w:i/>'
    if run.get('u'):
        props += '<w:u w:val="single"/>'
    if run.get('s'):
        props += '<w:strike/>'
    rpr = f'<w:rPr>{props}</w:rPr>' if props else ''
    text = escape(run.get('t', ''))
    return f'<w:r>{rpr}<w:t xml:space="preserve">{text}</w:t></w:r>'


def para_xml(runs):
    body = ''.join(run_xml(r) for r in runs) if runs else ''
    return f'<w:p>{body}</w:p>'


def document_xml(paras):
    body = ''.join(para_xml(p) for p in paras)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{W}"><w:body>'
        f'{body}<w:sectPr/></w:body></w:document>'
    )


def write_docx(path, paras):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', CONTENT_TYPES)
        z.writestr('_rels/.rels', RELS)
        z.writestr('word/document.xml', document_xml(paras))


# --- Corpus de fixtures ------------------------------------------------------
FIXTURES = [
    {
        # Famille A (paragraphes) — couvre A0..A6 (cursor, mot partiel, espaces,
        # multi-paragraphes). Plain runs : le smart-spacing / la structure sont
        # ce qu'on teste, pas le formatage d'entrée.
        'name': 'a-family.docx',
        'paras': [
            [{'t': 'The quick brown fox'}],
            [{'t': 'Jumps over the dog'}],
            [{'t': 'Lazy river flows'}],
        ],
    },
]


def main():
    for fx in FIXTURES:
        out = os.path.join(HERE, fx['name'])
        write_docx(out, fx['paras'])
        print(f"wrote {out}  ({len(fx['paras'])} paragraphs)")


if __name__ == '__main__':
    main()
