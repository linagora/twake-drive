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

def content_types(with_styles):
    styles_override = (
        '<Override PartName="/word/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        if with_styles else ''
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        f'{styles_override}'
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

# Lien document -> styles.xml (présent uniquement si la fixture a des styles).
DOC_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" '
    'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
    'Target="styles.xml"/>'
    '</Relationships>'
)

# styles.xml minimal : Normal (défaut) + Titre 1 / Titre 2 built-in. Les noms
# `heading 1`/`heading 2` sont les noms OOXML canoniques → OO les mappe sur ses
# styles intégrés et `GetStyle().GetName()` renvoie "Heading 1"/"Heading 2".
STYLES_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
    '<w:style w:type="paragraph" w:styleId="Heading1">'
    '<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>'
    '<w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Heading2">'
    '<w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>'
    '<w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>'
    '</w:styles>'
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


def _norm_para(p):
    """Un paragraphe = soit une liste de runs (sans style), soit
    { 'runs': [...], 'style'?: 'Heading1' }. → (runs, style)."""
    if isinstance(p, dict):
        return p.get('runs', []), p.get('style')
    return p, None


def para_xml(p):
    runs, style = _norm_para(p)
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ''
    body = ''.join(run_xml(r) for r in runs) if runs else ''
    return f'<w:p>{ppr}{body}</w:p>'


def document_xml(paras):
    body = ''.join(para_xml(p) for p in paras)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{W}"><w:body>'
        f'{body}<w:sectPr/></w:body></w:document>'
    )


def write_docx(path, paras):
    with_styles = any(_norm_para(p)[1] for p in paras)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types(with_styles))
        z.writestr('_rels/.rels', RELS)
        z.writestr('word/document.xml', document_xml(paras))
        if with_styles:
            z.writestr('word/_rels/document.xml.rels', DOC_RELS)
            z.writestr('word/styles.xml', STYLES_XML)


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
    {
        # Famille A stylée — MIROIR de a-family (mêmes textes/offsets, donc les
        # specs A0..A5 s'appliquent telles quelles) mais P1=Titre 1, P2=Titre 2,
        # P3=Normal. Couvre l'axe « style du paragraphe hôte » (SELECTION-CASES §5bis).
        'name': 'styled-family.docx',
        'paras': [
            {'style': 'Heading1', 'runs': [{'t': 'The quick brown fox'}]},
            {'style': 'Heading2', 'runs': [{'t': 'Jumps over the dog'}]},
            [{'t': 'Lazy river flows'}],  # Normal (pas de style)
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
