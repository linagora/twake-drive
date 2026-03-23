(function(window, undefined) {
  "use strict";

  // ---- State ----
  var lastSelectedText = "";
  var lastSelectedHtml = "";
  var lastEnrichedMd = "";
  var lastTableDocIndices = [];
  var imageCounter = 0;
  var pendingIntents = {};
  var cozyOrigin = "*"; // TODO: restrict to actual Cozy origin in production

  // ---- Target window for postMessage ----
  // Cozy apps run inside an iframe from the Cozy Stack, so the frame hierarchy is:
  //   Cozy Stack (window.top) > Cozy Drive iframe > OO Editor iframe > Plugin iframe
  // CozyBridge listens on the Cozy Drive iframe window, which is window.parent.parent.
  // We post to all ancestor frames so the message reaches CozyBridge regardless of nesting.
  function postToAncestors(message) {
    var current = window.parent;
    while (current && current !== window) {
      try {
        current.postMessage(message, cozyOrigin);
      } catch (e) {
        // Cross-origin frame we can't post to — stop
        break;
      }
      if (current === current.parent) break;
      current = current.parent;
    }
  }

  // ---- Helper: log(msg) ----
  function log(msg) {
    console.log("[Scribe] " + msg);
  }

  // ---- Helper: generateIntentId() ----
  function generateIntentId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Fallback: timestamp + random
    return "intent-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  }

  // ---- castIntent: send an intent to Cozy Drive via postMessage ----
  // Per locked user decision: Promise-based API.
  // The plugin iframe (not callCommand) runs in a modern browser context
  // where Promise should be available. Fallback to callback-only if not.
  function castIntent(action, data, oneWay) {
    var intentId = generateIntentId();
    var message = {
      type: "cozy-bridge:intent",
      version: 1,
      intentId: intentId,
      action: action,
      source: "onlyoffice-plugin",
      data: data
    };

    postToAncestors(message);
    if (!oneWay) log("Intent cast: " + action);

    if (oneWay) return undefined;

    if (typeof Promise !== "undefined") {
      return new Promise(function(resolve, reject) {
        pendingIntents[intentId] = { action: action, resolve: resolve, reject: reject };
      });
    } else {
      log("Promise unavailable in sandbox -- using callback fallback");
      pendingIntents[intentId] = { action: action, resolve: null, reject: null };
      return undefined;
    }
  }

  // Build AI_TEXT_ASSISTANT intent data with enriched markdown (EXTR-01)
  function buildEditIntentData() {
    var data = { text: lastSelectedText };
    if (lastEnrichedMd && lastEnrichedMd.length > 0) {
      data.enrichedMd = lastEnrichedMd;
    }
    return data;
  }

  // ---- Paste HTML with smart spacing ----
  // Prevents init() and polling from interfering during paste.
  var pasteInProgress = false;

  // ---- Register <u> underline extension for marked.lexer ----
  // Custom inline extension so marked tokenizes <u>...</u> into underline tokens
  // with recursive child token parsing for nested formatting (e.g. <u>**bold**</u>).
  if (window.marked && window.marked.use) {
    window.marked.use({
      extensions: [{
        name: "underline",
        level: "inline",
        start: function(src) {
          return src.indexOf("<u>");
        },
        tokenizer: function(src) {
          var match = src.match(/^<u>([\s\S]*?)<\/u>/);
          if (match) {
            return {
              type: "underline",
              raw: match[0],
              text: match[1],
              tokens: []
            };
          }
        },
        childTokens: ["tokens"],
        renderer: function(token) { return "<u>" + token.text + "</u>"; }
      }]
    });
  }

  // ---- flattenTokens: convert marked lexer output to flat paragraph+runs ----
  // Takes the array returned by marked.lexer(md) and produces:
  //   [{ type: "paragraph", runs: [{ text, bold, italic }] }]
  // Handles bold (strong), italic (em), nested formatting, and unknown block fallback.
  function flattenTokens(markedTokens) {
    var blocks = [];

    function flattenInline(tokens, parentBold, parentItalic, parentStrikethrough, parentCode, parentLink, parentUnderline) {
      var runs = [];
      for (var i = 0; i < tokens.length; i++) {
        var tok = tokens[i];
        if (tok.type === "text") {
          runs.push({ text: tok.text, bold: !!parentBold, italic: !!parentItalic, strikethrough: !!parentStrikethrough, underline: !!parentUnderline, code: !!parentCode, link: parentLink || null });
        } else if (tok.type === "strong") {
          runs = runs.concat(flattenInline(tok.tokens, true, parentItalic, parentStrikethrough, parentCode, parentLink, parentUnderline));
        } else if (tok.type === "em") {
          runs = runs.concat(flattenInline(tok.tokens, parentBold, true, parentStrikethrough, parentCode, parentLink, parentUnderline));
        } else if (tok.type === "del") {
          runs = runs.concat(flattenInline(tok.tokens, parentBold, parentItalic, true, parentCode, parentLink, parentUnderline));
        } else if (tok.type === "underline") {
          runs = runs.concat(flattenInline(tok.tokens, parentBold, parentItalic, parentStrikethrough, parentCode, parentLink, true));
        } else if (tok.type === "codespan") {
          runs.push({ text: tok.text, bold: !!parentBold, italic: !!parentItalic, strikethrough: !!parentStrikethrough, underline: !!parentUnderline, code: true, link: parentLink || null });
        } else if (tok.type === "link") {
          runs = runs.concat(flattenInline(tok.tokens || [], parentBold, parentItalic, parentStrikethrough, parentCode, tok.href, parentUnderline));
        } else if (tok.type === "image" && tok.text && tok.text.indexOf("IMG:scribe-img-") === 0) {
          runs.push({
            text: "",
            bold: false, italic: false, strikethrough: false, underline: false, code: false,
            link: null,
            imageMarker: tok.text.replace("IMG:", "")
          });
        } else if (tok.tokens) {
          runs = runs.concat(flattenInline(tok.tokens, parentBold, parentItalic, parentStrikethrough, parentCode, parentLink, parentUnderline));
        } else if (tok.text) {
          runs.push({ text: tok.text, bold: !!parentBold, italic: !!parentItalic, strikethrough: !!parentStrikethrough, underline: !!parentUnderline, code: !!parentCode, link: parentLink || null });
        }
      }
      return runs;
    }

    function flattenList(listToken, depth) {
      var items = listToken.items || [];
      for (var k = 0; k < items.length; k++) {
        var item = items[k];
        var itemTokens = item.tokens || [];
        var inlineTokens = [];
        var nestedLists = [];
        for (var m = 0; m < itemTokens.length; m++) {
          var sub = itemTokens[m];
          if (sub.type === "list") {
            nestedLists.push(sub);
          } else if (sub.type === "text" || sub.type === "paragraph") {
            inlineTokens = inlineTokens.concat(sub.tokens || []);
          }
        }
        if (inlineTokens.length > 0) {
          blocks.push({
            type: "list_item",
            ordered: !!listToken.ordered,
            level: depth,
            runs: flattenInline(inlineTokens, false, false, false, false, null, false)
          });
        }
        for (var n = 0; n < nestedLists.length; n++) {
          flattenList(nestedLists[n], depth + 1);
        }
      }
    }

    for (var i = 0; i < markedTokens.length; i++) {
      var block = markedTokens[i];
      if (block.type === "paragraph") {
        var pRuns = flattenInline(block.tokens || [], false, false, false, false, null, false);
        // Check if this paragraph is purely image markers (no text content)
        var hasTextContent = false;
        var imgMarkers = [];
        for (var pi = 0; pi < pRuns.length; pi++) {
          if (pRuns[pi].imageMarker) {
            imgMarkers.push(pRuns[pi].imageMarker);
          } else if (pRuns[pi].text && pRuns[pi].text.replace(/^\s+|\s+$/g, "").length > 0) {
            hasTextContent = true;
          }
        }
        if (!hasTextContent && imgMarkers.length > 0) {
          // Pure image paragraph -> promote to image_placeholder block(s)
          for (var ip = 0; ip < imgMarkers.length; ip++) {
            blocks.push({ type: "image_placeholder", name: imgMarkers[ip] });
          }
        } else {
          blocks.push({ type: "paragraph", runs: pRuns });
        }
      } else if (block.type === "heading") {
        blocks.push({
          type: "heading",
          depth: block.depth,
          runs: flattenInline(block.tokens || [], false, false, false, false, null, false)
        });
      } else if (block.type === "list") {
        flattenList(block, 0);
      } else if (block.type === "space") {
        // skip -- implicit paragraph separator
      } else if (block.type === "code") {
        // Fenced code block: split by newlines, each line = one code_block block
        var codeLines = (block.text || "").split("\n");
        for (var cl = 0; cl < codeLines.length; cl++) {
          blocks.push({
            type: "code_block",
            runs: [{ text: codeLines[cl] || " ", bold: false, italic: false, strikethrough: false, code: true, link: null }]
          });
        }
      } else if (block.type === "blockquote") {
        // Blockquote: recursively flatten inner tokens, tag each as blockquote
        var innerBlocks = flattenTokens(block.tokens || []);
        for (var bq = 0; bq < innerBlocks.length; bq++) {
          innerBlocks[bq].blockquote = true;
          blocks.push(innerBlocks[bq]);
        }
      } else if (block.type === "table") {
        // Markdown table: produce a single "table" block with header and rows of cells
        // Each cell contains flattened inline runs for formatting preservation
        var headerCells = [];
        var headerTokens = block.header || [];
        for (var hi = 0; hi < headerTokens.length; hi++) {
          headerCells.push({
            runs: flattenInline(headerTokens[hi].tokens || [], false, false, false, false, null, false)
          });
        }
        var bodyRows = [];
        var rowsArr = block.rows || [];
        for (var ri = 0; ri < rowsArr.length; ri++) {
          var rowCells = [];
          for (var ci = 0; ci < rowsArr[ri].length; ci++) {
            rowCells.push({
              runs: flattenInline(rowsArr[ri][ci].tokens || [], false, false, false, false, null, false)
            });
          }
          bodyRows.push(rowCells);
        }
        blocks.push({
          type: "table",
          header: headerCells,
          rows: bodyRows,
          align: block.align || []
        });
      } else if (block.tokens) {
        // Unknown block type with tokens: treat as paragraph fallback
        blocks.push({ type: "paragraph", runs: flattenInline(block.tokens || [], false, false, false, false, null, false) });
      } else if (block.text) {
        // Unknown block type with text only: treat as plain paragraph
        blocks.push({ type: "paragraph", runs: [{ text: block.text, bold: false, italic: false }] });
      }
    }

    return blocks;
  }

  // ---- Builder API injection with PasteHtml fallback ----
  // Tokenizes markdown via marked.lexer(), flattens to paragraph+runs,
  // passes through Asc.scope, and interprets as Builder API calls inside
  // a single callCommand (single undo point). Falls back to PasteHtml
  // if callCommand fails or times out.
  function buildAndInject(md, mode, fallbackHtml) {
    // Convert inline image markers to standard markdown image syntax
    // so marked.lexer() produces image tokens for both block and inline markers
    md = md.replace(/\{\{IMG:(scribe-img-\d+)\}\}/g, "![IMG:$1](placeholder)");

    // --- Table round-trip: parse TABLE:N blocks before marked.lexer ---
    // Backward compat: if md has bare CELL markers without TABLE wrappers,
    // wrap them in a single [TABLE:0]...[/TABLE] block first.
    if (/\[CELL:\d+,\d+\]/.test(md) && !/\[TABLE:\d+\]/.test(md)) {
      md = '[TABLE:0]\n' + md + '\n[/TABLE]';
    }

    var parsedTables = [];
    var tableBlockRegex = /\[TABLE:(\d+)\]([\s\S]*?)\[\/TABLE\]/g;
    var tableBlockMatch;
    while ((tableBlockMatch = tableBlockRegex.exec(md)) !== null) {
      var tableIndex = parseInt(tableBlockMatch[1]);
      var tableBody = tableBlockMatch[2];
      var cellRegex = /\[CELL:(\d+),(\d+)\]([\s\S]*?)\[\/CELL\]/g;
      var cellMatch;
      var tableCells = [];
      while ((cellMatch = cellRegex.exec(tableBody)) !== null) {
        var cellText = cellMatch[3];
        // Pre-flatten cell text via marked.lexer + flattenTokens (plugin scope)
        var cellTokens = window.marked.lexer(cellText);
        var cellBlocks = flattenTokens(cellTokens);
        // Collect all runs from all blocks in this cell
        var cellRuns = [];
        for (var cb = 0; cb < cellBlocks.length; cb++) {
          if (cellBlocks[cb].runs) {
            for (var cr = 0; cr < cellBlocks[cb].runs.length; cr++) {
              cellRuns.push(cellBlocks[cb].runs[cr]);
            }
          }
        }
        tableCells.push({
          r: parseInt(cellMatch[1]),
          c: parseInt(cellMatch[2]),
          runs: cellRuns
        });
      }
      parsedTables.push({ index: tableIndex, cells: tableCells });
    }

    // Replace TABLE blocks in md with placeholder tokens that survive marked.lexer
    md = md.replace(/\[TABLE:\d+\][\s\S]*?\[\/TABLE\]\n?/g, function(match) {
      var indexMatch = match.match(/\[TABLE:(\d+)\]/);
      var idx = indexMatch ? indexMatch[1] : "0";
      return "SCRIBE-TABLE-" + idx + "\n";
    });

    var tokens = window.marked.lexer(md);
    var flat = flattenTokens(tokens);

    if (flat.length === 0 && parsedTables.length === 0) {
      log("No blocks parsed -- falling back to PasteHtml");
      if (fallbackHtml) { pasteHtml(fallbackHtml, mode); }
      return;
    }

    pasteInProgress = true;
    stopHidePolling();
    Asc.scope.tokens = JSON.stringify(flat);
    Asc.scope._mode = mode || "replace";
    if (parsedTables.length > 0) {
      Asc.scope.parsedTables = JSON.stringify(parsedTables);
      Asc.scope.tableDocIndices = JSON.stringify(lastTableDocIndices);
    } else {
      Asc.scope.parsedTables = null;
      Asc.scope.tableDocIndices = null;
    }

    var callbackFired = false;
    var fallbackTimer = setTimeout(function() {
      if (!callbackFired) {
        log("Builder callCommand timeout -- falling back to PasteHtml");
        pasteInProgress = false;
        if (fallbackHtml) { pasteHtml(fallbackHtml, mode); }
      }
    }, 5000);

    window.Asc.plugin.callCommand(function() {
      var tokensJson = Asc.scope.tokens;
      var mode = Asc.scope._mode;
      if (!tokensJson) return;

      var blocks = JSON.parse(tokensJson);
      var doc = Api.GetDocument();

      // Read paragraph-level font style at insertion point
      // Uses paragraph mark text properties (base style, ignoring local run overrides)
      // Falls back to document default text properties
      var srcFontFamily = null;
      var srcFontSize = null;
      try {
        var selRange = doc.GetRangeBySelect();
        if (selRange) {
          var para = selRange.GetParagraph();
          if (para) {
            var textPr = para.GetTextPr();
            if (textPr) {
              srcFontFamily = textPr.GetFontFamily();
              srcFontSize = textPr.GetFontSize();
            }
          }
        }
      } catch (e) {
        // Reading failed — try document default
      }
      if (!srcFontFamily || !srcFontSize) {
        try {
          var defaultPr = doc.GetDefaultTextPr();
          if (defaultPr) {
            if (!srcFontFamily) srcFontFamily = defaultPr.GetFontFamily();
            if (!srcFontSize) srcFontSize = defaultPr.GetFontSize();
          }
        } catch (e) {
          // No default available — runs will use OO built-in default
        }
      }

      // ---- Smart spacing detection ----
      // Mirrors the pasteHtml spacing pattern (lines 378-416) but for Builder API.
      // Detects adjacent non-whitespace chars around the selection/cursor and sets
      // flags to inject space runs at content boundaries.
      var needSpaceBefore = false;
      var needSpaceAfter = false;
      var WS = /[\s\n\r\t\u00A0]/;

      // For insert mode: collapse cursor to end of selection.
      // If the next char is a space, extend cursor to consume it so it doesn't
      // end up as a leading space on the line after the insertion.
      if (mode === "insert") {
        var insSelRange = doc.GetRangeBySelect();
        if (insSelRange) {
          var endPos = insSelRange.GetEndPos();
          var afterRange = doc.GetRange(endPos, endPos + 1);
          var afterChar = afterRange ? afterRange.GetText() : "";
          if (afterChar === " " || afterChar === "\u00A0") {
            // Select the trailing space so InsertContent consumes it
            var eatRange = doc.GetRange(endPos, endPos + 1);
            if (eatRange) eatRange.Select();
          } else {
            var endRange = doc.GetRange(endPos, endPos);
            if (endRange) endRange.Select();
          }
        }
      }

      try {
        if (mode === "insert") {
          // Insert mode: spacing handled by paragraph separators, not space runs
        } else {
          // Replace mode: check char before selection start and after selection end
          var repRange = doc.GetRangeBySelect();
          if (repRange) {
            var repStart = repRange.GetStartPos();
            var repEnd = repRange.GetEndPos();

            if (repStart > 0) {
              var bRange2 = doc.GetRange(Math.max(0, repStart - 5), repStart);
              var bText2 = bRange2 ? bRange2.GetText() : "";
              var bChar2 = bText2.length > 0 ? bText2.charAt(bText2.length - 1) : "";
              if (bChar2 && !WS.test(bChar2)) needSpaceBefore = true;
            }

            var aRange2 = doc.GetRange(repEnd, repEnd + 5);
            var aText2 = aRange2 ? aRange2.GetText() : "";
            var aChar2 = aText2.length > 0 ? aText2.charAt(0) : "";
            if (aChar2 && !WS.test(aChar2)) needSpaceAfter = true;
          }
        } // end else (replace mode)
      } catch (e) {
        // Spacing detection failed -- proceed without spacing (safe fallback)
      }

      // Pre-scan: create numbering objects once if needed
      var bulletNumbering = null;
      var orderedNumbering = null;
      var hasBullets = false;
      var hasOrdered = false;
      for (var ii = 0; ii < blocks.length; ii++) {
        if (blocks[ii].type === "list_item") {
          if (blocks[ii].ordered) hasOrdered = true;
          else hasBullets = true;
        }
      }
      if (hasBullets) bulletNumbering = doc.CreateNumbering("bullet");
      if (hasOrdered) orderedNumbering = doc.CreateNumbering("numbered");

      // Pre-scan: detect a quote/citation style from document's predefined styles.
      // OOXML (and OO) typically include styles like "Quote", "Intense Quote",
      // or locale variants. We search by heuristic on the style name.
      var quoteStyle = null;
      var hasBlockquotes = false;
      for (var bqi = 0; bqi < blocks.length; bqi++) {
        if (blocks[bqi].blockquote) { hasBlockquotes = true; break; }
      }
      if (hasBlockquotes) {
        // Try well-known names first (most OO documents have these)
        var knownQuoteNames = ["Intense Quote", "Citation intense", "Quote", "Citation"];
        for (var qn = 0; qn < knownQuoteNames.length; qn++) {
          var candidate = doc.GetStyle(knownQuoteNames[qn]);
          if (candidate) { quoteStyle = candidate; break; }
        }
        // Fallback: enumerate all styles looking for quote/citation keywords
        if (!quoteStyle) {
          try {
            var allStyles = doc.GetAllStyles();
            if (allStyles) {
              var quotePatterns = ["quote", "citation", "cita", "blockquote", "bloc de citation"];
              for (var si = 0; si < allStyles.length; si++) {
                var sName = "";
                try { sName = allStyles[si].GetName(); } catch (e) { continue; }
                var sLower = sName.toLowerCase();
                for (var qp = 0; qp < quotePatterns.length; qp++) {
                  if (sLower.indexOf(quotePatterns[qp]) !== -1) {
                    quoteStyle = allStyles[si];
                    break;
                  }
                }
                if (quoteStyle) break;
              }
            }
          } catch (e) {
            // GetAllStyles not available — keep quoteStyle null, fallback to indent
          }
        }
      }

      // Pre-cache all referenced images via Copy() BEFORE InsertContent destroys
      // the selection. Copy() preserves the full image bitmap data, unlike
      // ToJSON which only serializes structure (dimensions) but loses the fill.
      //
      // Build a name->drawing index by scanning all paragraphs in the document,
      // since ApiDocument has no GetDrawingsByName method.
      var drawingIndex = {};  // name -> ApiDrawing
      var allParas = doc.GetAllParagraphs();
      for (var dp = 0; dp < allParas.length; dp++) {
        var dpDrawings = allParas[dp].GetAllDrawingObjects();
        if (!dpDrawings) continue;
        for (var dd = 0; dd < dpDrawings.length; dd++) {
          var dpName = dpDrawings[dd].GetName();
          if (dpName && dpName.indexOf("scribe-img-") === 0) {
            drawingIndex[dpName] = dpDrawings[dd];
          }
        }
      }

      // Now Copy() only the drawings referenced by the LLM response tokens.
      // Copy() is a deep copy that preserves image bitmap data, unlike ToJSON
      // which only serializes structure (dimensions, position) but not the fill.
      var imageCache = {};  // name -> ApiDrawing (copy)
      for (var ic = 0; ic < blocks.length; ic++) {
        var icBlock = blocks[ic];
        if (icBlock.type === "image_placeholder" && icBlock.name) {
          if (!imageCache[icBlock.name] && drawingIndex[icBlock.name]) {
            try { imageCache[icBlock.name] = drawingIndex[icBlock.name].Copy(); } catch (e) {}
          }
        }
        // Also scan runs for inline imageMarkers
        if (icBlock.runs) {
          for (var ir = 0; ir < icBlock.runs.length; ir++) {
            var irMarker = icBlock.runs[ir].imageMarker;
            if (irMarker && !imageCache[irMarker] && drawingIndex[irMarker]) {
              try { imageCache[irMarker] = drawingIndex[irMarker].Copy(); } catch (e) {}
            }
          }
        }
      }

      function restoreImage(name) {
        var cached = imageCache[name];
        if (!cached) return null;
        // Copy() is consumed by AddDrawing — make a fresh copy for next use
        try { imageCache[name] = cached.Copy(); } catch (e) { imageCache[name] = null; }
        return cached;
      }

      // --- Table round-trip: clone tables via Copy() BEFORE InsertContent ---
      // Pre-cache table clones so they survive InsertContent destroying the selection.
      // Same pattern as image pre-cache: collect originals first, then Copy().
      var parsedTablesJson = Asc.scope.parsedTables;
      var parsedTables = parsedTablesJson ? JSON.parse(parsedTablesJson) : [];
      var tableClones = {};  // index -> ApiTable (cloned + modified)

      if (parsedTables.length > 0) {
        // Find original tables by their document-level index (saved during extraction).
        // We cannot rely on selection range here — it may have collapsed since extraction.
        var allTables = doc.GetAllTables();
        var tableDocIndicesJson = Asc.scope.tableDocIndices;
        var tableDocIndices = tableDocIndicesJson ? JSON.parse(tableDocIndicesJson) : [];

        // Clone each table, read source fonts, and modify clone cells
        for (var tci = 0; tci < parsedTables.length; tci++) {
          var ptEntry = parsedTables[tci];
          var ptIndex = ptEntry.index;
          var ptCells = ptEntry.cells;
          // Map TABLE:N index to document-level table index
          var docIdx = tableDocIndices[ptIndex];
          var origTable = (docIdx !== undefined && docIdx < allTables.length) ? allTables[docIdx] : null;
          if (!origTable) continue;

          var clone = origTable.Copy();

          // Read source font from first run of first paragraph in each cell of ORIGINAL
          var cFonts = {};
          for (var cfi = 0; cfi < ptCells.length; cfi++) {
            var ptc = ptCells[cfi];
            var cfKey = ptc.r + "," + ptc.c;
            var origCell = origTable.GetCell(ptc.r, ptc.c);
            if (origCell) {
              var origContent = origCell.GetContent();
              if (origContent && origContent.GetElementsCount() > 0) {
                var origPara = origContent.GetElement(0);
                if (origPara && origPara.GetElementsCount) {
                  for (var ofe = 0; ofe < origPara.GetElementsCount(); ofe++) {
                    var oElem = origPara.GetElement(ofe);
                    if (oElem.GetClassType && oElem.GetClassType() === "run") {
                      var oTp = oElem.GetTextPr ? oElem.GetTextPr() : null;
                      if (oTp) {
                        cFonts[cfKey] = {
                          family: oTp.GetFontFamily() || null,
                          size: oTp.GetFontSize() || null
                        };
                      }
                      break;
                    }
                  }
                }
              }
            }
            if (!cFonts[cfKey]) {
              cFonts[cfKey] = { family: srcFontFamily, size: srcFontSize };
            }
          }

          // Modify the CLONE's cells (not the original)
          for (var mci = 0; mci < ptCells.length; mci++) {
            var mc = ptCells[mci];
            var cloneCell = clone.GetCell(mc.r, mc.c);
            if (!cloneCell) continue;
            var cloneCc = cloneCell.GetContent();
            if (!cloneCc || cloneCc.GetElementsCount() === 0) continue;
            var cloneCp = cloneCc.GetElement(0);
            if (!cloneCp) continue;
            // RemoveAllElements instead of cell.Clear() — Clear() causes empty cells
            // when only 1 run is added (the replacement replaces the wrong element)
            if (cloneCp.RemoveAllElements) {
              cloneCp.RemoveAllElements();
            }
            var mcf = cFonts[mc.r + "," + mc.c] || {};
            addRunsToParagraph(cloneCp, mc.runs || [], mcf.family, mcf.size);
          }

          tableClones[ptIndex] = clone;
        }
      }

      // Helper: create a space run matching surrounding font
      // Create a formatted hyperlink — applies bold/italic/strikethrough to child runs
      function makeHyperlink(run) {
        var link = Api.CreateHyperlink(run.link, run.text, "");
        // Apply formatting to the hyperlink's child runs
        if (run.bold || run.italic || run.strikethrough || run.underline || run.code) {
          var linkCount = link.GetElementsCount ? link.GetElementsCount() : 0;
          for (var li = 0; li < linkCount; li++) {
            var linkRun = link.GetElement(li);
            if (linkRun && linkRun.GetClassType && linkRun.GetClassType() === "run") {
              if (run.bold) linkRun.SetBold(true);
              if (run.italic) linkRun.SetItalic(true);
              if (run.strikethrough) linkRun.SetStrikeout(true);
              if (run.underline) linkRun.SetUnderline(true);
              if (run.code) linkRun.SetFontFamily("Courier New");
            }
          }
        }
        return link;
      }

      function makeSpaceRun() {
        var sr = Api.CreateRun();
        sr.AddText(" ");
        if (srcFontFamily) sr.SetFontFamily(srcFontFamily);
        if (srcFontSize) sr.SetFontSize(srcFontSize);
        return sr;
      }

      // Shared function: add runs to a paragraph (used for both document paragraphs
      // and table cells). Handles text, bold/italic/strikethrough/code, hyperlinks,
      // and image markers (via restoreImage from image cache).
      function addRunsToParagraph(para, runs, fontFamily, fontSize) {
        for (var ri = 0; ri < runs.length; ri++) {
          var run = runs[ri];
          if (run.imageMarker) {
            var imDrawing = restoreImage(run.imageMarker);
            if (imDrawing) {
              para.AddDrawing(imDrawing);
            }
          } else if (run.link) {
            para.AddElement(makeHyperlink(run));
          } else {
            var r = Api.CreateRun();
            r.AddText(run.text);
            if (run.bold) r.SetBold(true);
            if (run.italic) r.SetItalic(true);
            if (run.strikethrough) r.SetStrikeout(true);
            if (run.underline) r.SetUnderline(true);
            if (run.code) {
              r.SetFontFamily("Courier New");
              if (fontSize) r.SetFontSize(fontSize);
            } else {
              if (fontFamily) r.SetFontFamily(fontFamily);
              if (fontSize) r.SetFontSize(fontSize);
            }
            para.AddElement(r);
          }
        }
      }

      var content = [];
      for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var isFirst = (i === 0);
        var isLast = (i === blocks.length - 1);

        // Table placeholder detection: substitute cloned table for SCRIBE-TABLE-N
        if (block.type === "paragraph" && block.runs && block.runs.length === 1) {
          var plText = block.runs[0].text || "";
          var plMatch = plText.match(/^SCRIBE-TABLE-(\d+)$/);
          if (plMatch) {
            var plIdx = parseInt(plMatch[1]);
            if (tableClones[plIdx]) {
              content.push(tableClones[plIdx]);
            }
            continue;
          }
        }

        if (block.type === "heading") {
          var p = Api.CreateParagraph();
          var styleName = "Heading " + block.depth;
          var headingStyle = doc.GetStyle(styleName);
          if (headingStyle) p.SetStyle(headingStyle);
          if (isFirst && needSpaceBefore) p.AddElement(makeSpaceRun());
          addRunsToParagraph(p, block.runs || [], null, null);
          if (isLast && needSpaceAfter) p.AddElement(makeSpaceRun());
          content.push(p);
        } else if (block.type === "list_item") {
          var p = Api.CreateParagraph();
          var numbering = block.ordered ? orderedNumbering : bulletNumbering;
          var numLvl = numbering.GetLevel(block.level);
          p.SetNumbering(numLvl);
          if (isFirst && needSpaceBefore) p.AddElement(makeSpaceRun());
          addRunsToParagraph(p, block.runs || [], srcFontFamily, srcFontSize);
          if (isLast && needSpaceAfter) p.AddElement(makeSpaceRun());
          content.push(p);
        } else if (block.type === "code_block") {
          var p = Api.CreateParagraph();
          // Dark background (charcoal) with light text for code blocks
          p.SetShd("clear", 40, 44, 52);
          // Tight spacing between code lines
          p.SetSpacingAfter(0);
          p.SetSpacingBefore(0);
          if (isFirst && needSpaceBefore) p.AddElement(makeSpaceRun());
          var runs = block.runs || [];
          for (var j = 0; j < runs.length; j++) {
            var run = runs[j];
            if (run.imageMarker) {
              var imDrawing = restoreImage(run.imageMarker);
              if (imDrawing) {
                p.AddDrawing(imDrawing);
              }
            } else {
              var r = Api.CreateRun();
              r.AddText(run.text);
              r.SetFontFamily("Courier New");
              r.SetColor(212, 212, 212);
              if (srcFontSize) r.SetFontSize(srcFontSize);
              p.AddElement(r);
            }
          }
          if (isLast && needSpaceAfter) p.AddElement(makeSpaceRun());
          content.push(p);
        } else if (block.type === "table") {
          var nCols = (block.header || []).length;
          var nRows = (block.rows || []).length + 1; // +1 for header row
          if (nCols === 0 || nRows === 0) continue; // skip degenerate tables

          var table = Api.CreateTable(nCols, nRows);
          table.SetWidth("percent", 100);

          // Set all borders (thin single line)
          table.SetTableBorderTop("single", 4, 0, 0, 0, 0);
          table.SetTableBorderBottom("single", 4, 0, 0, 0, 0);
          table.SetTableBorderLeft("single", 4, 0, 0, 0, 0);
          table.SetTableBorderRight("single", 4, 0, 0, 0, 0);
          table.SetTableBorderInsideH("single", 4, 0, 0, 0, 0);
          table.SetTableBorderInsideV("single", 4, 0, 0, 0, 0);

          // Helper: fill a cell with formatted runs
          function fillCell(row, col, runs) {
            var cell = table.GetCell(row, col);
            if (!cell) return;
            var cellContent = cell.GetContent();
            if (!cellContent) return;
            var cellPara = cellContent.GetElement(0);
            if (!cellPara) return;
            addRunsToParagraph(cellPara, runs, srcFontFamily, srcFontSize);
          }

          // Fill header row (row 0) — bold by default
          var headerCells = block.header || [];
          for (var hc = 0; hc < headerCells.length; hc++) {
            var hRuns = headerCells[hc].runs || [];
            // Force bold on header cell runs
            var boldRuns = [];
            for (var hr = 0; hr < hRuns.length; hr++) {
              var hRun = {};
              for (var hk in hRuns[hr]) { hRun[hk] = hRuns[hr][hk]; }
              hRun.bold = true;
              boldRuns.push(hRun);
            }
            fillCell(0, hc, boldRuns);
          }

          // Fill body rows (rows 1..nRows-1)
          var bodyRows = block.rows || [];
          for (var br = 0; br < bodyRows.length; br++) {
            var rowCells = bodyRows[br] || [];
            for (var bc = 0; bc < rowCells.length; bc++) {
              fillCell(br + 1, bc, rowCells[bc].runs || []);
            }
          }

          // Note: smart spacing (needSpaceBefore/After) does not apply to tables
          // since tables are standalone block elements in OO
          content.push(table);
        } else if (block.type === "paragraph") {
          var p = Api.CreateParagraph();
          if (isFirst && needSpaceBefore) p.AddElement(makeSpaceRun());
          addRunsToParagraph(p, block.runs || [], srcFontFamily, srcFontSize);
          if (isLast && needSpaceAfter) p.AddElement(makeSpaceRun());
          content.push(p);
        } else if (block.type === "image_placeholder") {
          var imgDrawing = restoreImage(block.name);
          if (imgDrawing) {
            var imgPara = Api.CreateParagraph();
            if (isFirst && needSpaceBefore) imgPara.AddElement(makeSpaceRun());
            imgPara.AddDrawing(imgDrawing);
            if (isLast && needSpaceAfter) imgPara.AddElement(makeSpaceRun());
            content.push(imgPara);
          }
          // If not in cache (image was deleted from doc), silently skip
        }

        // Apply blockquote styling if flagged
        if (block.blockquote && content.length > 0) {
          var lastP = content[content.length - 1];
          if (quoteStyle) {
            // Use the document's predefined quote/citation style
            lastP.SetStyle(quoteStyle);
          } else {
            // Fallback: manual left indent (720 twips = 0.5 inch)
            lastP.SetIndLeft(720);
          }
        }
      }

      if (content.length > 0) {
        // Save selection start position before InsertContent (for replace mode selection)
        var preSelStart = 0;
        try {
          var preRange = doc.GetRangeBySelect();
          if (preRange) preSelStart = preRange.GetStartPos();
        } catch (e) {}

        // Calculate total text length from blocks (for position-based selection)
        var totalTextLen = 0;
        for (var ti = 0; ti < blocks.length; ti++) {
          var bRuns = blocks[ti].runs || [];
          for (var tj = 0; tj < bRuns.length; tj++) {
            totalTextLen += bRuns[tj].text.length;
          }
        }
        // Note: table blocks contribute no text to totalTextLen — they use ref-based
        // selection (block mode) where position arithmetic is not needed.
        // Note: image_placeholder blocks contribute no text to totalTextLen either --
        // images are drawings with no text content, and position-based selection
        // correctly skips them.
        // Account for space runs added by spacing logic
        if (needSpaceBefore) totalTextLen += 1;
        if (needSpaceAfter) totalTextLen += 1;
        var mergedTrailingLen = 0; // track trailing text merged into last paragraph

        var useRefSelection = false; // true = use paragraph refs, false = use position-based

        if (mode === "insert") {
          // Insert mode: leading empty paragraph creates a line break before content.
          content.unshift(Api.CreateParagraph());
          doc.InsertContent(content);
          useRefSelection = true;
        } else {
          // Replace mode
          var isSimpleInline = (content.length === 1 && blocks.length === 1 && blocks[0].type === "paragraph");
          if (isSimpleInline) {
            // Single paragraph: inline mode merges into existing paragraph
            doc.InsertContent(content, true);
          } else {
            // Multi-paragraph: block mode to keep paragraph separation.
            // Block mode splits the paragraph at selection end, creating a trailing
            // paragraph. After InsertContent, merge that trailing paragraph into
            // the last content paragraph to eliminate the extra line break.
            doc.InsertContent(content);
            useRefSelection = true; // block mode preserves paragraph refs
            try {
              var lastContentPara = content[content.length - 1];
              var lcRange = lastContentPara.GetRange();
              if (lcRange) {
                var lcEndPos = lcRange.GetEndPos();
                var total = doc.GetElementsCount();
                for (var si = 0; si < total; si++) {
                  var scanEl = doc.GetElement(si);
                  var scanRange = scanEl ? scanEl.GetRange() : null;
                  if (scanRange && scanRange.GetStartPos() >= lcEndPos) {
                    var trailText = scanRange.GetText();
                    if (trailText.length > 0) {
                      // Merge trailing text into last content paragraph
                      var mRun = Api.CreateRun();
                      mRun.AddText(trailText);
                      if (srcFontFamily) mRun.SetFontFamily(srcFontFamily);
                      if (srcFontSize) mRun.SetFontSize(srcFontSize);
                      lastContentPara.AddElement(mRun);
                      mergedTrailingLen = trailText.length;
                    }
                    // Remove the trailing paragraph (empty or merged)
                    doc.RemoveElement(si);
                    break;
                  }
                }
              }
            } catch (e) {
              // Merge failed — trailing line break remains (minor visual issue)
            }
          }
        }

        // ── Post-injection selection ──
        //
        // Two distinct strategies are needed because InsertContent behaves
        // differently in inline vs block mode:
        //
        // 1) selectByRefs — used for block-mode insert and block-mode replace.
        //    InsertContent in block mode keeps each paragraph as a separate
        //    document element, so the JS object references in content[] remain
        //    valid after insertion. We can call GetRange() on them directly.
        //
        // 2) selectByPositions — used for inline-mode replace (single paragraph).
        //    InsertContent(content, true) merges the runs INTO the existing
        //    paragraph, destroying the original object references. content[0]
        //    no longer maps to a standalone document element, so GetRange()
        //    on it is unreliable. Instead we use numeric character positions
        //    (preSelStart + text length) to build the selection range.
        //
        // Why not unify?
        //  - Position-based is fragile for multi-paragraph / block content:
        //    headings, lists, and paragraph separators introduce invisible
        //    position markers that make length arithmetic unreliable.
        //  - Ref-based cannot work after an inline merge because the refs
        //    are absorbed into the host paragraph.
        // So we pick the right tool for each insertion mode.

        function selectByRefs(doc, content, mode, preSelStart, mergedTrailingLen) {
          // In insert mode content[0] is the leading empty paragraph (line break),
          // so the first real content paragraph is content[1].
          // In replace mode content[0] is the first real content paragraph.
          var selectFirst = (mode === "insert" && content.length > 1) ? content[1] : content[0];
          var selectLast = content[content.length - 1];
          if (!selectFirst || !selectLast) return;

          var startRange;
          if (mode === "insert") {
            startRange = selectFirst.GetRange(0, 0);
          } else {
            // In block-mode replace, OO merges content[0] with the text that
            // precedes the selection. content[0].GetRange(0,0) would therefore
            // start too early. Use the saved pre-insertion position instead.
            startRange = doc.GetRange(preSelStart, preSelStart);
          }

          var endRange;
          if (mergedTrailingLen > 0) {
            // Trailing text from the split paragraph was merged into selectLast.
            // Exclude it from the selection so we only highlight injected content.
            var lastFullRange = selectLast.GetRange();
            var adjEnd = lastFullRange.GetEndPos() - mergedTrailingLen;
            endRange = doc.GetRange(adjEnd, adjEnd);
          } else {
            endRange = selectLast.GetRange();
          }

          if (startRange && endRange) {
            var fullRange = startRange.ExpandTo(endRange);
            if (fullRange) fullRange.Select();
          }
        }

        function selectByPositions(doc, preSelStart, totalTextLen, mergedTrailingLen) {
          // Simple arithmetic: the injected text starts at preSelStart and
          // spans totalTextLen characters. +2 compensates an OO logical
          // position offset (paragraph start marker).
          var selTextLen = totalTextLen - mergedTrailingLen;
          if (selTextLen <= 0) return;
          var selectRange = doc.GetRange(preSelStart, preSelStart + selTextLen + 2);
          if (selectRange) selectRange.Select();
        }

        try {
          if (useRefSelection) {
            selectByRefs(doc, content, mode, preSelStart, mergedTrailingLen);
          } else {
            selectByPositions(doc, preSelStart, totalTextLen, mergedTrailingLen);
          }
        } catch (e) {
          // Selection failed — content is still injected, graceful degradation
        }
      }
    }, false, false, function() {
      callbackFired = true;
      clearTimeout(fallbackTimer);
      pasteInProgress = false;
      log("Builder injection complete (" + mode + ")");
    });
  }

  // Rich text paste pipeline:
  // 1. callCommand: read adjacent chars around selection, detect if spaces needed
  //    For insert mode: collapse cursor to end of selection first
  // 2. PasteHtml: paste HTML with smart spaces prepended/appended
  //    Replace mode: replaces the selection. Insert mode: inserts at cursor (after selection).
  // This produces a single undo point (PasteHtml only — the read-only callCommand doesn't count).
  // NOTE: post-paste selection of inserted content is not yet implemented (OO returns
  // inconsistent cursor positions after PasteHtml — see phase13-paste-select.md).
  function pasteHtml(html, mode) {
    pasteInProgress = true;
    stopHidePolling();
    Asc.scope._mode = mode || "replace";

    // Step 1: detect adjacent chars + position cursor for insert
    window.Asc.plugin.callCommand(function() {
      var doc = Api.GetDocument();
      var range = doc.GetRangeBySelect();
      if (!range) return null;
      var selStart = range.GetStartPos();
      var selEnd = range.GetEndPos();
      var result = { spaceBefore: false, spaceAfter: false };
      var isInsert = Asc.scope._mode === "insert";
      var WS = /[\s\n\r\t\u00A0]/;

      if (isInsert) {
        // Check last char of selection (before) and first char after selection (after)
        var beforeRange = doc.GetRange(selEnd - 5 >= 0 ? selEnd - 5 : 0, selEnd);
        var beforeText = beforeRange ? beforeRange.GetText() : "";
        var beforeChar = beforeText.length > 0 ? beforeText.charAt(beforeText.length - 1) : "";
        if (beforeChar && !WS.test(beforeChar)) result.spaceBefore = true;

        var afterRange = doc.GetRange(selEnd, selEnd + 5);
        var afterText = afterRange ? afterRange.GetText() : "";
        var afterChar = afterText.length > 0 ? afterText.charAt(0) : "";
        if (afterChar && !WS.test(afterChar)) result.spaceAfter = true;

        // Collapse cursor to end of selection
        var cursorRange = doc.GetRange(selEnd, selEnd);
        if (cursorRange) cursorRange.Select();
      } else {
        // Check char before selection and char after selection
        if (selStart > 0) {
          var beforeRange2 = doc.GetRange(selStart - 5 >= 0 ? selStart - 5 : 0, selStart);
          var beforeText2 = beforeRange2 ? beforeRange2.GetText() : "";
          var beforeChar2 = beforeText2.length > 0 ? beforeText2.charAt(beforeText2.length - 1) : "";
          if (beforeChar2 && !WS.test(beforeChar2)) result.spaceBefore = true;
        }
        var afterRange2 = doc.GetRange(selEnd, selEnd + 5);
        var afterText2 = afterRange2 ? afterRange2.GetText() : "";
        var afterChar2 = afterText2.length > 0 ? afterText2.charAt(0) : "";
        if (afterChar2 && !WS.test(afterChar2)) result.spaceAfter = true;
      }
      return JSON.stringify(result);
    }, false, false, function(prepResult) {
      var prep = prepResult ? JSON.parse(prepResult) : null;
      if (!prep) { pasteInProgress = false; return; }

      // Step 2: build HTML with smart spaces and paste
      var spaceBefore = prep.spaceBefore ? "&nbsp;" : "";
      var spaceAfter = prep.spaceAfter ? "&nbsp;" : "";
      var finalHtml = spaceBefore + html + spaceAfter;
      var spacesLog = (prep.spaceBefore ? "before " : "") + (prep.spaceAfter ? "after" : "");
      log("PasteHtml (" + (mode || "replace") + ")" + (spacesLog ? " spaces=" + spacesLog : ""));
      window.Asc.plugin.executeMethod("PasteHtml", [finalHtml], function() {
        pasteInProgress = false;
      });
    });
  }

  // ---- handleIntentResponse: apply document modification from response ----
  // Routes: md field -> Builder API path, html field -> PasteHtml, text -> plain fallback
  function handleIntentResponse(msg) {
    if (msg.action === "replace" || msg.action === "insert") {
      if (msg.data && msg.data.md) {
        // Builder API path (primary) with PasteHtml fallback
        log(msg.action + " (Builder API)");
        try {
          buildAndInject(msg.data.md, msg.action, msg.data.html || null);
        } catch (e) {
          log("Builder injection failed: " + e.message + " -- falling back to PasteHtml");
          if (msg.data.html) {
            pasteHtml(msg.data.html, msg.action);
          } else {
            window.Asc.plugin.executeMethod("PasteText", [msg.data.text || ""]);
          }
        }
      } else if (msg.data && msg.data.html) {
        // PasteHtml path (existing fallback)
        log(msg.action + " (PasteHtml)");
        pasteHtml(msg.data.html, msg.action);
      } else {
        // Plain text fallback (existing)
        log(msg.action + " (plain text)");
        if (msg.action === "replace") {
          window.Asc.plugin.executeMethod("PasteText", [msg.data.text || ""]);
        } else {
          insertAfterWithText(msg.data.text || "");
        }
      }
    } else if (msg.action === "cancel") {
      log("Intent cancelled -- no document modification");
    }
  }

  // Insert after selection (HTML): collapse cursor to end of selection, then PasteHtml.
  function insertAfterWithHtml(newHtml) {
    pasteHtml(newHtml, "insert");
  }

  // Insert after selection (plain text fallback): InsertContent replaces the
  // selection, so we re-create the original paragraphs and append the new text.
  function insertAfterWithText(newText) {
    Asc.scope.textToInsert = newText;
    Asc.scope.originalLines = lastSelectedText.split("\n");
    window.Asc.plugin.callCommand(function() {
      var oDocument = Api.GetDocument();
      var content = [];
      // Re-create original text paragraphs (preserves paragraph structure)
      for (var i = 0; i < Asc.scope.originalLines.length; i++) {
        var p = Api.CreateParagraph();
        p.AddText(Asc.scope.originalLines[i]);
        content.push(p);
      }
      // Add new text as paragraphs after original
      var insertLines = Asc.scope.textToInsert.split("\n");
      for (var j = 0; j < insertLines.length; j++) {
        var pNew = Api.CreateParagraph();
        pNew.AddText(insertLines[j]);
        content.push(pNew);
      }
      oDocument.InsertContent(content);
    }, false, false, function() {
      log("InsertContent completed (original preserved + insert after)");
    });
  }

  // ---- Response message listener ----
  window.addEventListener("message", function(event) {
    var msg = event.data;
    if (!msg || msg.type !== "cozy-bridge:response" || msg.version !== 1) return;

    var pending = pendingIntents[msg.intentId];
    if (!pending) return;

    delete pendingIntents[msg.intentId];
    log("Response: " + msg.action);

    // Resolve the Promise if available
    if (pending.resolve) {
      pending.resolve({ action: msg.action, result: msg.data });
    }

    // Always handle the response for document modification
    if (msg.status === "ok") {
      handleIntentResponse(msg);
    }
  });

  // ---- Trigger-intent listener (host -> plugin) ----
  // Cozy Drive sends trigger-intent to ask the plugin to cast an AI_TEXT_ASSISTANT intent
  window.addEventListener("message", function(event) {
    var msg = event.data;
    if (!msg || msg.type !== "cozy-bridge:trigger-intent") return;

    if (msg.action === "AI_TEXT_ASSISTANT" && lastSelectedText.length > 0) {
      log("Trigger-intent received, casting AI_TEXT_ASSISTANT");
      castIntent("AI_TEXT_ASSISTANT", buildEditIntentData());
    }
  });

  // ---- Strip OO-internal CSS classes from extracted HTML ----
  // Based on official OO HTML plugin pattern -- removes class attributes
  // that contain OO-specific styling metadata not useful for AI processing
  function stripOoClasses(html) {
    return html.replace(/\s*class="[^"]*"/g, "");
  }

  // ---- Selection detection (via init + polling) ----
  // OO calls init with the selected text when a selection is made,
  // but does NOT call init when the selection is cleared.
  // We poll with GetSelectedText to detect deselection.
  var selectionDebounceTimer = null;
  var SELECTION_DEBOUNCE_MS = 300;
  var hideCheckInterval = null;
  var HIDE_CHECK_MS = 500;
  var toolbarButtonAdded = false;
  var scribeButtonShown = false;

  function startHidePolling() {
    if (hideCheckInterval) return;
    hideCheckInterval = setInterval(function() {
      window.Asc.plugin.executeMethod("GetSelectedText", [{
        Numbering: false,
        Math: false,
        TableCellSeparator: "\n",
        ParaSeparator: "\n",
        TabSymbol: String.fromCharCode(9)
      }], function(text) {
        var trimmed = (text || "").replace(/^\s+|\s+$/g, "");
        if (trimmed.length === 0) {
          log("Polling: selection cleared");
          lastSelectedText = "";
          lastSelectedHtml = "";
          lastEnrichedMd = "";
          scribeButtonShown = false;
          castIntent("HIDE_SCRIBE_BUTTON", {}, true);
          stopHidePolling();
        }
      });
    }, HIDE_CHECK_MS);
  }

  function stopHidePolling() {
    if (hideCheckInterval) {
      clearInterval(hideCheckInterval);
      hideCheckInterval = null;
    }
  }

  window.Asc.plugin.init = function(data) {
    // Ignore init calls triggered by our own paste operations
    if (pasteInProgress) {
      log("init() called (ignored — paste in progress)");
      return;
    }
    // Add toolbar button on first init (API is ready at this point)
    if (!toolbarButtonAdded) {
      addToolbarButton();
      toolbarButtonAdded = true;
    }

    // Run callCommand pre-scan to extract enriched markdown from selection
    // initDataType:"html" is kept for trigger mechanism; data parameter is ignored
    // Pass imageCounter via Asc.scope for stable image naming across selections
    window.Asc.scope.imgCounter = imageCounter;
    window.Asc.plugin.callCommand(function() {
      // --- All helpers defined inside callCommand (ES5 sandbox) ---

      function escapeMarkdown(text) {
        return text.replace(/([\\*_`\[\]()~#>+\-|{}!])/g, "\\$1");
      }

      // Format a single run element to markdown (inline styles only, no link)
      // Used for isolated runs (headings, list items with a single run).
      // For sequences of runs in a paragraph, use buildMarkdownFromParts().
      function formatRun(runText, tp) {
        if (!runText || runText.length === 0) return "";
        var isBold = tp ? tp.GetBold() : false;
        var isItalic = tp ? tp.GetItalic() : false;
        var isStrike = tp ? tp.GetStrikeout() : false;
        var isUnderline = tp ? tp.GetUnderline() : false;
        var fontFamily = tp ? tp.GetFontFamily() : null;
        var isCode = false;
        if (fontFamily) {
          var ff = fontFamily.toLowerCase();
          if (ff.indexOf("courier") !== -1 || ff.indexOf("consolas") !== -1 || ff.indexOf("mono") !== -1) {
            isCode = true;
          }
        }
        var escaped = escapeMarkdown(runText);
        if (isCode) {
          escaped = "`" + runText + "`";
        }
        if (isBold && isItalic) escaped = "***" + escaped + "***";
        else if (isBold) escaped = "**" + escaped + "**";
        else if (isItalic) escaped = "*" + escaped + "*";
        if (isStrike) escaped = "~~" + escaped + "~~";
        if (isUnderline) escaped = "<u>" + escaped + "</u>";
        return escaped;
      }

      // Build markdown from an array of annotated parts, emitting formatting
      // markers at transitions instead of wrapping each part independently.
      // Each part: { text, bold, italic, strikethrough, code, raw, link }
      // - raw: text emitted as-is, closes all formatting (for image markers)
      // - link: URL string — text is wrapped in [text](url), formatting flows through
      function buildMarkdownFromParts(parts) {
        var result = "";
        var curBold = false, curItalic = false, curStrike = false, curCode = false, curUnderline = false;

        function closeAll() {
          if (curCode || curStrike || curBold || curItalic || curUnderline) {
            // Move trailing whitespace after closing markers (CommonMark rule)
            var wsMatch = result.match(/(\s+)$/);
            var trailingSpace = "";
            if (wsMatch) {
              trailingSpace = wsMatch[1];
              result = result.substring(0, result.length - trailingSpace.length);
            }
            if (curCode) { result += "`"; curCode = false; }
            if (curStrike) { result += "~~"; curStrike = false; }
            if (curBold) { result += "**"; curBold = false; }
            if (curItalic) { result += "*"; curItalic = false; }
            if (curUnderline) { result += "</u>"; curUnderline = false; }
            if (trailingSpace) result += trailingSpace;
          }
        }

        function transitionTo(wantBold, wantItalic, wantStrike, wantCode, wantUnderline) {
          var needsClose = (curCode && !wantCode) || (curStrike && !wantStrike) ||
                           (curBold && !wantBold) || (curItalic && !wantItalic) ||
                           (curUnderline && !wantUnderline);
          // Before closing markers, move trailing whitespace after the closing marker
          // (CommonMark requires no space before closing emphasis delimiter)
          var trailingSpace = "";
          if (needsClose) {
            var wsMatch = result.match(/(\s+)$/);
            if (wsMatch) {
              trailingSpace = wsMatch[1];
              result = result.substring(0, result.length - trailingSpace.length);
            }
          }
          // Close markers that are ending (innermost first, underline outermost = last to close)
          if (curCode && !wantCode) { result += "`"; curCode = false; }
          if (curStrike && !wantStrike) { result += "~~"; curStrike = false; }
          if (curBold && !wantBold) { result += "**"; curBold = false; }
          if (curItalic && !wantItalic) { result += "*"; curItalic = false; }
          if (curUnderline && !wantUnderline) { result += "</u>"; curUnderline = false; }
          // Re-add trailing whitespace after closing markers
          if (trailingSpace) result += trailingSpace;
          // Open markers that are starting (underline outermost = first to open)
          if (wantUnderline && !curUnderline) { result += "<u>"; curUnderline = true; }
          if (wantItalic && !curItalic) { result += "*"; curItalic = true; }
          if (wantBold && !curBold) { result += "**"; curBold = true; }
          if (wantStrike && !curStrike) { result += "~~"; curStrike = true; }
          if (wantCode && !curCode) { result += "`"; curCode = true; }
        }

        for (var i = 0; i < parts.length; i++) {
          var part = parts[i];

          // Raw parts (image markers) — close all formatting, emit raw, continue
          if (part.raw) {
            closeAll();
            result += part.text;
            continue;
          }

          if (!part.text || part.text.length === 0) continue;

          var wantBold = !!part.bold;
          var wantItalic = !!part.italic;
          var wantStrike = !!part.strikethrough;
          var wantCode = !!part.code;
          var wantUnderline = !!part.underline;

          transitionTo(wantBold, wantItalic, wantStrike, wantCode, wantUnderline);

          // Emit text — with link wrapping if present
          if (part.link) {
            var linkText = wantCode ? part.text : escapeMarkdown(part.text);
            result += "[" + linkText + "](" + part.link + ")";
          } else if (wantCode) {
            result += part.text;
          } else {
            result += escapeMarkdown(part.text);
          }
        }

        // Close any remaining open markers
        closeAll();

        return result;
      }

      function paragraphToMarkdown(para) {
        // Build an array of annotated parts for buildMarkdownFromParts()
        var annotatedParts = [];

        // Check if paragraph has any scribe drawings (fast path)
        var paraDrawings = para.GetAllDrawingObjects();
        var hasScribeDrawings = false;
        if (paraDrawings) {
          for (var pd = 0; pd < paraDrawings.length; pd++) {
            var pdName = paraDrawings[pd].GetName();
            if (pdName && pdName.indexOf("scribe-img-") === 0) {
              hasScribeDrawings = true;
              break;
            }
          }
        }

        // Helper to extract formatting flags from a text properties object
        function getRunFlags(tp) {
          var isBold = tp ? tp.GetBold() : false;
          var isItalic = tp ? tp.GetItalic() : false;
          var isStrike = tp ? tp.GetStrikeout() : false;
          var isUnderline = tp ? tp.GetUnderline() : false;
          var fontFamily = tp ? tp.GetFontFamily() : null;
          var isCode = false;
          if (fontFamily) {
            var ff = fontFamily.toLowerCase();
            if (ff.indexOf("courier") !== -1 || ff.indexOf("consolas") !== -1 || ff.indexOf("mono") !== -1) {
              isCode = true;
            }
          }
          return { bold: !!isBold, italic: !!isItalic, strikethrough: !!isStrike, underline: !!isUnderline, code: isCode };
        }

        var count = para.GetElementsCount();
        for (var i = 0; i < count; i++) {
          var el = para.GetElement(i);
          var classType = el.GetClassType ? el.GetClassType() : "";

          if (classType === "hyperlink") {
            var hUrl = el.GetLinkedText ? el.GetLinkedText() : "";
            // Collect link display text and formatting from child runs
            var hText = "";
            var hFlags = { bold: false, italic: false, strikethrough: false, code: false };
            var hCount = el.GetElementsCount ? el.GetElementsCount() : 0;
            for (var hi = 0; hi < hCount; hi++) {
              var hChild = el.GetElement(hi);
              var hChildText = hChild.GetText ? hChild.GetText() : "";
              if (hChildText) hText += hChildText;
              // Use formatting of first non-empty child run
              if (hChildText && !hFlags._set) {
                var hTp = hChild.GetTextPr ? hChild.GetTextPr() : null;
                if (hTp) {
                  hFlags = getRunFlags(hTp);
                  hFlags._set = true;
                }
              }
            }
            if (hUrl && hText) {
              annotatedParts.push({ text: hText, link: hUrl, bold: hFlags.bold, italic: hFlags.italic, strikethrough: hFlags.strikethrough, underline: hFlags.underline, code: hFlags.code });
            } else if (hText) {
              annotatedParts.push({ text: hText, bold: hFlags.bold, italic: hFlags.italic, strikethrough: hFlags.strikethrough, underline: hFlags.underline, code: hFlags.code });
            }
          } else if (classType === "run") {
            var runText = el.GetText();
            if (!runText || runText.length === 0) {
              // Check for drawing-only run
              if (hasScribeDrawings) {
                var emptyRunDrawings = el.GetInlineDrawings ? el.GetInlineDrawings() : [];
                for (var ed = 0; ed < emptyRunDrawings.length; ed++) {
                  var edDrawing = emptyRunDrawings[ed].drawing;
                  var edName = edDrawing && edDrawing.GetName ? edDrawing.GetName() : "";
                  if (edName && edName.indexOf("scribe-img-") === 0) {
                    annotatedParts.push({ text: "{{IMG:" + edName + "}}", raw: true });
                  }
                }
              }
              continue;
            }

            var flags = getRunFlags(el.GetTextPr ? el.GetTextPr() : null);

            // Run has text — check for inline drawings interleaved with text
            if (hasScribeDrawings) {
              var inlineDrawings = el.GetInlineDrawings ? el.GetInlineDrawings() : [];
              if (inlineDrawings.length > 0) {
                var lastPos = 0;
                for (var id = 0; id < inlineDrawings.length; id++) {
                  var dPos = inlineDrawings[id].position;
                  var idDrawing = inlineDrawings[id].drawing;
                  var dName = idDrawing && idDrawing.GetName ? idDrawing.GetName() : "";
                  if (dPos > lastPos) {
                    annotatedParts.push({ text: runText.substring(lastPos, dPos), bold: flags.bold, italic: flags.italic, strikethrough: flags.strikethrough, underline: flags.underline, code: flags.code });
                  }
                  if (dName && dName.indexOf("scribe-img-") === 0) {
                    annotatedParts.push({ text: "{{IMG:" + dName + "}}", raw: true });
                  }
                  lastPos = dPos;
                }
                if (lastPos < runText.length) {
                  annotatedParts.push({ text: runText.substring(lastPos), bold: flags.bold, italic: flags.italic, strikethrough: flags.strikethrough, underline: flags.underline, code: flags.code });
                }
                continue;
              }
            }

            // Normal text run (no drawings)
            annotatedParts.push({ text: runText, bold: flags.bold, italic: flags.italic, strikethrough: flags.strikethrough, underline: flags.underline, code: flags.code });
          } else {
            var fallbackText = el.GetText ? el.GetText() : "";
            if (fallbackText) {
              annotatedParts.push({ text: escapeMarkdown(fallbackText), raw: true });
            }
          }
        }

        return buildMarkdownFromParts(annotatedParts);
      }

      // Detect heading level from paragraph style name
      function getHeadingLevel(para) {
        var style = para.GetStyle();
        if (!style) return 0;
        var name = style.GetName();
        if (!name) return 0;
        // Match "Heading N" or "Titre N" (French OO)
        var match = name.match(/^(?:Heading|Titre)\s+(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      }

      // Detect list type from numbering or style name.
      // Level is resolved later via indentDepthMap (see pre-scan below).
      function isListParagraph(para) {
        var numPr = para.GetNumbering();
        if (numPr) {
          var numFmt = numPr.GetNumFmt ? numPr.GetNumFmt() : null;
          var isBullet = !numFmt || numFmt === "bullet" || numFmt === "none";
          return { type: isBullet ? "bullet" : "ordered" };
        }
        // Fallback: check style name
        var style = para.GetStyle();
        if (style) {
          var sn = style.GetName();
          if (sn && /list\s*bullet/i.test(sn)) return { type: "bullet" };
          if (sn && /list\s*number/i.test(sn)) return { type: "ordered" };
        }
        return null;
      }

      // --- Image detection helper (MARK-01) ---
      function getDrawingMarker(para) {
        var drawings = para.GetAllDrawingObjects();
        if (!drawings || drawings.length === 0) return null;
        var markers = [];
        var hasUnnamed = false;
        for (var d = 0; d < drawings.length; d++) {
          var drawing = drawings[d];
          var name = drawing.GetName();
          if (!name || name.indexOf("scribe-img-") !== 0) {
            name = "scribe-img-" + Asc.scope.imgCounter;
            Asc.scope.imgCounter = Asc.scope.imgCounter + 1;
            drawing.SetName(name);
            hasUnnamed = true;
          }
          markers.push({ name: name });
        }
        // Determine block vs inline: if paragraph has ONLY drawings and no text
        var paraText = para.GetText();
        var trimmed = paraText.replace(/^\s+|\s+$/g, "");
        if (trimmed.length === 0 && markers.length > 0) {
          // Block images — one per line
          var result = [];
          for (var m = 0; m < markers.length; m++) {
            result.push("![IMG:" + markers[m].name + "](placeholder)");
          }
          return { md: result.join("\n"), isBlock: true, hasUnnamed: hasUnnamed };
        } else {
          // Inline images — embed in text
          var inlineParts = [];
          for (var m2 = 0; m2 < markers.length; m2++) {
            inlineParts.push("{{IMG:" + markers[m2].name + "}}");
          }
          return { md: inlineParts.join(""), isBlock: false, hasUnnamed: hasUnnamed };
        }
      }

      // --- Table cell extraction helper (MARK-02) ---
      function extractTableCells(table) {
        var cellMd = [];
        var rowCount = table.GetRowsCount();
        for (var r = 0; r < rowCount; r++) {
          var row = table.GetRow(r);
          var cellCount = row.GetCellsCount();
          for (var c = 0; c < cellCount; c++) {
            var cell = table.GetCell(r, c);
            var content = cell.GetContent();
            // Extract text from all paragraphs in the cell
            var cellText = "";
            var elemCount = content.GetElementsCount();
            for (var e = 0; e < elemCount; e++) {
              var elem = content.GetElement(e);
              if (elem.GetClassType && elem.GetClassType() === "paragraph") {
                if (cellText.length > 0) cellText = cellText + " ";
                cellText = cellText + paragraphToMarkdown(elem);
              }
            }
            cellMd.push("[CELL:" + r + "," + c + "]" + cellText + "[/CELL]");
          }
        }
        return cellMd.join("\n");
      }

      // --- Main extraction logic ---
      var doc = Api.GetDocument();
      var range = doc.GetRangeBySelect();
      if (!range) return JSON.stringify({ text: "", md: "" });

      var paragraphs = range.GetAllParagraphs();

      // Performance guard: fall back to simple text for large selections
      if (paragraphs.length > 100) {
        return JSON.stringify({ text: range.GetText(), md: "" });
      }

      var mdParts = [];
      var plainParts = [];
      var orderedCounters = {};

      // Detect tables in the selection range
      var allTables = doc.GetAllTables();
      var selStart = range.GetStartPos ? range.GetStartPos() : 0;
      var selEnd = range.GetEndPos ? range.GetEndPos() : 999999;

      // Build set of table ranges that overlap the selection
      // Also record the document-level table index for each, so injection
      // can find the same table later (selection may be lost by then).
      var tableRanges = [];
      for (var t = 0; t < allTables.length; t++) {
        var tbl = allTables[t];
        var tblRange = tbl.GetRange();
        if (!tblRange) continue;
        var tStart = tblRange.GetStartPos();
        var tEnd = tblRange.GetEndPos();
        if (tEnd >= selStart && tStart <= selEnd) {
          tableRanges.push({ table: tbl, start: tStart, end: tEnd, emitted: false, docIndex: t });
        }
      }

      // Pre-scan: collect unique indentation values from list paragraphs
      // to build a depth map (same approach as normalizeHtml margin-left mapping).
      // Sorted unique indents → index = nesting level.
      var indentSet = {};
      for (var ps = 0; ps < paragraphs.length; ps++) {
        if (isListParagraph(paragraphs[ps])) {
          var ind = paragraphs[ps].GetIndLeft ? paragraphs[ps].GetIndLeft() : 0;
          if (ind > 0) indentSet[ind] = true;
        }
      }
      var uniqueIndents = [];
      for (var key in indentSet) {
        if (indentSet.hasOwnProperty(key)) uniqueIndents.push(Number(key));
      }
      uniqueIndents.sort(function(a, b) { return a - b; });

      // Map an indent value to its depth (0-based)
      function indentToLevel(indLeft) {
        if (!indLeft || indLeft <= 0) return 0;
        for (var idx = 0; idx < uniqueIndents.length; idx++) {
          if (uniqueIndents[idx] === indLeft) return idx;
        }
        return 0;
      }

      var tableIndex = 0;
      var tableDocIndices = [];  // tableDocIndices[tableIndex] = doc-level index in GetAllTables()
      for (var p = 0; p < paragraphs.length; p++) {
        var para = paragraphs[p];
        var paraRange = para.GetRange();
        var pStart = paraRange ? paraRange.GetStartPos() : -1;

        // Check if this paragraph is inside a table
        var insideTable = false;
        for (var ti = 0; ti < tableRanges.length; ti++) {
          if (pStart >= tableRanges[ti].start && pStart <= tableRanges[ti].end) {
            insideTable = true;
            // Emit table cells once (when first cell paragraph is encountered)
            if (!tableRanges[ti].emitted) {
              tableRanges[ti].emitted = true;
              var tableCellsMd = extractTableCells(tableRanges[ti].table);
              mdParts.push({ md: "[TABLE:" + tableIndex + "]\n" + tableCellsMd + "\n[/TABLE]", isList: false });
              tableDocIndices.push(tableRanges[ti].docIndex);
              tableIndex = tableIndex + 1;
            }
            break;
          }
        }
        if (insideTable) {
          plainParts.push(para.GetText());
          continue;
        }

        // Check for images
        var imgMarker = getDrawingMarker(para);
        if (imgMarker && imgMarker.isBlock) {
          mdParts.push({ md: imgMarker.md, isList: false });
          plainParts.push(para.GetText());
          continue;
        }

        // Detect block-level decoration: heading or list
        var headingLvl = getHeadingLevel(para);
        var listType = isListParagraph(para);
        var listInfo = null;
        if (listType) {
          var paraIndent = para.GetIndLeft ? para.GetIndLeft() : 0;
          listInfo = { type: listType.type, level: indentToLevel(paraIndent) };
        }

        // Regular paragraph — inline images are now handled inside paragraphToMarkdown
        var paraMarkdown = paragraphToMarkdown(para);

        // Apply heading prefix
        if (headingLvl > 0 && headingLvl <= 6) {
          var hashes = "";
          for (var h = 0; h < headingLvl; h++) hashes = hashes + "#";
          paraMarkdown = hashes + " " + paraMarkdown;
        }

        // Apply list prefix with nesting indentation
        if (listInfo) {
          var indent = "";
          for (var li = 0; li < listInfo.level; li++) indent = indent + "  ";
          if (listInfo.type === "bullet") {
            paraMarkdown = indent + "- " + paraMarkdown;
          } else {
            // Track ordered list counters per nesting level
            if (!orderedCounters[listInfo.level]) orderedCounters[listInfo.level] = 0;
            orderedCounters[listInfo.level] = orderedCounters[listInfo.level] + 1;
            paraMarkdown = indent + orderedCounters[listInfo.level] + ". " + paraMarkdown;
          }
          // Reset deeper level counters when we're at a shallower level
          for (var rl = listInfo.level + 1; rl < 10; rl++) {
            orderedCounters[rl] = 0;
          }
        } else {
          // Not a list item — reset all ordered counters
          orderedCounters = {};
        }

        mdParts.push({ md: paraMarkdown, isList: !!listInfo });
        plainParts.push(para.GetText());
      }

      // Join with \n between consecutive list items, \n\n between other blocks
      var mdLines = [];
      for (var j = 0; j < mdParts.length; j++) {
        if (j > 0) {
          var prevIsList = mdParts[j - 1].isList;
          var currIsList = mdParts[j].isList;
          mdLines.push((prevIsList && currIsList) ? "\n" : "\n\n");
        }
        mdLines.push(mdParts[j].md);
      }

      return JSON.stringify({
        text: plainParts.join("\n"),
        md: mdLines.join(""),
        tableDocIndices: tableDocIndices
      });
    }, false, false, function(resultJson) {
      // false = read-write (allows SetName on images for stable naming)
      // Update module-level imageCounter from Asc.scope
      imageCounter = window.Asc.scope.imgCounter || imageCounter;
      var result;
      try {
        result = JSON.parse(resultJson);
      } catch (e) {
        result = { text: "", md: "" };
      }
      var plainText = (result.text || "").replace(/^\s+|\s+$/g, "");

      lastSelectedText = plainText;
      lastEnrichedMd = result.md || "";
      lastTableDocIndices = result.tableDocIndices || [];
      lastSelectedHtml = ""; // No longer used for primary extraction

      if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);

      if (plainText.length > 0) {
        selectionDebounceTimer = setTimeout(function() {
          castIntent("SHOW_SCRIBE_BUTTON", { text: plainText }, true);
          scribeButtonShown = true;
          startHidePolling();
        }, SELECTION_DEBOUNCE_MS);
      } else {
        lastEnrichedMd = "";
        if (scribeButtonShown) {
          scribeButtonShown = false;
          castIntent("HIDE_SCRIBE_BUTTON", {}, true);
        }
        stopHidePolling();
      }
    });
  };

  // ---- Required: button handler ----
  window.Asc.plugin.button = function(id) {
    this.executeCommand("close", "");
  };

  // ---- Context menu: show "Scribe" when text is selected ----
  window.Asc.plugin.event_onContextMenuShow = function(options) {
    if (options.type === "Selection") {
      this.executeMethod("AddContextMenuItem", [{
        guid: this.guid,
        items: [{
          id: "onClickScribe",
          text: {
            en: "Scribe",
            fr: "Scribe"
          }
        }]
      }]);
    }
  };

  // ---- Context menu click handler ----
  window.Asc.plugin.attachContextMenuClickEvent("onClickScribe", function() {
    log("Context menu 'Scribe' clicked");
    window.Asc.plugin.executeMethod("GetSelectedText", [{
      Numbering: false,
      Math: false,
      TableCellSeparator: "\n",
      ParaSeparator: "\n",
      TabSymbol: String.fromCharCode(9)
    }], function(selectedText) {
      lastSelectedText = selectedText || "";
      // Use stored HTML from latest init() call
      castIntent("AI_TEXT_ASSISTANT", buildEditIntentData());
    });
  });

  // ---- Ctrl+Shift+I unified handler ----
  // The plugin doesn't know panel state — it just emits intents. React decides.
  //
  // With text selected: AI_TEXT_ASSISTANT is delayed by SHORTCUT_DELAY_MS (200ms).
  //   A 2nd press within that delay cancels it and casts TOGGLE_SCRIBE_PANEL
  //   instead (direct-to-panel, no popover flash). After the delay, if the
  //   popover is open, a 2nd press during EDIT_COOLDOWN_MS also toggles panel.
  //   If panel is already open, React closes it on receiving AI_TEXT_ASSISTANT.
  // Without text selected: cast TOGGLE_SCRIBE_PANEL immediately (single press).
  var editDelayTimer = null;
  var lastEditIntentTime = 0;
  var SHORTCUT_DELAY_MS = 200;
  var EDIT_COOLDOWN_MS = 1500;

  function handleCtrlShiftI(e) {
    var isCtrlShiftI = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i");
    if (!isCtrlShiftI) return;
    e.preventDefault();

    var now = Date.now();

    // If AI_TEXT_ASSISTANT is pending (delayed) or was recently cast, 2nd press toggles panel
    if (editDelayTimer) {
      clearTimeout(editDelayTimer);
      editDelayTimer = null;
      log("Ctrl+Shift+I double-tap: toggle panel");
      castIntent("TOGGLE_SCRIBE_PANEL", {}, true);
      lastEditIntentTime = 0;
      return;
    }
    if (now - lastEditIntentTime < EDIT_COOLDOWN_MS) {
      log("Ctrl+Shift+I during popover: toggle panel");
      castIntent("TOGGLE_SCRIBE_PANEL", {}, true);
      lastEditIntentTime = 0;
      return;
    }

    if (lastSelectedText.length > 0) {
      // Text selected: delay AI_TEXT_ASSISTANT to allow double-tap detection
      editDelayTimer = setTimeout(function() {
        editDelayTimer = null;
        log("Ctrl+Shift+I triggered Scribe");
        lastEditIntentTime = Date.now();
        var promise = castIntent("AI_TEXT_ASSISTANT", buildEditIntentData());
        // Clear cooldown when the intent is resolved (popover closed or
        // panel closed), so the next Ctrl+Shift+I starts fresh
        if (promise) {
          promise.then(function() { lastEditIntentTime = 0; });
        }
      }, SHORTCUT_DELAY_MS);
    } else {
      // No text selected: toggle panel directly
      log("Ctrl+Shift+I: toggle panel");
      castIntent("TOGGLE_SCRIBE_PANEL", {}, true);
    }
  }

  try {
    window.parent.document.addEventListener("keydown", handleCtrlShiftI);
    log("Ctrl+Shift+I shortcut registered on parent document");
  } catch (e) {
    log("Cannot register Ctrl+Shift+I on parent document: " + e.message);
    document.addEventListener("keydown", handleCtrlShiftI);
  }

  // ---- Toolbar button ----
  // Add a "Scribe" button in the OO toolbar (Plugins tab).
  // Available since OO 8.1 via AddToolbarMenuItem API.
  function addToolbarButton() {
    window.Asc.plugin.executeMethod("AddToolbarMenuItem", [{
      guid: window.Asc.plugin.guid,
      tabs: [{
        id: "plugins",
        items: [{
          id: "scribeToolbarBtn",
          type: "button",
          text: "Scribe",
          hint: "Scribe AI writing assistant",
          lockInViewMode: true,
          icons: "resources/%theme-type%(light|dark)/icon%scale%(default).%extension%(png)"
        }]
      }]
    }]);

    window.Asc.plugin.attachToolbarMenuClickEvent("scribeToolbarBtn", function() {
      triggerScribeIfSelection();
    });

    log("Toolbar button added");
  }

  // Fallback: global toolbar click event
  window.Asc.plugin.event_onToolbarMenuClick = function(id) {
    if (id === "scribeToolbarBtn") {
      triggerScribeIfSelection();
    }
  };

  function triggerScribeIfSelection() {
    if (lastSelectedText.length > 0) {
      castIntent("AI_TEXT_ASSISTANT", buildEditIntentData());
    } else {
      log("No text selected — toolbar click ignored");
    }
  }

  document.addEventListener("DOMContentLoaded", function() {
    log("Plugin loaded, Scribe trigger ready");
  });

})(window, undefined);
