// ============================================================================
// SONDE — Cellules fusionnées (T12) — répond aux questions Q1, Q2, Q3 de §4bis
// de SELECTION-CASES.md. Lecture seule (ne modifie pas le document).
//
// MODE D'EMPLOI
//   1. Dans l'éditeur OO, SÉLECTIONNE à l'intérieur du tableau à sonder.
//      Pour tester la fusion VERTICALE : sélectionne UNIQUEMENT la/les ligne(s)
//      de continuation d'une cellule fusionnée verticalement.
//   2. DevTools → choisis le contexte JS de l'iframe `scribe` (menu déroulant
//      des frames) → colle TOUT ce bloc.
//   3. Lis le JSON imprimé sous « SCRIBE PROBE RESULT » (aussi dans window.__scribeProbe).
//
// Lecture du résultat :
//   - selectionToCell : pour chaque ¶ sélectionné, la cellule (rowIndex,cellIndex)
//     renvoyée par GetParentTableCell().  → Q1 : si tu n'as sélectionné que des
//     lignes de continuation et que rowIndex pointe une ligne PLUS HAUTE, OO
//     renvoie le MAÎTRE (attribution de ligne décalée — risque T12b confirmé).
//   - grid[r].cellsCount : nb de cellules logiques de la ligne r. → Q3 : si une
//     ligne fusionnée horizontalement a MOINS de cellules, GetCellsCount reflète
//     la fusion (les `c` ne sont donc pas des colonnes visuelles).
//   - grid[r].cells[c] : ce que renvoie GetCell(r,c) par emplacement logique.
//     → Q2 : un emplacement de continuation est-il `exists:false`, vide
//     (elems:0), ou porte-t-il le texte du maître ?
// ============================================================================
Asc.plugin.callCommand(function () {
  function cellText(cell) {
    var c = cell && cell.GetContent ? cell.GetContent() : null;
    if (!c) return { elems: 0, text: "" };
    var n = c.GetElementsCount();
    var s = "";
    for (var i = 0; i < n; i++) {
      var el = c.GetElement(i);
      if (el.GetClassType && el.GetClassType() === "paragraph" && el.GetText) {
        s += el.GetText();
      }
    }
    return { elems: n, text: s.substring(0, 40) };
  }

  var doc = Api.GetDocument();
  var range = doc.GetRangeBySelect();
  var selParas = range && range.GetAllParagraphs ? range.GetAllParagraphs() : [];

  // Q1 — chaque ¶ sélectionné → cellule parente
  var selMap = [];
  for (var i = 0; i < selParas.length; i++) {
    var pc = selParas[i].GetParentTableCell ? selParas[i].GetParentTableCell() : null;
    var entry = {
      paraText: selParas[i].GetText ? selParas[i].GetText().substring(0, 30) : "",
      inCell: !!pc
    };
    if (pc) {
      entry.rowIndex = pc.GetRowIndex ? pc.GetRowIndex() : null;
      entry.cellIndex = pc.GetIndex ? pc.GetIndex() : null;
    }
    selMap.push(entry);
  }

  // Choisir le tableau : celui qui contient le début de la sélection, sinon le 1er
  var allTables = doc.GetAllTables();
  var selStart = range && range.GetStartPos ? range.GetStartPos() : -1;
  var table = null;
  for (var ti = 0; ti < allTables.length; ti++) {
    var tr = allTables[ti].GetRange();
    if (!tr) continue;
    if (selStart >= tr.GetStartPos() && selStart <= tr.GetEndPos()) { table = allTables[ti]; break; }
  }
  if (!table && allTables.length) table = allTables[0];
  if (!table) return JSON.stringify({ error: "Aucun tableau — sélectionne dans un tableau d'abord." });

  // Q2 + Q3 — grille logique : par ligne, GetCellsCount + GetCell(r,c)
  var rowCount = table.GetRowsCount();
  var grid = [];
  for (var r = 0; r < rowCount; r++) {
    var row = table.GetRow(r);
    var cc = row.GetCellsCount();
    var cells = [];
    for (var c = 0; c < cc; c++) {
      var cell = table.GetCell(r, c);
      var info = { c: c, exists: !!cell };
      if (cell) {
        info.rowIndex = cell.GetRowIndex ? cell.GetRowIndex() : null;
        info.cellIndex = cell.GetIndex ? cell.GetIndex() : null;
        var t = cellText(cell);
        info.elems = t.elems;
        info.text = t.text;
      }
      cells.push(info);
    }
    grid.push({ r: r, cellsCount: cc, cells: cells });
  }

  return JSON.stringify({ rowCount: rowCount, selectionToCell: selMap, grid: grid }, null, 2);
}, false, false, function (ret) {
  console.log("SCRIBE PROBE RESULT:\n" + ret);
  try { window.__scribeProbe = ret; } catch (e) {}
});


// ============================================================================
// SONDE STRUCTURE (Q encodage) — dompe le ToJSON du tableau pour voir comment
// OO encode les fusions (cherche "vMerge" / "gridSpan" / "hMerge" dans la sortie).
// Lecture seule. Premier tableau du document.
// ============================================================================
// Asc.plugin.callCommand(function () {
//   var t = Api.GetDocument().GetAllTables()[0];
//   return t ? t.ToJSON(true, true) : "no table";
// }, false, false, function (ret) {
//   console.log("SCRIBE TABLE JSON (cherche vMerge/gridSpan):\n" + ret);
//   try { window.__scribeTableJson = ret; } catch (e) {}
// });


// ============================================================================
// Q4 — DESTRUCTIF (opt-in) — RemoveColumn corrompt-il un span ?
// ⚠️ MODIFIE LE DOCUMENT. Garde Ctrl+Z prêt. Sélectionne d'abord une cellule
// d'une COLONNE traversée par une fusion horizontale, puis décommente et exécute.
// Compare la structure (relance la sonde ToJSON ci-dessus) avant/après.
// ============================================================================
// Asc.plugin.callCommand(function () {
//   var doc = Api.GetDocument();
//   var range = doc.GetRangeBySelect();
//   var paras = range ? range.GetAllParagraphs() : [];
//   var pc = paras.length && paras[0].GetParentTableCell ? paras[0].GetParentTableCell() : null;
//   if (!pc) return "select a cell inside the merged column first";
//   var tbl = null, all = doc.GetAllTables();
//   for (var i = 0; i < all.length; i++) { var tr = all[i].GetRange(); if (tr && range.GetStartPos() >= tr.GetStartPos() && range.GetStartPos() <= tr.GetEndPos()) { tbl = all[i]; break; } }
//   if (!tbl) return "no table";
//   tbl.RemoveColumn(pc); // <-- par RÉFÉRENCE de cellule (cf phase 26)
//   return "RemoveColumn done — inspect structure, then Ctrl+Z";
// }, false, true, function (ret) { console.log("SCRIBE Q4:", ret); });
