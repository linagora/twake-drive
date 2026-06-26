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
    # Police de paragraphe par défaut — requise comme basedOn des styles caractère liés.
    '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">'
    '<w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/>'
    '<w:semiHidden/><w:unhideWhenUsed/></w:style>'
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">'
    '<w:name w:val="Normal"/><w:qFormat/></w:style>'
    # Titre 1 = vrai built-in : qFormat (galerie) + link style caractère + uiPriority
    # + next + keepNext/keepLines, comme ce que produit Word/OO → OO le promeut en Titre 1.
    '<w:style w:type="paragraph" w:styleId="Heading1">'
    '<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>'
    '<w:link w:val="Heading1Char"/><w:uiPriority w:val="9"/><w:qFormat/>'
    '<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="0"/>'
    '<w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'
    '<w:style w:type="character" w:styleId="Heading1Char">'
    '<w:name w:val="Heading 1 Char"/><w:basedOn w:val="DefaultParagraphFont"/>'
    '<w:link w:val="Heading1"/><w:uiPriority w:val="9"/>'
    '<w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>'
    '<w:style w:type="paragraph" w:styleId="Heading2">'
    '<w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>'
    '<w:link w:val="Heading2Char"/><w:uiPriority w:val="9"/><w:qFormat/>'
    '<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="0"/>'
    '<w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>'
    '<w:style w:type="character" w:styleId="Heading2Char">'
    '<w:name w:val="Heading 2 Char"/><w:basedOn w:val="DefaultParagraphFont"/>'
    '<w:link w:val="Heading2"/><w:uiPriority w:val="9"/>'
    '<w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>'
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


# --- Tableaux ----------------------------------------------------------------
# Un élément « tableau » = {'table': rows} où rows = liste de lignes ; chaque
# ligne = liste de cellules ; chaque cellule = liste de paragraphes (chaque
# paragraphe = liste de runs, ou {'runs':..,'style':..}). Une cellule peut donc
# être multi-¶ (cas T8). Bordures fines visibles.
COL_W = 2400  # twips par colonne


def _norm_cell(cell):
    """Cellule = liste de ¶ (simple) OU dict de fusion
    { 'p': [¶...], 'gridSpan'?: int, 'vmerge'?: 'restart'|'cont' }.
    → (paras, gridSpan|None, vmerge|None). gridSpan>1 = fusion H ; vmerge = fusion V
    (maître = 'restart', continuation = 'cont', cellule vide distincte cf §4bis)."""
    if isinstance(cell, dict):
        return cell.get('p', []), cell.get('gridSpan'), cell.get('vmerge')
    return cell, None, None


def cell_xml(cell):
    paras, span, vmerge = _norm_cell(cell)
    props = f'<w:tcW w:w="{COL_W * (span or 1)}" w:type="dxa"/>'
    if span and span > 1:
        props += f'<w:gridSpan w:val="{span}"/>'
    if vmerge == 'restart':
        props += '<w:vMerge w:val="restart"/>'
    elif vmerge == 'cont':
        props += '<w:vMerge/>'
    body = ''.join(para_xml(p) for p in paras) if paras else '<w:p/>'
    return f'<w:tc><w:tcPr>{props}</w:tcPr>{body}</w:tc>'


def _row_cols(row):
    return sum((_norm_cell(c)[1] or 1) for c in row)


def table_xml(el):
    rows = el['table']
    ncols = max(_row_cols(r) for r in rows)
    grid = ''.join(f'<w:gridCol w:w="{COL_W}"/>' for _ in range(ncols))
    edges = ('top', 'left', 'bottom', 'right', 'insideH', 'insideV')
    borders = '<w:tblBorders>' + ''.join(
        f'<w:{e} w:val="single" w:sz="4" w:space="0" w:color="000000"/>' for e in edges
    ) + '</w:tblBorders>'
    tblpr = f'<w:tblPr><w:tblW w:w="{COL_W * ncols}" w:type="dxa"/>{borders}</w:tblPr>'
    trs = ''.join('<w:tr>' + ''.join(cell_xml(c) for c in row) + '</w:tr>' for row in rows)
    return f'<w:tbl>{tblpr}<w:tblGrid>{grid}</w:tblGrid>{trs}</w:tbl>'


def element_xml(el):
    if isinstance(el, dict) and 'table' in el:
        return table_xml(el)
    return para_xml(el)


def _has_styles(elements):
    for el in elements:
        if isinstance(el, dict) and 'table' in el:
            for row in el['table']:
                for cell in row:
                    for p in _norm_cell(cell)[0]:
                        if _norm_para(p)[1]:
                            return True
        elif _norm_para(el)[1]:
            return True
    return False


def document_xml(elements):
    body = ''.join(element_xml(e) for e in elements)
    # OOXML : un tableau ne peut pas être le dernier bloc ni précéder <w:sectPr>
    # sans un paragraphe entre les deux → garde un ¶ traînant si on finit sur un tbl.
    if isinstance(elements[-1], dict) and 'table' in elements[-1]:
        body += '<w:p/>'
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{W}"><w:body>'
        f'{body}<w:sectPr/></w:body></w:document>'
    )


def write_docx(path, paras):
    with_styles = _has_styles(paras)
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
    {
        # Famille A « formatée » — MIROIR de a-family (mêmes textes/offsets : "The
        # quick brown fox" = 19 chars, @start=0 @space=4 @mid=9 @end=19), mais avec
        # du formatage CHAR : "quick" gras, "fox" italique. Sert à tester L#1 — le
        # suffixe NON sélectionné garde son formatage (gras/italique) après un
        # remplacement partiel inline. Runs P1 : "The "(plain) "quick"(gras)
        # " brown "(plain) "fox"(ital).
        'name': 'format-family.docx',
        'paras': [
            [{'t': 'The '}, {'t': 'quick', 'b': 1}, {'t': ' brown '}, {'t': 'fox', 'i': 1}],
            [{'t': 'Jumps over the dog'}],
            [{'t': 'Lazy river flows'}],
        ],
    },
    {
        # Famille TABLEAU (plain, sans fusion) — support des cas T1/T2a/T3/T8/T9.
        # Doc : ¶ "Intro" + tableau 2×2 + ¶ "Outro" (table en milieu de doc, réaliste).
        # Cellules adressables : (0,0)="Alpha" (0,1)="Beta" (1,0)="Gamma"
        # (1,1)= 2 ¶ "Delta"/"Delta2" (cellule MULTI-¶ pour T8). Les ¶ Intro/Outro
        # encadrants servent à vérifier qu'une injection en cellule NE DÉBORDE PAS
        # hors du tableau (§4ter).
        'name': 'table-plain.docx',
        'paras': [
            [{'t': 'Intro paragraph'}],
            {'table': [
                [[[{'t': 'Alpha'}]], [[{'t': 'Beta'}]]],
                [[[{'t': 'Gamma'}]], [[{'t': 'Delta'}], [{'t': 'Delta2'}]]],
            ]},
            [{'t': 'Outro paragraph'}],
        ],
    },
    {
        # Famille TABLEAU FUSIONNÉE — support T2b (fusion H) + T2c (fusion V).
        # Géométrie calquée sur la sonde §4bis : table 4×3, fusion V sur la col 0
        # (lignes 1-2) et fusion H sur les cols 1-2 (ligne 3). Encadrée Intro/Outro
        # pour la détection de débordement. Indices LOGIQUES (r,c) attendus côté OO :
        #   r0: (0,0)=H00      (0,1)=H01    (0,2)=H02
        #   r1: (1,0)=Vmaster  (1,1)=B1     (1,2)=C1      ← maître V (vMerge restart)
        #   r2: (2,0)=∅cont    (2,1)=B2     (2,2)=C2      ← continuation V vide (§4bis)
        #   r3: (3,0)=M30      (3,1)=Hspan               ← Hspan = gridSpan 2 (cols 1+2)
        # Donc r3 n'a que 2 cellules logiques (fusion H → moins de cellules, §4bis).
        'name': 'table-merged.docx',
        'paras': [
            [{'t': 'Intro paragraph'}],
            {'table': [
                [[[{'t': 'H00'}]], [[{'t': 'H01'}]], [[{'t': 'H02'}]]],
                [{'vmerge': 'restart', 'p': [[{'t': 'Vmaster'}]]}, [[{'t': 'B1'}]], [[{'t': 'C1'}]]],
                [{'vmerge': 'cont'}, [[{'t': 'B2'}]], [[{'t': 'C2'}]]],
                [[[{'t': 'M30'}]], {'gridSpan': 2, 'p': [[{'t': 'Hspan'}]]}],
            ]},
            [{'t': 'Outro paragraph'}],
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
