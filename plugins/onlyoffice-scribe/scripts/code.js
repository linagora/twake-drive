(function(window, undefined) {
  "use strict";

  // ---- Build marker ----
  // Bump SCRIBE_BUILD on every meaningful code.js change so a loaded build can be
  // identified despite OO's immutable plugin cache. Verify which build is live:
  //   • browser console → look for the "[Scribe] build …" line at plugin load/init;
  //   • or evaluate `window.__scribeBuild` in the plugin iframe.
  // If the console shows an OLDER build than expected, the editor served a CACHED
  // code.js → reopen the editor in a fresh tab / private window (a plain F5 won't
  // refetch the async plugin iframe).
  var SCRIBE_BUILD = "2026-06-26.1 — test driver: intra-cell selection spec T<n>.C(r,c)@pos (§4ter harness, UNTESTED live)";
  try { window.__scribeBuild = SCRIBE_BUILD; } catch (e) {}

  // ---- State ----
  var lastSelectedText = "";
  var lastSelectedHtml = "";
  var lastEnrichedMd = "";
  var lastTableDocIndices = [];
  var lastTableSnapshots = null;
  var lastTableAmbiguity = null;
  var lastPartialTableInfo = null;
  var imageCounter = 0;
  var footnoteCounter = 0;
  var crossRefCounter = 0;
  var lastCrossRefMeta = {};  // scribe-ref-N -> { type, screenTip, displayedText }
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

  // Announce the loaded build immediately (module load = code.js fetched & executed).
  log("build " + SCRIBE_BUILD);

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

  // Build AI_TEXT_ASSISTANT intent data with optional HTML field (EXTR-02)
  function buildEditIntentData() {
    var data = { text: lastSelectedText };
    if (lastEnrichedMd && lastEnrichedMd.length > 0) {
      data.enrichedMd = lastEnrichedMd;
    }
    if (lastTableAmbiguity) {
      data.tableAmbiguity = lastTableAmbiguity;
    }
    if (lastPartialTableInfo) {
      data.partialTableInfo = lastPartialTableInfo;
    }
    if (lastTableSnapshots) {
      data.tableSnapshots = lastTableSnapshots;
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
            var token = {
              type: "underline",
              raw: match[0],
              text: match[1],
              tokens: []
            };
            this.lexer.inlineTokens(match[1], token.tokens);
            return token;
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

    // Merge adjacent runs that share identical formatting into a single run.
    // The self-contained segment strategy produces one run per OO segment,
    // which can create adjacent runs with the same link URL or code style.
    // Merging here ensures the Builder API creates a single hyperlink/run
    // instead of multiple contiguous ones.
    function mergeAdjacentRuns(runs) {
      if (runs.length <= 1) return runs;
      var merged = [runs[0]];
      for (var i = 1; i < runs.length; i++) {
        var prev = merged[merged.length - 1];
        var cur = runs[i];
        // Skip special markers — never merge
        if (prev.imageMarker || cur.imageMarker || prev.footnoteMarker || cur.footnoteMarker || prev.crossRefMarker || cur.crossRefMarker) {
          merged.push(cur);
          continue;
        }
        // Merge if all formatting flags match
        if (prev.bold === cur.bold &&
            prev.italic === cur.italic &&
            prev.strikethrough === cur.strikethrough &&
            prev.underline === cur.underline &&
            prev.code === cur.code &&
            prev.link === cur.link) {
          prev.text += cur.text;
        } else {
          merged.push(cur);
        }
      }
      return merged;
    }

    function flattenInline(tokens, parentBold, parentItalic, parentStrikethrough, parentCode, parentLink, parentUnderline) {
      var runs = [];
      for (var i = 0; i < tokens.length; i++) {
        var tok = tokens[i];
        if (tok.type === "text") {
          // Check for footnote [^scribe-fn-N] or cross-ref {{REF:scribe-ref-N:text}} markers
          var markerRegex = /\[\^(scribe-fn-\d+)\]|\{\{REF:(scribe-ref-\d+):([^}]*)\}\}/g;
          if (tok.text && markerRegex.test(tok.text)) {
            markerRegex.lastIndex = 0;  // reset after test()
            var mMatch;
            var mLastIdx = 0;
            while ((mMatch = markerRegex.exec(tok.text)) !== null) {
              // Text before the marker
              if (mMatch.index > mLastIdx) {
                runs.push({ text: tok.text.substring(mLastIdx, mMatch.index), bold: !!parentBold, italic: !!parentItalic, strikethrough: !!parentStrikethrough, underline: !!parentUnderline, code: !!parentCode, link: parentLink || null });
              }
              // The marker run
              if (mMatch[1]) {
                runs.push({ text: "", footnoteMarker: mMatch[1], bold: false, italic: false, strikethrough: false, underline: false, code: false, link: null });
              } else if (mMatch[2]) {
                // mMatch[3] = visible text from LLM (may differ from original)
                runs.push({ text: "", crossRefMarker: mMatch[2], crossRefText: mMatch[3] || "", bold: false, italic: false, strikethrough: false, underline: false, code: false, link: null });
              }
              mLastIdx = markerRegex.lastIndex;
            }
            // Text after last marker
            if (mLastIdx < tok.text.length) {
              runs.push({ text: tok.text.substring(mLastIdx), bold: !!parentBold, italic: !!parentItalic, strikethrough: !!parentStrikethrough, underline: !!parentUnderline, code: !!parentCode, link: parentLink || null });
            }
          } else {
            runs.push({ text: tok.text, bold: !!parentBold, italic: !!parentItalic, strikethrough: !!parentStrikethrough, underline: !!parentUnderline, code: !!parentCode, link: parentLink || null });
          }
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
      return mergeAdjacentRuns(runs);
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
    // Keep visible text in cross-ref markers — the LLM may modify it (e.g. translation).
    // flattenInline will parse both the ref name and the visible text.

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
        // Split cell text on \n\n boundaries to preserve empty paragraphs.
        // marked.lexer treats blank lines as separators (drops empty paragraphs),
        // so we split first and parse each segment individually.
        var cellSegments = cellText.split(/\n\n/);
        var cellBlocks = [];
        var cellRuns = [];
        for (var cs = 0; cs < cellSegments.length; cs++) {
          var seg = cellSegments[cs];
          if (seg.replace(/^\s+|\s+$/g, "").length === 0) {
            // Empty segment = empty paragraph
            cellBlocks.push({ type: "paragraph", runs: [] });
          } else {
            var segTokens = window.marked.lexer(seg);
            var segBlocks = flattenTokens(segTokens);
            for (var sb = 0; sb < segBlocks.length; sb++) {
              cellBlocks.push(segBlocks[sb]);
            }
          }
        }
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
          runs: cellRuns,
          blocks: cellBlocks
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
    Asc.scope.tokens = JSON.stringify(flat);
    Asc.scope._mode = mode || "replace";
    if (parsedTables.length > 0) {
      Asc.scope.parsedTables = JSON.stringify(parsedTables);
      Asc.scope.tableDocIndices = JSON.stringify(lastTableDocIndices);
      Asc.scope.tableSnapshots = lastTableSnapshots || null;
    } else {
      Asc.scope.parsedTables = null;
      Asc.scope.tableDocIndices = null;
      Asc.scope.tableSnapshots = null;
    }
    Asc.scope.partialTableInfo = lastPartialTableInfo ? JSON.stringify(lastPartialTableInfo) : null;
    // Pass cross-ref metadata for API recreation during injection
    Asc.scope.crossRefMeta = JSON.stringify(lastCrossRefMeta);
    // Detect mixed content: partial table + non-table blocks (paragraphs)
    // In Replace mode with mixed content, partial tables must use clone (not in-place)
    // because InsertContent replaces the entire selection including the table cells.
    var hasMixedContent = false;
    if (lastPartialTableInfo && parsedTables.length > 0) {
      for (var mi = 0; mi < flat.length; mi++) {
        // Check if this block is a SCRIBE-TABLE placeholder
        var miRuns = flat[mi].runs || [];
        var miText = "";
        for (var mj = 0; mj < miRuns.length; mj++) { miText += miRuns[mj].text || ""; }
        if (miText.indexOf("SCRIBE-TABLE-") === -1) { hasMixedContent = true; break; }
      }
    }
    Asc.scope.hasMixedContent = hasMixedContent;

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

      // [TEST HOOK — flag-gated, inert in prod] When a test selection spec is
      // queued (Asc.scope._testSelSpec, set ONLY by the injectAtSelection dev
      // hook), apply it HERE so it lives in the SAME callCommand that reads it —
      // a collapsed cursor set in a separate callCommand resets to offset 0.
      // One-shot: cleared immediately so later (real) injects never see it.
      var _testSelSpec = Asc.scope._testSelSpec;
      Asc.scope._testSelSpec = null;
      if (_testSelSpec) {
        try {
          var _tsp = JSON.parse(_testSelSpec);
          var _ttgt = null;
          if (_tsp.startCell) {
            // §4ter intra-cell: n-th TABLE → cell (r,c) → 1st ¶.
            var _tcc = doc.GetElementsCount(), _tsn = 0, _tbl = null;
            for (var _ti = 0; _ti < _tcc; _ti++) {
              var _tel = doc.GetElement(_ti);
              if (_tel.GetClassType && _tel.GetClassType() === "table") { _tsn++; if (_tsn === _tsp.startN) { _tbl = _tel; break; } }
            }
            if (_tbl) { try { _ttgt = _tbl.GetCell(_tsp.startCell.r, _tsp.startCell.c).GetContent().GetElement(0); } catch (e) {} }
          } else {
            var _tcnt = doc.GetElementsCount(), _tseen = 0;
            for (var _tj = 0; _tj < _tcnt; _tj++) {
              var _tel2 = doc.GetElement(_tj);
              if (_tel2.GetClassType && _tel2.GetClassType() === "paragraph") { _tseen++; if (_tseen === _tsp.startN) { _ttgt = _tel2; break; } }
            }
          }
          if (_ttgt) {
            var _ttxt = (_ttgt.GetText ? _ttgt.GetText() : "").replace(/[\r\n]+$/, "");
            var _tlen = _ttxt.length;
            var _toff = function(k) {
              if (/^\d+$/.test(k)) { var _n = parseInt(k, 10); return _n > _tlen ? _tlen : _n; }
              if (k === "end") return _tlen;
              if (k === "mid") return Math.floor(_tlen / 2);
              if (k === "space") { var _ix = _ttxt.indexOf(" "); return _ix >= 0 ? _ix + 1 : 0; }
              return 0;
            };
            var _tat = function(para, off) {
              var _c = para.GetElementsCount ? para.GetElementsCount() : 0, _a = 0;
              for (var _i = 0; _i < _c; _i++) {
                var _e2 = para.GetElement(_i);
                var _ct = _e2.GetClassType ? _e2.GetClassType() : "";
                if (_ct !== "run" && _ct !== "hyperlink") continue;
                var _t2 = (_e2.GetText ? _e2.GetText() : "").replace(/[\r\n]+$/, "");
                if (off <= _a + _t2.length) return _e2.GetRange ? _e2.GetRange(off - _a, off - _a) : null;
                _a += _t2.length;
              }
              return null;
            };
            var _ts = _toff(_tsp.startKind), _te = _toff(_tsp.endKind), _trng = null;
            if (_ts === 0 && _te === _tlen) _trng = _ttgt.GetRange ? _ttgt.GetRange() : null;
            else if (_ts === _te) _trng = _tat(_ttgt, _ts) || (_ttgt.GetRange ? _ttgt.GetRange(0, 0) : null);
            else { var _ra = _tat(_ttgt, _ts), _rb = _tat(_ttgt, _te); _trng = (_ra && _rb && _ra.ExpandTo) ? _ra.ExpandTo(_rb) : (_ra || _rb); }
            if (_trng && _trng.Select) _trng.Select();
          }
        } catch (e) {}
      }

      // Read paragraph-level font style at insertion point
      // Uses paragraph mark text properties (base style, ignoring local run overrides)
      // Falls back to document default text properties
      var srcFontFamily = null;
      var srcFontSize = null;
      var hostStyle = null; // §5bis: ¶ style of the host at the insertion point —
                            // both halves of a block split must keep it.
      var firstBlockStyled = false;  // §5bis Cas B: 1st injected block has its own
                                     // md style (heading/list/quote/code) → must NOT
                                     // merge inline; host keeps its own style.
      var leadSpacerInserted = false; // §5bis Cas B: a host-styled empty spacer was
                                      // unshifted into content[] to absorb OO's merge.
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
            if (para.GetStyle) hostStyle = para.GetStyle();
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
      // Robust host ¶ style: GetRangeBySelect().GetParagraph() is unreliable for a
      // COLLAPSED cursor, so find the host paragraph by iterating to the element whose
      // range covers the selection start position (same technique as smart spacing).
      try {
        var hsSel = doc.GetRangeBySelect();
        if (hsSel) {
          var hsStart = hsSel.GetStartPos();
          var hsCount = doc.GetElementsCount();
          for (var hsi = 0; hsi < hsCount; hsi++) {
            var hsEl = doc.GetElement(hsi);
            if (!hsEl.GetClassType || hsEl.GetClassType() !== "paragraph") continue;
            var hsR = hsEl.GetRange ? hsEl.GetRange() : null;
            if (hsR && hsStart >= hsR.GetStartPos() && hsStart <= hsR.GetEndPos()) {
              if (hsEl.GetStyle) hostStyle = hsEl.GetStyle();
              break;
            }
          }
        }
      } catch (e) {}

      // ---- Smart spacing detection ----
      // Mirrors the pasteHtml spacing pattern (lines 378-416) but for Builder API.
      // Detects adjacent non-whitespace chars around the selection/cursor and sets
      // flags to inject space runs at content boundaries.
      var needSpaceBefore = false;
      var needSpaceAfter = false;
      var WS = /[\s\n\r\t\u00A0]/;

      // Insert mode (\u00A75bis): SYMMETRIC spacing \u2014 add a space before/after the
      // inserted runs only when the adjacent char is non-whitespace, never doubled.
      // OO document positions are ELEMENT units (not chars), so reading the char
      // before/after via doc.GetRange(pos\u00B1n) breaks at a paragraph boundary (the \u00B6
      // mark gets mistaken for the neighbour char). Instead compute the char OFFSET
      // inside the host paragraph from the text length of [paraStart..cursor]
      // (GetText resolves real chars), then index the paragraph text directly.
      if (mode === "insert") {
        var insSelRange = doc.GetRangeBySelect();
        if (insSelRange) {
          var insPos = insSelRange.GetEndPos();
          // Find the HOST paragraph by iteration (GetRangeBySelect().GetParagraph()
          // is unreliable for collapsed cursors) — the element whose range covers
          // insPos. Then compute the cursor's CHAR offset inside it (text length of
          // [hostStart..cursor], GetText resolves real chars) and read the char
          // before/after directly from the paragraph text. aChar = "" at end-of-
          // paragraph → no trailing space (the previous range-based read leaked into
          // the NEXT paragraph and wrongly added a space at @end).
          var hostPara = null, hostStart = -1;
          var ecount = doc.GetElementsCount();
          for (var ei = 0; ei < ecount; ei++) {
            var eel = doc.GetElement(ei);
            if (!eel.GetClassType || eel.GetClassType() !== "paragraph") continue;
            var er = eel.GetRange ? eel.GetRange() : null;
            if (!er) continue;
            if (insPos >= er.GetStartPos() && insPos <= er.GetEndPos()) { hostPara = eel; hostStart = er.GetStartPos(); break; }
          }
          if (hostPara) {
            var hpText = (hostPara.GetText ? hostPara.GetText() : "").replace(/[\r\n]+$/, "");
            var prefR = doc.GetRange(hostStart, insPos);
            var pref = prefR ? (prefR.GetText() || "").replace(/[\r\n]+$/, "") : "";
            var off = pref.length;
            var bChar = off > 0 ? hpText.charAt(off - 1) : "";
            var aChar = off < hpText.length ? hpText.charAt(off) : "";
            if (bChar && !WS.test(bChar)) needSpaceBefore = true;
            if (aChar && !WS.test(aChar)) needSpaceAfter = true;
          }
          // Collapse the cursor to the insertion point (end of the selection).
          var collapseRange = doc.GetRange(insPos, insPos);
          if (collapseRange) collapseRange.Select();
        }
      }

      try {
        if (mode === "insert") {
          // Insert mode: spacing handled by paragraph separators, not space runs
        } else {
          // Replace mode: check char before selection start and after selection end
          var repRange = doc.GetRangeBySelect();
          if (repRange) {
            // §5bis: read the neighbour char CLAMPED to its host paragraph, so a ¶
            // boundary counts as a newline (blank → no space), exactly like the
            // insert branch above. The old doc.GetRange(repEnd, repEnd+5) read
            // leaked across the ¶ mark into the NEXT paragraph and added a spurious
            // trailing space when the whole host ¶ was selected (A1/replace: the
            // selection end lands at the paragraph's GetEndPos, whose forward read
            // returns the next paragraph's first word). Clamping fixes it: at
            // end-of-¶ the within-paragraph char is "" → no space.
            var hostAt = function(pos) {
              var ec2 = doc.GetElementsCount();
              for (var k = 0; k < ec2; k++) {
                var pel = doc.GetElement(k);
                if (!pel.GetClassType || pel.GetClassType() !== "paragraph") continue;
                var pr = pel.GetRange ? pel.GetRange() : null;
                if (!pr) continue;
                if (pos >= pr.GetStartPos() && pos <= pr.GetEndPos()) {
                  var ptext = (pel.GetText ? pel.GetText() : "").replace(/[\r\n]+$/, "");
                  var pfR = doc.GetRange(pr.GetStartPos(), pos);
                  var pf = pfR ? (pfR.GetText() || "").replace(/[\r\n]+$/, "") : "";
                  return { text: ptext, off: pf.length };
                }
              }
              return null;
            };
            var hB = hostAt(repRange.GetStartPos());
            if (hB) {
              var bc = hB.off > 0 ? hB.text.charAt(hB.off - 1) : "";
              if (bc && !WS.test(bc)) needSpaceBefore = true;
            }
            var hA = hostAt(repRange.GetEndPos());
            if (hA) {
              var ac = hA.off < hA.text.length ? hA.text.charAt(hA.off) : "";
              if (ac && !WS.test(ac)) needSpaceAfter = true;
            }
          }
        } // end else (replace mode)
      } catch (e) {
        // Spacing detection failed -- proceed without spacing (safe fallback)
      }

      // §5bis Cas B: when the 1st injected block carries its own paragraph style
      // (heading / list / quote / code), the whole insert goes BLOCK (separate ¶s
      // via the host-styled spacer, see prepareFirstBlockForMerge). Every injected
      // block is then bounded by ¶ marks on BOTH sides, and "bord de ¶ = saut de
      // ligne" (= blank) → NO space run must be added. Suppress smart spacing so the
      // styled block stays clean ("Injected", not " Injected"). Test inlined (the
      // blockHasParaStyle helper is declared later, inside the content>0 block, so
      // it isn't assigned yet here).
      var firstInjBlock = blocks[0];
      var firstInjBlockStyled = !!firstInjBlock && (
        firstInjBlock.type === "heading" ||
        firstInjBlock.type === "list_item" ||
        firstInjBlock.type === "code_block" ||
        (firstInjBlock.type === "paragraph" && firstInjBlock.blockquote)
      );
      if (firstInjBlockStyled) {
        needSpaceBefore = false;
        needSpaceAfter = false;
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
      // Scan document-level paragraphs
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
      // Also scan paragraphs inside table cells (GetAllParagraphs doesn't include them)
      var allDocTables = doc.GetAllTables();
      for (var dit = 0; dit < allDocTables.length; dit++) {
        var ditRows = allDocTables[dit].GetRowsCount();
        for (var ditr = 0; ditr < ditRows; ditr++) {
          var ditRow = allDocTables[dit].GetRow(ditr);
          for (var ditc = 0; ditc < ditRow.GetCellsCount(); ditc++) {
            var ditCell = allDocTables[dit].GetCell(ditr, ditc);
            if (!ditCell) continue;
            var ditContent = ditCell.GetContent();
            if (!ditContent) continue;
            for (var dite = 0; dite < ditContent.GetElementsCount(); dite++) {
              var ditElem = ditContent.GetElement(dite);
              var ditDrawings = ditElem.GetAllDrawingObjects ? ditElem.GetAllDrawingObjects() : null;
              if (!ditDrawings) continue;
              for (var ditd = 0; ditd < ditDrawings.length; ditd++) {
                var ditName = ditDrawings[ditd].GetName();
                if (ditName && ditName.indexOf("scribe-img-") === 0) {
                  drawingIndex[ditName] = ditDrawings[ditd];
                }
              }
            }
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

      // --- Footnote round-trip: save content text, recreate after InsertContent ---
      // Footnote calls appear as runs with style "footnote reference" and empty text.
      // Copy() on these runs does NOT preserve the internal footnote link.
      // Strategy: save footnote content text before InsertContent destroys it,
      // then use doc.AddFootnote() post-InsertContent to recreate.
      // Save all footnote content texts (indexed by document order).
      var footnoteContentTexts = [];
      try {
        var fnParas = doc.GetFootnotesFirstParagraphs();
        if (fnParas) {
          for (var fpi = 0; fpi < fnParas.length; fpi++) {
            var fnText = fnParas[fpi].GetText ? fnParas[fpi].GetText() : "";
            footnoteContentTexts.push(fnText.replace(/[\r\n]+$/, ""));
          }
        }
      } catch (e) {}
      var pendingFootnotes = [];  // [{para, markerName, markerText}] — processed post-InsertContent

      // --- Cross-reference round-trip: recreate via API ---
      // Cross-refs cannot be Copy()-ed (hyperlinks lack Copy method).
      // Instead, use AddHeadingCrossRef/AddBookmarkCrossRef AFTER InsertContent
      // (these API methods require the paragraph to be in the document).
      var crossRefMeta = {};
      try { crossRefMeta = JSON.parse(Asc.scope.crossRefMeta || "{}"); } catch (e) {}

      // Helper: find a bookmark name matching a screenTip (handles space/underscore mismatch).
      // OO screenTip uses spaces ("un signet") but bookmark names use underscores ("un_signet").
      function findBookmarkName(screenTip) {
        var bmNames = doc.GetAllBookmarksNames();
        if (!bmNames) return null;
        for (var bi = 0; bi < bmNames.length; bi++) {
          if (bmNames[bi] === screenTip) return bmNames[bi];
        }
        var normalized = screenTip.replace(/\s+/g, "_");
        for (var bi2 = 0; bi2 < bmNames.length; bi2++) {
          if (bmNames[bi2] === normalized) return bmNames[bi2];
          if (bmNames[bi2].replace(/_/g, " ") === screenTip) return bmNames[bi2];
        }
        return null;
      }

      // Post-InsertContent: recreate footnotes at placeholder positions.
      // Uses doc.AddFootnote() which inserts a footnote at the current selection,
      // then fills it with the saved footnote content text.
      function processPendingFootnotes() {
        for (var pfi = 0; pfi < pendingFootnotes.length; pfi++) {
          var pfr = pendingFootnotes[pfi];
          var para = pfr.para;
          try {
            // Find the placeholder run and select its range
            var pfCount = para.GetElementsCount();
            for (var pfe = 0; pfe < pfCount; pfe++) {
              var pfEl = para.GetElement(pfe);
              var pfText = pfEl.GetText ? pfEl.GetText() : "";
              if (pfText !== pfr.markerText) continue;

              // Select the placeholder run's range so AddFootnote inserts here
              var pfRange = pfEl.GetRange();
              if (pfRange) pfRange.Select();

              // Delete the placeholder text
              pfEl.Delete();

              // AddFootnote() creates a footnote at the current cursor position
              var fnContent = doc.AddFootnote();
              if (fnContent) {
                // Fill footnote with saved content text
                var fnIdx = parseInt(pfr.markerName.replace("scribe-fn-", ""), 10);
                var fnSavedText = (fnIdx < footnoteContentTexts.length) ? footnoteContentTexts[fnIdx] : "";
                if (fnSavedText) {
                  // Get the first paragraph of the footnote and add text
                  var fnPara = fnContent.GetElement(0);
                  if (fnPara) {
                    var fnRun = Api.CreateRun();
                    fnRun.AddText(fnSavedText);
                    fnPara.AddElement(fnRun);
                  }
                }
              }
              break;
            }
          } catch (e) {
            // Footnote recreation failed — the marker is already deleted
          }
        }
      }

      // --- Table round-trip: clone tables via Copy() BEFORE InsertContent ---
      // Pre-cache table clones so they survive InsertContent destroying the selection.
      // Same pattern as image pre-cache: collect originals first, then Copy().
      var parsedTablesJson = Asc.scope.parsedTables;
      var parsedTables = parsedTablesJson ? JSON.parse(parsedTablesJson) : [];
      var tableClones = {};  // index -> ApiTable (cloned + modified), null = in-place
      var tablesModifiedInPlace = false;
      var pendingTableReductions = []; // [{selectedCellCoords}] for post-InsertContent row/col removal

      // Read partialTableInfo for partial table routing
      var partialTableInfoJson = Asc.scope.partialTableInfo;
      var partialTableInfo = partialTableInfoJson ? JSON.parse(partialTableInfoJson) : null;
      var hasMixedContent = Asc.scope.hasMixedContent;

      // Pre-cache images from table cell blocks/runs (in addition to the block scan above)
      for (var itc = 0; itc < parsedTables.length; itc++) {
        var itCells = parsedTables[itc].cells || [];
        for (var itci = 0; itci < itCells.length; itci++) {
          var itBlocks = itCells[itci].blocks || [{ runs: itCells[itci].runs || [] }];
          for (var itbi = 0; itbi < itBlocks.length; itbi++) {
            var itBlock = itBlocks[itbi];
            // Block-level image (image_placeholder)
            if (itBlock.type === "image_placeholder" && itBlock.name) {
              if (!imageCache[itBlock.name] && drawingIndex[itBlock.name]) {
                try { imageCache[itBlock.name] = drawingIndex[itBlock.name].Copy(); } catch (e) {}
              }
            }
            // Inline images in runs
            var itRuns = itBlock.runs || [];
            for (var itri = 0; itri < itRuns.length; itri++) {
              var itMarker = itRuns[itri].imageMarker;
              if (itMarker && !imageCache[itMarker] && drawingIndex[itMarker]) {
                try { imageCache[itMarker] = drawingIndex[itMarker].Copy(); } catch (e) {}
              }
            }
          }
        }
      }

      // Replace the content of a single cell: clear all paragraphs, rebuild from blocks.
      // Used by all injection paths (in-place, reduced clone, full clone).
      // Add block content to a paragraph: handles runs and image_placeholder blocks.
      function addBlockToParagraph(para, block, fontFamily, fontSize) {
        if (block.type === "image_placeholder" && block.name) {
          var imgDrawing = restoreImage(block.name);
          if (imgDrawing) {
            para.AddDrawing(imgDrawing);
          }
        } else {
          addRunsToParagraph(para, block.runs || [], fontFamily, fontSize);
        }
      }

      // Splice a paragraph's content: keep keepStartChars from the beginning,
      // keep keepEndChars from the end, replace the middle with new block content.
      // Used for partially-selected paragraphs in mixed Replace mode.

      function replaceCellContent(cellContent, parsedCell, fontFamily, fontSize) {
        var cellBlocks = parsedCell.blocks || [{ runs: parsedCell.runs || [] }];

        // Remove all paragraphs except the first (need at least one to modify)
        var elemCount = cellContent.GetElementsCount();
        for (var re = elemCount - 1; re > 0; re--) {
          cellContent.RemoveElement(re);
        }

        // First block → first paragraph (clear + rebuild)
        var firstPara = cellContent.GetElement(0);
        if (firstPara && firstPara.RemoveAllElements) {
          firstPara.RemoveAllElements();
        }
        if (cellBlocks.length > 0 && firstPara) {
          addBlockToParagraph(firstPara, cellBlocks[0], fontFamily, fontSize);
        }

        // Additional blocks → new paragraphs added to cell
        for (var bi = 1; bi < cellBlocks.length; bi++) {
          var newPara = Api.CreateParagraph();
          addBlockToParagraph(newPara, cellBlocks[bi], fontFamily, fontSize);
          cellContent.AddElement(bi, newPara);
        }
      }

      // In-place modification for partial table selections (Replace mode).
      function modifyOriginalTableCells(origTable, parsedCells, cFonts) {
        for (var i = 0; i < parsedCells.length; i++) {
          var pc = parsedCells[i];
          var cell = origTable.GetCell(pc.r, pc.c);
          if (!cell) continue;
          var cc = cell.GetContent();
          if (!cc || cc.GetElementsCount() === 0) continue;
          var cf = cFonts[pc.r + "," + pc.c] || {};
          replaceCellContent(cc, pc, cf.family, cf.size);
        }
      }

      // Note: buildReducedTableClone was removed — its logic is now handled inline
      // using reconstructTable() (FromJSON with Clone fallback) + cell modification.

      var allTables = null;
      var tableDocIndices = [];
      var tableSnapshots = Asc.scope.tableSnapshots || null;

      // Read font from first run of first paragraph in a table cell.
      // Works on both FromJSON-reconstructed and original/cloned tables.
      function readCellFont(table, r, c, fallbackFamily, fallbackSize) {
        var cell = table.GetCell(r, c);
        if (cell) {
          var content = cell.GetContent();
          if (content && content.GetElementsCount() > 0) {
            var para = content.GetElement(0);
            if (para && para.GetElementsCount) {
              for (var ei = 0; ei < para.GetElementsCount(); ei++) {
                var elem = para.GetElement(ei);
                if (elem.GetClassType && elem.GetClassType() === "run") {
                  var tp = elem.GetTextPr ? elem.GetTextPr() : null;
                  if (tp) {
                    return {
                      family: tp.GetFontFamily() || fallbackFamily,
                      size: tp.GetFontSize() || fallbackSize
                    };
                  }
                  break;
                }
              }
            }
          }
        }
        return { family: fallbackFamily, size: fallbackSize };
      }

      // Reconstruct a table from ToJSON snapshot, with fallback to Clone from document.
      // Returns an ApiTable (either from snapshot or from Copy()).
      function reconstructTable(ptIndex, origTable) {
        if (tableSnapshots && tableSnapshots[ptIndex]) {
          try {
            var fromJsonTable = Api.FromJSON(tableSnapshots[ptIndex]);
            if (fromJsonTable) return fromJsonTable;
          } catch (fjErr) {
            log("[Scribe] FromJSON failed for TABLE:" + ptIndex + ", falling back to clone");
          }
        }
        // FALLBACK: legacy clone path — remove once ToJSON snapshots are proven stable
        if (origTable) return origTable.Copy();
        return null;
      }

      if (parsedTables.length > 0) {
        // Find original tables by their document-level index (saved during extraction).
        // We cannot rely on selection range here — it may have collapsed since extraction.
        allTables = doc.GetAllTables();
        var tableDocIndicesJson = Asc.scope.tableDocIndices;
        tableDocIndices = tableDocIndicesJson ? JSON.parse(tableDocIndicesJson) : [];

        // Process each table: reconstruct via FromJSON (or clone) + modify cells
        for (var tci = 0; tci < parsedTables.length; tci++) {
          var ptEntry = parsedTables[tci];
          var ptIndex = ptEntry.index;
          var ptCells = ptEntry.cells;
          // Map TABLE:N index to document-level table index
          var docIdx = tableDocIndices[ptIndex];
          var origTable = (docIdx !== undefined && allTables && docIdx < allTables.length) ? allTables[docIdx] : null;

          // Check if this is a partial table
          var isPartialTable = (partialTableInfo && partialTableInfo[ptIndex]);
          var selectedCellCoords = isPartialTable ? partialTableInfo[ptIndex] : null;

          // Read source font from the reconstructed (or original) table for each cell
          // Use the snapshot table if available, otherwise fall back to original
          var fontSourceTable = null;
          if (tableSnapshots && tableSnapshots[ptIndex]) {
            try {
              fontSourceTable = Api.FromJSON(tableSnapshots[ptIndex]);
            } catch (fse) {
              fontSourceTable = null;
            }
          }
          if (!fontSourceTable) fontSourceTable = origTable;

          var cFonts = {};
          if (fontSourceTable) {
            for (var cfi = 0; cfi < ptCells.length; cfi++) {
              var ptc = ptCells[cfi];
              var cfKey = ptc.r + "," + ptc.c;
              cFonts[cfKey] = readCellFont(fontSourceTable, ptc.r, ptc.c, srcFontFamily, srcFontSize);
            }
          } else {
            for (var cfi2 = 0; cfi2 < ptCells.length; cfi2++) {
              cFonts[ptCells[cfi2].r + "," + ptCells[cfi2].c] = { family: srcFontFamily, size: srcFontSize };
            }
          }

          if (mode === "replace") {
            // Check if selection structurally encompasses the table
            // (not just content within cells). Clone+InsertContent only works
            // when the table structure is in the selection.
            var repTblRange = origTable ? origTable.GetRange() : null;
            var repSelRange = doc.GetRangeBySelect();
            var isStructuralFull = false;
            if (repTblRange && repSelRange && !isPartialTable) {
              isStructuralFull = repTblRange.GetStartPos() >= repSelRange.GetStartPos()
                && repTblRange.GetEndPos() <= repSelRange.GetEndPos();
            }

            if (isStructuralFull) {
              // Full table structurally selected — reconstruct via FromJSON + InsertContent
              var repClone = reconstructTable(ptIndex, origTable);
              if (!repClone) continue;
              for (var rci = 0; rci < ptCells.length; rci++) {
                var rc = ptCells[rci];
                var rcCell = repClone.GetCell(rc.r, rc.c);
                if (!rcCell) continue;
                var rcCc = rcCell.GetContent();
                if (!rcCc || rcCc.GetElementsCount() === 0) continue;
                var rcf = cFonts[rc.r + "," + rc.c] || {};
                replaceCellContent(rcCc, rc, rcf.family, rcf.size);
              }
              tableClones[ptIndex] = repClone;
            } else {
              // In-place modification (partial, content-only full, or mixed)
              // Note: in-place modifies the document table directly — no snapshot needed
              if (origTable) {
                modifyOriginalTableCells(origTable, ptCells, cFonts);
              }
              tableClones[ptIndex] = null;
              tablesModifiedInPlace = true;
            }
          } else if (isPartialTable) {
            // Partial Insert — reconstruct via FromJSON, modify selected cells
            var reducedClone = reconstructTable(ptIndex, origTable);
            if (!reducedClone) continue;
            for (var rdi = 0; rdi < ptCells.length; rdi++) {
              var rdc = ptCells[rdi];
              var rdCell = reducedClone.GetCell(rdc.r, rdc.c);
              if (!rdCell) continue;
              var rdCc = rdCell.GetContent();
              if (!rdCc || rdCc.GetElementsCount() === 0) continue;
              var rdf = cFonts[rdc.r + "," + rdc.c] || {};
              replaceCellContent(rdCc, rdc, rdf.family, rdf.size);
            }
            tableClones[ptIndex] = reducedClone;
            pendingTableReductions.push({ clone: reducedClone, selectedCellCoords: selectedCellCoords });
          } else {
            // Full Insert — reconstruct via FromJSON + modify all cells
            var clone = reconstructTable(ptIndex, origTable);
            if (!clone) continue;
            for (var mci = 0; mci < ptCells.length; mci++) {
              var mc = ptCells[mci];
              var cloneCell = clone.GetCell(mc.r, mc.c);
              if (!cloneCell) continue;
              var cloneCc = cloneCell.GetContent();
              if (!cloneCc || cloneCc.GetElementsCount() === 0) continue;
              var mcf = cFonts[mc.r + "," + mc.c] || {};
              replaceCellContent(cloneCc, mc, mcf.family, mcf.size);
            }
            tableClones[ptIndex] = clone;
          }
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
          } else if (run.footnoteMarker) {
            // Footnote placeholder: defer actual footnote creation to post-InsertContent.
            // AddFootnote requires the cursor to be in the document.
            var fnPlaceholder = Api.CreateRun();
            var fnMarkerText = "\u0000FN:" + run.footnoteMarker + "\u0000";
            fnPlaceholder.AddText(fnMarkerText);
            if (fontFamily) fnPlaceholder.SetFontFamily(fontFamily);
            if (fontSize) fnPlaceholder.SetFontSize(fontSize);
            para.AddElement(fnPlaceholder);
            pendingFootnotes.push({ para: para, markerName: run.footnoteMarker, markerText: fnMarkerText });
          } else if (run.crossRefMarker) {
            // Recreate cross-reference as a hyperlink with internal anchor.
            // OO cross-refs use "anchor" (internal bookmark link, prop Us on internal obj),
            // NOT "link" (external URL, prop ma). Api.CreateHyperlink sets ma (URL),
            // so we create one then swap: clear ma, set Us to the anchor value.
            var crMeta = crossRefMeta[run.crossRefMarker];
            // Use LLM's text if available, fall back to original extraction text
            var crDisplayText = run.crossRefText || (crMeta ? crMeta.displayedText : "") || "";
            if (crMeta && crDisplayText) {
              var crInserted = false;
              // Extract anchor from cached JSON
              var crAnchor = "";
              var crTooltip = crMeta.screenTip || "";
              if (crMeta.json) {
                try {
                  crAnchor = (crMeta.json.anchor || "").replace(/[\r\n]+$/, "");
                  crTooltip = (crMeta.json.tooltip || crMeta.screenTip || "").replace(/[\r\n]+$/, "");
                } catch (e) {}
              }
              // For bookmarks: find the actual bookmark name
              if (crMeta.type === "bookmark" && !crAnchor) {
                var bm = findBookmarkName(crMeta.screenTip);
                if (bm) crAnchor = bm;
              }
              // For headings: the anchor (e.g. "_Un_titre") is NOT a real bookmark.
              // Create a real bookmark on the heading paragraph so the hyperlink can target it.
              if (crMeta.type === "heading") {
                try {
                  // Match heading by screenTip text (more reliable than anchor name)
                  var headingText = (crMeta.screenTip || "").replace(/^#_/, "").replace(/_/g, " ");
                  var hParas = doc.GetAllHeadingParagraphs();
                  for (var hpi = 0; hpi < hParas.length; hpi++) {
                    var hpText = hParas[hpi].GetText ? hParas[hpi].GetText() : "";
                    hpText = hpText.replace(/[\s\n\r]+$/, "");
                    if (hpText === headingText) {
                      // Use a clean bookmark name (no leading underscore — may be reserved)
                      var bmName = "scribe_heading_" + run.crossRefMarker.replace("scribe-ref-", "");
                      var hRange = hParas[hpi].GetRange();
                      if (hRange && hRange.AddBookmark) {
                        hRange.AddBookmark(bmName);
                        crAnchor = bmName;  // override anchor to point to our new bookmark
                      }
                      break;
                    }
                  }
                } catch (e) { /* bookmark creation failed */ }
              }
              if (crAnchor) {
                try {
                  // Create hyperlink with placeholder URL, correct text and tooltip
                  var crLink = Api.CreateHyperlink("http://tmp", crDisplayText, crTooltip);
                  if (crLink) {
                    // Patch internal object: swap URL → anchor
                    // Internal props (from diagnostic): ma=URL, Us=anchor, YD=tooltip
                    var crInternal = crLink.u0;
                    if (crInternal) {
                      crInternal.ma = "";        // clear external URL
                      crInternal.Us = crAnchor;  // set internal anchor
                      crInternal.YD = crTooltip; // set tooltip
                    }
                    para.AddElement(crLink);
                    crInserted = true;
                  }
                } catch (e) { /* internal patching failed */ }
              }
              if (!crInserted) {
                // Fallback: plain text
                var crFb = Api.CreateRun();
                crFb.AddText(crDisplayText);
                if (fontFamily) crFb.SetFontFamily(fontFamily);
                if (fontSize) crFb.SetFontSize(fontSize);
                para.AddElement(crFb);
              }
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

      // For mixed Replace with in-place table modification:
      // modify text paragraphs in-place too (BEFORE content building to avoid
      // Api.CreateParagraph() triggering OO undo rollback of cell modifications).
      // For mixed Replace (text + table): use per-paragraph InsertContent
      // BEFORE content building. This is necessary because:
      //   1. A single InsertContent can't exclude a table in the middle of the selection
      //   2. Api.CreateParagraph() in content building causes OO to rollback in-place cell mods
      // Each non-table paragraph gets its own narrowed InsertContent (inline mode),
      // which handles partial paragraphs natively (preserves prefix/suffix).
      // Processed in reverse order to avoid position shifts.
      var skipContentAndInsert = false;
      if (mode === "replace" && tablesModifiedInPlace && hasMixedContent) {
        try {
          var mixSelRange = doc.GetRangeBySelect();
          if (mixSelRange) {
            var mixParas = mixSelRange.GetAllParagraphs();
            // Collect non-table paragraphs
            var nonTableParas = [];
            for (var mpi = 0; mpi < mixParas.length; mpi++) {
              var mpRange = mixParas[mpi].GetRange ? mixParas[mpi].GetRange() : null;
              var mpStart = mpRange ? mpRange.GetStartPos() : -1;
              var mpInTable = false;
              for (var mti = 0; mti < allTables.length; mti++) {
                var mtRange = allTables[mti].GetRange();
                if (mtRange && mpStart >= mtRange.GetStartPos() && mpStart <= mtRange.GetEndPos()) {
                  mpInTable = true;
                  break;
                }
              }
              if (!mpInTable) nonTableParas.push(mixParas[mpi]);
            }
            if (nonTableParas.length > 0) {
              // Match non-table paragraphs to non-table-placeholder blocks (forward)
              var paraBlockPairs = [];
              var mixBlockIdx = 0;
              for (var ntpi = 0; ntpi < nonTableParas.length; ntpi++) {
                while (mixBlockIdx < blocks.length) {
                  var mbRuns = blocks[mixBlockIdx].runs || [];
                  var mbText = "";
                  for (var mbj = 0; mbj < mbRuns.length; mbj++) { mbText += mbRuns[mbj].text || ""; }
                  if (mbText.indexOf("SCRIBE-TABLE-") === -1) break;
                  mixBlockIdx++;
                }
                if (mixBlockIdx >= blocks.length) break;
                paraBlockPairs.push({ para: nonTableParas[ntpi], block: blocks[mixBlockIdx] });
                mixBlockIdx++;
              }

              // Process in REVERSE order to avoid position shifts
              var origStart = mixSelRange.GetStartPos();
              var origEnd = mixSelRange.GetEndPos();
              for (var pbpi = paraBlockPairs.length - 1; pbpi >= 0; pbpi--) {
                var pbPara = paraBlockPairs[pbpi].para;
                var pbBlock = paraBlockPairs[pbpi].block;
                var pbRange = pbPara.GetRange ? pbPara.GetRange() : null;
                if (!pbRange) continue;
                var pbStart = pbRange.GetStartPos();
                var pbEnd = pbRange.GetEndPos();

                // Clip selection to this paragraph's range
                var selPStart = (origStart > pbStart) ? origStart : pbStart;
                var selPEnd = (origEnd < pbEnd) ? origEnd : pbEnd;

                // Select the paragraph's selected portion
                var selPRange = doc.GetRange(selPStart, selPEnd);
                if (selPRange) selPRange.Select();

                // Build content and InsertContent (same mechanism as non-table case)
                var pbParagraph = Api.CreateParagraph();
                addBlockToParagraph(pbParagraph, pbBlock, srcFontFamily, srcFontSize);
                doc.InsertContent([pbParagraph], true); // inline mode: preserves suffix

                // Save the narrowed selection bounds for post-selection.
                // selPStart is still valid (within the just-modified paragraph).
                // For the combined range, the cell bounds (computed in post-selection)
                // provide the table portion — min/max naturally picks the right bounds.
              }
              skipContentAndInsert = true;
            }
          }
        } catch (e) {
          // In-place failed — fall through to normal content building
        }
      }

      var content = [];
      if (!skipContentAndInsert)
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
            if (tableClones[plIdx] === null) {
              // Partial table in Replace mode — already modified in-place, skip placeholder
              continue;
            }
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
        // For Replace with mixed content + partial table modified in-place:
        // modify non-table paragraphs in-place too (no InsertContent at all).
        // This avoids InsertContent destroying the table rows.

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

        // §5bis: after a BLOCK InsertContent, OO splits the host ¶ at the insertion
        // point and the right remainder becomes a trailing paragraph. Remove it ONLY
        // if it is EMPTY (insertion at the host's start/end) so no empty ¶ is left at
        // the edges. If it is NON-EMPTY (insertion at a true middle), KEEP it as-is —
        // that is the host split whose right half keeps the host ¶ style AND its own
        // run formatting. (The previous replace path rebuilt it from plain GetText(),
        // which dropped bold/italic and leaked a trailing \r.)
        function cleanupTrailingBlockPara() {
          try {
            var lastContentPara = content[content.length - 1];
            var lcRange = lastContentPara && lastContentPara.GetRange ? lastContentPara.GetRange() : null;
            if (!lcRange) return;
            var lcEndPos = lcRange.GetEndPos();
            var total = doc.GetElementsCount();
            for (var si = 0; si < total; si++) {
              var scanEl = doc.GetElement(si);
              var scanRange = scanEl && scanEl.GetRange ? scanEl.GetRange() : null;
              if (scanRange && scanRange.GetStartPos() >= lcEndPos) {
                var trailText = (scanRange.GetText() || "").replace(/[\r\n]+$/, "");
                if (trailText.length === 0) {
                  doc.RemoveElement(si); // empty right half -> no ¶ vide at the edge
                } else if (hostStyle && scanEl.SetStyle) {
                  scanEl.SetStyle(hostStyle); // §5bis split invariant: right half keeps host ¶ style
                }
                break;
              }
            }
          } catch (e) {}
        }

        // §5bis Cas A: when the 1st injected para is PLAIN (no md style), it merges
        // inline into the host's LEFT split half. Give that first content paragraph
        // the HOST ¶ style up front, so after OO's merge the left half keeps the host
        // style (OO would otherwise stamp the para's default Normal style on it).
        // Cas B (1st para has its own md style — heading/list/quote/code) is left
        // untouched: it stays a block with its own style.
        function applyHostStyleToFirstParaIfPlain() {
          try {
            if (hostStyle && blocks[0] && blocks[0].type === "paragraph"
                && content[0] && content[0].SetStyle && content[0].GetClassType
                && content[0].GetClassType() === "paragraph") {
              content[0].SetStyle(hostStyle);
            }
          } catch (e) {}
        }

        // §5bis Cas B: does the 1st injected block carry its own paragraph-level
        // md style (heading / list / quote / fenced code)? Character formatting
        // (bold/italic/…) does NOT count — a bold plain paragraph stays "plain".
        // Tables / images are standalone blocks and never merge into the host, so
        // they don't need the spacer trick.
        function blockHasParaStyle(b) {
          if (!b) return false;
          if (b.type === "heading" || b.type === "list_item" || b.type === "code_block") return true;
          if (b.type === "paragraph" && b.blockquote) return true;
          return false;
        }
        firstBlockStyled = blockHasParaStyle(blocks[0]);

        // §5bis Cas B: prepend a host-styled EMPTY paragraph so OO's block
        // InsertContent merges *it* (empty) into the host's left split half — the
        // merged half then keeps the HOST style (OO stamps content[0]'s style on the
        // merge target), and the real styled 1st block stays a separate ¶. Mutually
        // exclusive with the Cas A inline-style fix.
        function prepareFirstBlockForMerge() {
          if (firstBlockStyled) {
            try {
              var sp = Api.CreateParagraph();
              if (hostStyle && sp.SetStyle) sp.SetStyle(hostStyle);
              content.unshift(sp);
              leadSpacerInserted = true;
            } catch (e) {}
          } else {
            applyHostStyleToFirstParaIfPlain(); // §5bis Cas A
          }
        }

        // §5bis Cas B: after the block insert, drop the leading host-styled spacer
        // IF it ended up empty. Two shapes are possible and both resolve correctly:
        //  - spacer merged into a non-empty host left half → element before the 1st
        //    real block is that non-empty half → KEEP it.
        //  - spacer left as a standalone empty ¶ (no merge), or merged into an empty
        //    left half (@start insertion) → element before the 1st real block is
        //    empty → REMOVE it (no ¶ vide at the edge, §5bis).
        function cleanupLeadingSpacer() {
          try {
            var firstReal = content[1]; // content[0] is the spacer
            var frRange = firstReal && firstReal.GetRange ? firstReal.GetRange() : null;
            if (!frRange) return;
            var frStart = frRange.GetStartPos();
            var total = doc.GetElementsCount();
            var prevIdx = -1;
            for (var i = 0; i < total; i++) {
              var el = doc.GetElement(i);
              var r = el && el.GetRange ? el.GetRange() : null;
              if (!r) continue;
              if (r.GetStartPos() >= frStart) break;
              prevIdx = i; // last element starting before the 1st real block
            }
            if (prevIdx >= 0) {
              var prevEl = doc.GetElement(prevIdx);
              var pr = prevEl && prevEl.GetRange ? prevEl.GetRange() : null;
              var ptext = pr ? (pr.GetText() || "").replace(/[\r\n]+$/, "") : "";
              if (ptext.length === 0) doc.RemoveElement(prevIdx);
            }
          } catch (e) {}
        }

        if (mode === "insert") {
          // For table selections: move cursor after the table so InsertContent
          // places content after the table, not inside the last cell.
          if (parsedTables.length > 0) {
            try {
              for (var itp = parsedTables.length - 1; itp >= 0; itp--) {
                var itpDocIdx = tableDocIndices[parsedTables[itp].index];
                var itpTable = (itpDocIdx !== undefined && itpDocIdx < allTables.length) ? allTables[itpDocIdx] : null;
                if (itpTable) {
                  var itpRange = itpTable.GetRange();
                  if (itpRange) {
                    var afterPos = itpRange.GetEndPos() + 1;
                    var afterRange = doc.GetRange(afterPos, afterPos);
                    if (afterRange) afterRange.Select();
                    break;
                  }
                }
              }
            } catch (e) {
              // Cursor repositioning failed — InsertContent will use current position
            }
          }
          // §5bis: single plain paragraph -> INLINE (runs spliced into the host ¶,
          // which keeps its paragraph style); multi-¶ / styled / non-text -> BLOCK.
          // No leading empty paragraph any more (that was the L#7 bug).
          var insSimpleInline = (content.length === 1 && blocks.length === 1 && blocks[0].type === "paragraph");
          if (insSimpleInline) {
            doc.InsertContent(content, true);
            // useRefSelection stays false -> position-based selection (like inline replace)
          } else {
            prepareFirstBlockForMerge(); // §5bis: Cas A inline-style OR Cas B spacer
            doc.InsertContent(content);
            useRefSelection = true;
            cleanupTrailingBlockPara(); // §5bis: drop empty trailing ¶, keep a real split
            if (leadSpacerInserted) cleanupLeadingSpacer(); // §5bis Cas B
          }

          // Post-InsertContent: remove unselected rows/columns from inserted tables.
          // Uses the clone reference directly (now in the document after InsertContent).
          for (var ptr = 0; ptr < pendingTableReductions.length; ptr++) {
            try {
              var reduction = pendingTableReductions[ptr];
              var redTable = reduction.clone;
              var redSelRows = {};
              var redSelCols = {};
              for (var rsc = 0; rsc < reduction.selectedCellCoords.length; rsc++) {
                redSelRows[reduction.selectedCellCoords[rsc].r] = true;
                redSelCols[reduction.selectedCellCoords[rsc].c] = true;
              }
              // Remove unselected rows (reverse order to preserve indices)
              // OO API: RemoveRow(oCell) takes a cell reference, not an index
              var redRowCount = redTable.GetRowsCount();
              for (var rrr = redRowCount - 1; rrr >= 0; rrr--) {
                if (!redSelRows[rrr]) {
                  var rrCell = redTable.GetCell(rrr, 0);
                  if (rrCell) redTable.RemoveRow(rrCell);
                }
              }
              // Remove unselected columns (reverse order)
              var redFirstRow = redTable.GetRow(0);
              if (redFirstRow) {
                var redColCount = redFirstRow.GetCellsCount();
                for (var rccc = redColCount - 1; rccc >= 0; rccc--) {
                  if (!redSelCols[rccc]) {
                    var rcCell = redTable.GetCell(0, rccc);
                    if (rcCell) redTable.RemoveColumn(rcCell);
                  }
                }
              }
            } catch (e) {
              // Table reduction failed — table keeps all rows/columns
            }
          }
        } else {
          // Replace mode
          var isSimpleInline = (content.length === 1 && blocks.length === 1 && blocks[0].type === "paragraph");
          if (isSimpleInline) {
            // Single paragraph: inline mode merges into existing paragraph
            doc.InsertContent(content, true);
          } else {
            // Multi-paragraph: block mode to keep paragraph separation. OO splits
            // the host ¶ at the (collapsed, post-delete) selection point; the right
            // remainder becomes a trailing ¶. §5bis: drop it only if empty (edge
            // insertion), else KEEP it — that is the split's right half, preserving
            // the host style AND the suffix's own run formatting (no plain-text
            // rebuild, no leaked \r).
            prepareFirstBlockForMerge(); // §5bis: Cas A inline-style OR Cas B spacer
            doc.InsertContent(content);
            useRefSelection = true; // block mode preserves paragraph refs
            cleanupTrailingBlockPara();
            if (leadSpacerInserted) cleanupLeadingSpacer(); // §5bis Cas B
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
          // First real content paragraph (block mode, both insert and replace).
          // §5bis Cas B unshifts a host-styled spacer at content[0] (absorbed into
          // the host's left half), so the first *real* block is content[1] then.
          var selectFirst = leadSpacerInserted ? content[1] : content[0];
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

        // ── Post-selection: recreate footnotes ──
        // Done AFTER selection to avoid disrupting cursor/selection state.
        // processPendingFootnotes uses Select() + AddFootnote() which move the cursor.
        if (pendingFootnotes.length > 0) {
          processPendingFootnotes();
        }
      }

      // Post-operation: select all modified content for partial table Replace.
      // Covers both table cells (modified in-place) and text paragraphs (mixed content).
      if (mode === "replace" && partialTableInfo) {
        try {
          var postSelStart = -1;
          var postSelEnd = -1;

          // Only compute cell bounds for non-mixed (pure table) Replace.
          if (!skipContentAndInsert) {
          var postAllTables = doc.GetAllTables();
          for (var ptSelIdx in partialTableInfo) {
            if (!partialTableInfo.hasOwnProperty(ptSelIdx)) continue;
            var ptSelCells = partialTableInfo[ptSelIdx];
            if (ptSelCells.length === 0) continue;
            var ptSelDocIdx = tableDocIndices[parseInt(ptSelIdx)];
            var ptSelTable = (ptSelDocIdx !== undefined && ptSelDocIdx < postAllTables.length) ? postAllTables[ptSelDocIdx] : null;
            if (!ptSelTable) continue;
            var minR = ptSelCells[0].r, maxR = ptSelCells[0].r;
            var minC = ptSelCells[0].c, maxC = ptSelCells[0].c;
            for (var psi = 1; psi < ptSelCells.length; psi++) {
              if (ptSelCells[psi].r < minR) minR = ptSelCells[psi].r;
              if (ptSelCells[psi].r > maxR) maxR = ptSelCells[psi].r;
              if (ptSelCells[psi].c < minC) minC = ptSelCells[psi].c;
              if (ptSelCells[psi].c > maxC) maxC = ptSelCells[psi].c;
            }
            var topLeftCell = ptSelTable.GetCell(minR, minC);
            var botRightCell = ptSelTable.GetCell(maxR, maxC);
            if (topLeftCell && botRightCell) {
              var tlContent = topLeftCell.GetContent();
              var brContent = botRightCell.GetContent();
              if (tlContent && tlContent.GetElementsCount() > 0 && brContent && brContent.GetElementsCount() > 0) {
                var tlPara = tlContent.GetElement(0);
                var brPara = brContent.GetElement(brContent.GetElementsCount() - 1);
                var tlRange = tlPara ? tlPara.GetRange() : null;
                var brRange = brPara ? brPara.GetRange() : null;
                if (tlRange) {
                  var tlPos = tlRange.GetStartPos();
                  if (postSelStart === -1 || tlPos < postSelStart) postSelStart = tlPos;
                }
                if (brRange) {
                  var brPos = brRange.GetEndPos();
                  if (brPos > postSelEnd) postSelEnd = brPos;
                }
              }
            }
            break;
          }
          } // end if (!skipContentAndInsert)

          // Select the modified cell range (pure table Replace only).
          // For mixed content Replace (skipContentAndInsert), post-selection is skipped
          // because OO's selection API can't select partial table + text cross-boundary.
          if (!skipContentAndInsert && postSelStart >= 0 && postSelEnd > postSelStart) {
            var postRange = doc.GetRange(postSelStart, postSelEnd);
            if (postRange) postRange.Select();
          }
        } catch (e) {
          // Selection failed — not critical, document content is correct
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
      // Store partialTableInfo and tableSnapshots from React respond() — authoritative copy
      if (msg.data && msg.data.partialTableInfo) {
        lastPartialTableInfo = msg.data.partialTableInfo;
      }
      if (msg.data && msg.data.tableSnapshots) {
        lastTableSnapshots = msg.data.tableSnapshots;
      }
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

  // ---- PANEL_ACTION listener (host -> plugin, one-way) ----
  // The Scribe side panel sends PANEL_ACTION cozy-bridge:intent messages when
  // the user clicks Replace/Insert on an AI chat message. Unlike the response
  // path, there is no pending intent to look up — the payload carries the
  // action and text directly, and we route it through the same
  // handleIntentResponse function used by the inline popover flow so both
  // paths produce identical document modifications (smart spacing, Builder
  // API, PasteHtml fallback, etc.).
  window.addEventListener("message", function(event) {
    var msg = event.data;
    if (!msg || msg.type !== "cozy-bridge:intent" || msg.version !== 1) return;
    if (msg.action !== "PANEL_ACTION") return;

    var panelData = msg.data || {};
    var subAction = panelData.action;
    if (subAction !== "replace" && subAction !== "insert") {
      log("PANEL_ACTION ignored -- unknown sub-action: " + subAction);
      return;
    }

    log("PANEL_ACTION received: " + subAction);
    // Synthesize a response-shaped msg for handleIntentResponse. It only
    // reads .action and .data, so this is a faithful reuse with zero
    // behavioral drift from the inline popover path.
    handleIntentResponse({
      action: subAction,
      data: {
        text: panelData.text || "",
        html: panelData.html || null,
        md: panelData.md || null,
        partialTableInfo: panelData.partialTableInfo || null,
        tableSnapshots: panelData.tableSnapshots || null
      }
    });
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

  // ---- Selection subscription (host tells plugin when to send SELECTION_CHANGED) ----
  // initOnSelectionChanged (config.json) makes OO call init() only when a
  // NON-EMPTY selection changes. That leaves two gaps the side panel must cover:
  //   #2 When the panel opens, OO won't re-fire init() for an already-present
  //      selection — so on subscribe we call init() once to extract+push it.
  //   #3 When the selection collapses to a bare cursor (empty), OO never fires
  //      init() — so a light read-only poll detects the non-empty -> empty
  //      transition and pushes an empty SELECTION_CHANGED to clear the panel.
  // A previous GetSelectedText poll was ruled out as the cause of the panel
  // focus-steal bug (removing it didn't fix it), so this read-only poll is
  // considered focus-safe; it never writes to the document.
  var selectionSubscribed = false;
  var selectionPollTimer = null;
  var lastPolledNonEmpty = false;

  function castEmptySelection() {
    lastSelectedText = "";
    lastEnrichedMd = "";
    lastTableSnapshots = null;
    lastTableAmbiguity = null;
    lastPartialTableInfo = null;
    lastSelectedHtml = "";
    castIntent("SELECTION_CHANGED", { text: "", html: null }, true);
  }

  function pollSelectionForClear() {
    try {
      window.Asc.plugin.executeMethod("GetSelectedText", [], function(txt) {
        var isEmpty = !txt || txt.length === 0;
        if (isEmpty) {
          // Only act on the non-empty -> empty transition; init() handles
          // non-empty selection changes (with full enriched extraction).
          if (lastPolledNonEmpty) {
            lastPolledNonEmpty = false;
            castEmptySelection();
          }
        } else {
          lastPolledNonEmpty = true;
        }
      });
    } catch (e) {
      // ignore transient API errors
    }
  }

  function startSelectionPoll() {
    if (selectionPollTimer) return;
    selectionPollTimer = setInterval(pollSelectionForClear, 400);
  }

  function stopSelectionPoll() {
    if (selectionPollTimer) {
      clearInterval(selectionPollTimer);
      selectionPollTimer = null;
    }
  }

  window.addEventListener("message", function(event) {
    var msg = event.data;
    if (!msg || msg.type !== "cozy-bridge:selection-subscribe") return;
    selectionSubscribed = !!msg.subscribe;
    log("Selection subscribe: " + selectionSubscribed);
    if (selectionSubscribed) {
      // #2: push the current selection now — init() won't re-fire just because
      // we subscribed. Guard with GetSelectedText first: init()'s extraction
      // returns the WHOLE paragraph when the selection is empty (a bare
      // cursor), so for an empty selection we send an explicit clear instead.
      lastPolledNonEmpty = false;
      try {
        window.Asc.plugin.executeMethod("GetSelectedText", [], function(txt) {
          if (txt && txt.length > 0) {
            lastPolledNonEmpty = true;
            window.Asc.plugin.init({});
          } else {
            castEmptySelection();
          }
        });
      } catch (e) { /* API not ready */ }
      startSelectionPoll();
    } else {
      stopSelectionPoll();
    }
  });

  // Tell the host we're ready to receive the subscribe state. If the panel was
  // already open at page load, the host's initial selection-subscribe broadcast
  // may have fired before this plugin iframe existed (message lost). Announcing
  // readiness lets the host re-send it so selections sync from the start.
  function announceReady() {
    postToAncestors({ type: "cozy-bridge:plugin-ready" });
  }
  announceReady();

  // ---- Selection detection (via init) ----
  // OO calls init with the selected text/HTML when a selection changes.
  var toolbarButtonAdded = false;
  // Timestamp until which init()'s extraction is suppressed. Set when an
  // undo/redo is invoked (keyboard or toolbar button — see suppressExtraction):
  // the selection change that an undo/redo causes re-triggers init(), and ANY
  // callCommand("command") below — even one that makes no document change —
  // truncates OO's redo stack, breaking redo.
  var suppressExtractionUntil = 0;

  window.Asc.plugin.init = function(data) {
    log("init() — build " + SCRIBE_BUILD);
    // Ignore init calls triggered by our own paste operations
    if (pasteInProgress) {
      log("init() called (ignored — paste in progress)");
      return;
    }
    // Add toolbar button on first init (API is ready at this point)
    if (!toolbarButtonAdded) {
      addToolbarButton();
      toolbarButtonAdded = true;
      // Re-announce readiness now that OO has fully initialized the plugin, in
      // case the module-load announce raced ahead of the host's listener.
      announceReady();
    }

    // Skip the heavy extraction right after an undo/redo so its callCommand
    // doesn't wipe the redo stack (which would make redo impossible). The cache
    // stays as-is and self-refreshes on the next real selection change.
    if (Date.now() < suppressExtractionUntil) {
      log("init() extraction suppressed (undo/redo in progress)");
      return;
    }

    // Run callCommand pre-scan to extract enriched markdown from selection
    // initDataType:"html" is kept for trigger mechanism; data parameter is ignored
    // Pass counters via Asc.scope for stable naming across selections
    window.Asc.scope.imgCounter = imageCounter;
    window.Asc.scope._fnCounter = footnoteCounter;
    window.Asc.scope._crCounter = crossRefCounter;
    window.Asc.scope._crMeta = {};
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

      // ── Self-contained segment strategy for markdown emission ──
      //
      // OO documents have overlapping formatting spans (e.g. bold crossing an
      // underline boundary). Markdown requires strict nesting. The previous
      // approach tried to track open/close state across segment boundaries,
      // which led to ambiguous marker sequences like "***" or stray "*".
      //
      // New approach: each segment (= run with a constant format set) is
      // **fully self-contained** — all markers are opened and closed within
      // the segment. No marker ever crosses a segment boundary.
      //
      // Nesting order (outermost → innermost):
      //   <u> → [link](url) → ~~ → ** → * → `
      //
      // Trade-offs accepted:
      //   - Adjacent </u><u> — renders identically in OO (contiguous underline)
      //   - Adjacent [a](url)[b](url) — same-URL links merge visually in OO
      //   - Slightly more verbose markdown — but unambiguous and LLM-friendly
      //
      // CommonMark whitespace rule: opening ** / * must not be followed by
      // whitespace. We move leading/trailing whitespace outside the markers
      // but keep it inside <u> and [...] so spacing is preserved.
      function buildMarkdownFromParts(parts) {
        var result = "";

        for (var i = 0; i < parts.length; i++) {
          var part = parts[i];

          // Raw parts (image markers) — emit as-is
          if (part.raw) {
            result += part.text;
            continue;
          }

          if (!part.text || part.text.length === 0) continue;

          var text = part.text;
          var wantBold = !!part.bold;
          var wantItalic = !!part.italic;
          var wantStrike = !!part.strikethrough;
          var wantCode = !!part.code;
          var wantUnderline = !!part.underline;
          var link = part.link || null;
          var hasEmphasis = wantBold || wantItalic || wantStrike || wantCode;

          // ── Whitespace extraction ──
          // Move leading/trailing whitespace outside emphasis markers (** * ~~ `)
          // but keep it inside <u> and [link] so underline/link span is preserved.
          var leadingWS = "";
          var trailingWS = "";
          if (hasEmphasis && !wantCode) {
            var lm = text.match(/^(\s+)/);
            if (lm && lm[1].length < text.length) {
              leadingWS = lm[1];
              text = text.substring(leadingWS.length);
            }
            var tm = text.match(/(\s+)$/);
            if (tm && tm[1].length < text.length) {
              trailingWS = tm[1];
              text = text.substring(0, text.length - trailingWS.length);
            }
          }

          // If text is all whitespace, emit directly (no markers needed)
          if (text.length === 0) {
            result += part.text;
            continue;
          }

          // ── Build segment string ──
          var seg = "";

          // Open outer markers
          if (wantUnderline) seg += "<u>";
          if (link) seg += "[";

          // Leading whitespace (inside <u>/link, outside emphasis)
          seg += leadingWS;

          // Open emphasis markers (outermost → innermost)
          if (wantStrike) seg += "~~";
          if (wantBold) seg += "**";
          if (wantItalic) seg += "*";
          if (wantCode) seg += "`";

          // Emit text content
          if (wantCode || link) {
            seg += link ? escapeMarkdown(text) : text;
          } else {
            seg += escapeMarkdown(text);
          }

          // Close emphasis markers (innermost → outermost)
          if (wantCode) seg += "`";
          if (wantItalic) seg += "*";
          if (wantBold) seg += "**";
          if (wantStrike) seg += "~~";

          // Trailing whitespace (inside <u>/link, outside emphasis)
          seg += trailingWS;

          // Close outer markers
          if (link) seg += "](" + link + ")";
          if (wantUnderline) seg += "</u>";

          result += seg;
        }

        return result;
      }

      function paragraphToMarkdown(para, clipStartChars, clipEndChars) {
        clipStartChars = clipStartChars || 0;
        clipEndChars = clipEndChars || 0;
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
            // Cross-reference detection: hyperlinks with empty GetLinkedText are cross-refs
            if (!hUrl || hUrl.length === 0) {
              var crDisplayed = el.GetDisplayedText ? el.GetDisplayedText() : "";
              var crScreenTip = el.GetScreenTipText ? el.GetScreenTipText() : "";
              // Trim trailing whitespace/newlines from screenTip (OO sometimes appends \n)
              crScreenTip = crScreenTip.replace(/[\s\n\r]+$/, "");
              if (crDisplayed) {
                var crName = "scribe-ref-" + Asc.scope._crCounter;
                Asc.scope._crCounter = (Asc.scope._crCounter || 0) + 1;
                // Determine cross-ref type from screenTip
                var crType = "unknown";
                if (crScreenTip.indexOf("#_") === 0) {
                  crType = "heading";
                } else if (crScreenTip.length > 0) {
                  crType = "bookmark";
                }
                // Capture ToJSON for full cross-ref recreation (includes anchor field)
                var crJson = null;
                try { crJson = el.ToJSON(); } catch (e) {}
                // Store metadata for injection
                if (!Asc.scope._crMeta) Asc.scope._crMeta = {};
                Asc.scope._crMeta[crName] = {
                  type: crType, screenTip: crScreenTip, displayedText: crDisplayed,
                  json: crJson
                };
                annotatedParts.push({ text: "{{REF:" + crName + ":" + crDisplayed + "}}", raw: true });
              }
              continue;
            }
            // Regular hyperlink — collect display text and formatting from child runs
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
              // Check for footnote reference mark (style "footnote reference", empty text)
              try {
                var fnStyle = el.GetStyle ? el.GetStyle() : null;
                if (fnStyle && typeof fnStyle === "object" && fnStyle.GetName) {
                  var fnStyleName = fnStyle.GetName();
                  if (fnStyleName === "footnote reference") {
                    var fnName = "scribe-fn-" + (Asc.scope._fnCounter || 0);
                    Asc.scope._fnCounter = (Asc.scope._fnCounter || 0) + 1;
                    annotatedParts.push({ text: "[^" + fnName + "]", raw: true });
                    continue;
                  }
                }
              } catch (eFn) { /* style check failed — not a footnote ref */ }
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

        // Clip annotated parts to selection bounds if needed
        if (clipStartChars > 0 || clipEndChars > 0) {
          var totalLen = 0;
          for (var cl = 0; cl < annotatedParts.length; cl++) {
            totalLen += (annotatedParts[cl].text || "").length;
          }
          var keepFrom = clipStartChars;
          var keepTo = totalLen - clipEndChars;
          if (keepFrom > 0 || keepTo < totalLen) {
            var clipped = [];
            var cPos = 0;
            for (var ci = 0; ci < annotatedParts.length; ci++) {
              var cText = annotatedParts[ci].text || "";
              var cPartStart = cPos;
              var cPartEnd = cPos + cText.length;
              cPos = cPartEnd;
              if (cPartEnd <= keepFrom) continue;
              if (cPartStart >= keepTo) continue;
              var cFrom = keepFrom > cPartStart ? keepFrom - cPartStart : 0;
              var cTo = keepTo < cPartEnd ? keepTo - cPartStart : cText.length;
              var cClipped = cText.substring(cFrom, cTo);
              if (cClipped.length > 0) {
                var cPart = {};
                for (var ck in annotatedParts[ci]) {
                  if (annotatedParts[ci].hasOwnProperty(ck)) cPart[ck] = annotatedParts[ci][ck];
                }
                cPart.text = cClipped;
                clipped.push(cPart);
              }
            }
            annotatedParts = clipped;
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

      // --- Partial table selection analysis (TBL-01) ---
      // Returns: { full, selectedCells, ambiguous, reason, intraCell }
      // Uses paragraph-to-cell mapping via GetParentTableCell() instead of
      // position-based overlap, because positions are sequential in the document
      // and can't distinguish column selections from row selections.
      function analyzeTableSelection(table, selStart, selEnd, paragraphs) {
        var tblRange = table.GetRange();
        if (!tblRange) return { full: false, selectedCells: [], ambiguous: true, reason: "no_range" };
        var tblStart = tblRange.GetStartPos();
        var tblEnd = tblRange.GetEndPos();
        var rowCount = table.GetRowsCount();

        // Count total non-empty cells in the table
        var totalNonEmptyCells = 0;
        for (var r = 0; r < rowCount; r++) {
          var row = table.GetRow(r);
          for (var c = 0; c < row.GetCellsCount(); c++) {
            var cell = table.GetCell(r, c);
            if (!cell) continue;
            var content = cell.GetContent();
            if (content && content.GetElementsCount() > 0) totalNonEmptyCells++;
          }
        }

        // Build set of cells that have paragraphs in the selection
        // using GetParentTableCell() — this is the ground truth of what's selected
        var hitCells = {}; // "r,c" → {r, c}
        var hitCount = 0;
        for (var pi = 0; pi < paragraphs.length; pi++) {
          var pRange = paragraphs[pi].GetRange ? paragraphs[pi].GetRange() : null;
          if (!pRange) continue;
          var pPos = pRange.GetStartPos();
          // Only consider paragraphs within this table's range
          if (pPos < tblStart || pPos > tblEnd) continue;
          var parentCell = paragraphs[pi].GetParentTableCell ? paragraphs[pi].GetParentTableCell() : null;
          if (!parentCell) continue;
          var cellR = parentCell.GetRowIndex ? parentCell.GetRowIndex() : -1;
          var cellC = parentCell.GetIndex ? parentCell.GetIndex() : -1;
          if (cellR >= 0 && cellC >= 0) {
            var key = cellR + "," + cellC;
            if (!hitCells[key]) {
              hitCells[key] = { r: cellR, c: cellC };
              hitCount++;
            }
          }
        }

        // Intra-cell: only 1 cell has paragraphs in the selection
        if (hitCount <= 1) {
          if (hitCount === 0) {
            return { full: false, selectedCells: [], ambiguous: true, reason: "no_cell_match" };
          }
          return { full: false, selectedCells: [], ambiguous: false, reason: "intra_cell", intraCell: true };
        }

        // Full table: all non-empty cells have paragraphs in the selection.
        // For Replace: in-place modification works regardless (full or partial).
        // For Insert: clone+InsertContent needs the table structure in the selection,
        // but we return full:true here and let the Insert path handle it.
        if (hitCount >= totalNonEmptyCells) {
          return { full: true, selectedCells: [], ambiguous: false, reason: null };
        }

        // Partial table: some cells selected
        var selectedCells = [];
        for (var hk in hitCells) {
          if (hitCells.hasOwnProperty(hk)) {
            selectedCells.push(hitCells[hk]);
          }
        }

        // Include empty cells whose row has at least one selected cell
        var selectedRowSet = {};
        for (var si = 0; si < selectedCells.length; si++) {
          selectedRowSet[selectedCells[si].r] = true;
        }
        for (var r2 = 0; r2 < rowCount; r2++) {
          if (!selectedRowSet[r2]) continue;
          var row2 = table.GetRow(r2);
          var cellCount2 = row2.GetCellsCount();
          for (var c2 = 0; c2 < cellCount2; c2++) {
            var key2 = r2 + "," + c2;
            if (hitCells[key2]) continue; // already counted
            var emptyCell = table.GetCell(r2, c2);
            if (emptyCell) {
              var ec = emptyCell.GetContent();
              if (!ec || ec.GetElementsCount() === 0) {
                selectedCells.push({ r: r2, c: c2 });
              }
            }
          }
        }

        // Sort selectedCells by row then column for consistent ordering
        selectedCells.sort(function(a, b) { return a.r !== b.r ? a.r - b.r : a.c - b.c; });
        return { full: false, selectedCells: selectedCells, ambiguous: false, reason: null };
      }

      // --- Partial table cell extraction (TBL-01) ---
      // Extract the markdown content of a single cell (all paragraphs joined by \n\n).
      function extractCellContent(cell) {
        var content = cell.GetContent();
        var cellText = "";
        var elemCount = content ? content.GetElementsCount() : 0;
        for (var e = 0; e < elemCount; e++) {
          var elem = content.GetElement(e);
          if (elem.GetClassType && elem.GetClassType() === "paragraph") {
            // Use getDrawingMarker to assign scribe-img-* names to unnamed drawings
            // and detect block images (paragraph with only drawings, no text)
            var imgMarker = getDrawingMarker(elem);
            var paraMd;
            if (imgMarker && imgMarker.isBlock) {
              paraMd = imgMarker.md;
            } else {
              paraMd = paragraphToMarkdown(elem);
            }
            if (cellText.length > 0) cellText = cellText + "\n\n";
            cellText = cellText + paraMd;
          }
        }
        return cellText;
      }

      function extractPartialTableCells(table, selectedCells) {
        var cellMd = [];
        for (var i = 0; i < selectedCells.length; i++) {
          var sc = selectedCells[i];
          var cell = table.GetCell(sc.r, sc.c);
          if (!cell) continue;
          cellMd.push("[CELL:" + sc.r + "," + sc.c + "]" + extractCellContent(cell) + "[/CELL]");
        }
        return cellMd.join("\n");
      }

      // --- Table cell extraction helper (MARK-02) ---
      // Extracts all cells — delegates to extractPartialTableCells with full cell list.
      function extractTableCells(table) {
        var allCells = [];
        var rowCount = table.GetRowsCount();
        for (var r = 0; r < rowCount; r++) {
          var row = table.GetRow(r);
          for (var c = 0; c < row.GetCellsCount(); c++) {
            allCells.push({ r: r, c: c });
          }
        }
        return extractPartialTableCells(table, allCells);
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
      var tableSnapshots = [];   // tableSnapshots[tableIndex] = ToJSON(true,true) lossless snapshot
      var tableAmbiguity = null;
      var partialTableInfo = null;
      for (var p = 0; p < paragraphs.length; p++) {
        var para = paragraphs[p];
        var paraRange = para.GetRange();
        var pStart = paraRange ? paraRange.GetStartPos() : -1;

        // Check if this paragraph is inside a table
        var insideTable = false;
        for (var ti = 0; ti < tableRanges.length; ti++) {
          if (pStart >= tableRanges[ti].start && pStart <= tableRanges[ti].end) {
            // Analyze the table selection on first encounter
            if (!tableRanges[ti].emitted) {
              tableRanges[ti].emitted = true;
              if (!tableRanges[ti].analysis) {
                tableRanges[ti].analysis = analyzeTableSelection(tableRanges[ti].table, selStart, selEnd, paragraphs);
              }
              var analysis = tableRanges[ti].analysis;
              if (analysis.intraCell) {
                // Case 1: intra-cell — let paragraphs fall through to normal
                // paragraph extraction (same code path as non-table text)
                tableRanges[ti].isIntraCell = true;
                // insideTable stays false → this paragraph goes through paragraphToMarkdown
              } else if (analysis.ambiguous) {
                // Store ambiguity info for the result
                insideTable = true;
                if (!tableAmbiguity) {
                  tableAmbiguity = {
                    type: analysis.reason,
                    message: "La selection coupe un tableau de maniere ambigue. Selectionnez des lignes completes du tableau."
                  };
                }
              } else if (analysis.full) {
                // Full table — existing behavior
                insideTable = true;
                var tableCellsMd = extractTableCells(tableRanges[ti].table);
                mdParts.push({ md: "[TABLE:" + tableIndex + "]\n" + tableCellsMd + "\n[/TABLE]", isList: false });
                tableDocIndices.push(tableRanges[ti].docIndex);
                // Capture lossless table snapshot via ToJSON (borders, bg, merges, fonts, images)
                try {
                  tableSnapshots.push(tableRanges[ti].table.ToJSON(true, true));
                } catch (snapErr) {
                  tableSnapshots.push(null);
                }
                tableIndex = tableIndex + 1;
              } else {
                // Partial table — extract only selected cells
                insideTable = true;
                var partialCellsMd = extractPartialTableCells(tableRanges[ti].table, analysis.selectedCells);
                mdParts.push({ md: "[TABLE:" + tableIndex + "]\n" + partialCellsMd + "\n[/TABLE]", isList: false });
                tableDocIndices.push(tableRanges[ti].docIndex);
                // Capture FULL table snapshot even for partial selection —
                // unmodified cells retain original content from the snapshot
                try {
                  tableSnapshots.push(tableRanges[ti].table.ToJSON(true, true));
                } catch (snapErr) {
                  tableSnapshots.push(null);
                }
                if (!partialTableInfo) partialTableInfo = {};
                partialTableInfo[tableIndex] = analysis.selectedCells;
                tableIndex = tableIndex + 1;
              }
            } else {
              // Already emitted — check if intra-cell (paragraphs within selection fall through)
              if (tableRanges[ti].isIntraCell) {
                // Intra-cell: paragraphs within the selection fall through to normal handling
                // Paragraphs outside the selection are skipped (they belong to other cells)
                if (pStart < selStart || pStart > selEnd) {
                  insideTable = true;
                }
                // else: insideTable stays false → paragraph goes through paragraphToMarkdown
              } else {
                insideTable = true;
              }
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

        // Compute clip bounds using text matching (not position arithmetic,
        // because OO positions don't map 1:1 to text characters).
        // range.GetText() is the ground truth of what's actually selected.
        var clipStart = 0;
        var clipEnd = 0;
        // Strip trailing \r\n paragraph mark — para.GetText() includes it
        // but the runs (annotatedParts) do not, causing a clip mismatch
        var paraText = (para.GetText ? para.GetText() : "").replace(/\r?\n$/, "");
        if ((p === 0 || p === paragraphs.length - 1) && paraText.length > 0) {
          var rangeText = range.GetText ? range.GetText() : "";
          if (rangeText.length > 0) {
            if (p === 0 && paragraphs.length === 1 && rangeText.length < paraText.length) {
              // Single paragraph selection: find rangeText within paraText
              var idx = paraText.indexOf(rangeText);
              if (idx >= 0) {
                clipStart = idx;
                clipEnd = paraText.length - idx - rangeText.length;
              }
            } else if (p === 0 && paragraphs.length > 1) {
              // First paragraph of multi-paragraph: selected text is a suffix of paraText
              // rangeText starts with this suffix
              for (var sfx = paraText.length; sfx > 0; sfx--) {
                var suffix = paraText.substring(paraText.length - sfx);
                if (rangeText.substring(0, sfx) === suffix) {
                  clipStart = paraText.length - sfx;
                  break;
                }
              }
            } else if (p === paragraphs.length - 1 && paragraphs.length > 1) {
              // Last paragraph of multi-paragraph: selected text is a prefix of paraText
              // rangeText ends with this prefix
              for (var pfx = paraText.length; pfx > 0; pfx--) {
                var prefix = paraText.substring(0, pfx);
                if (rangeText.substring(rangeText.length - pfx) === prefix) {
                  clipEnd = paraText.length - pfx;
                  break;
                }
              }
            }
          }
        }



        // Regular paragraph — inline images are now handled inside paragraphToMarkdown
        var paraMarkdown = paragraphToMarkdown(para, clipStart, clipEnd);

        // §5bis extraction rule: a paragraph-level style MARKER (heading #, list
        // bullet/number) is emitted ONLY when the paragraph is FULLY selected.
        // A partially-selected ¶ (clipStart/clipEnd > 0 — e.g. the first/last ¶ of
        // a cross-¶ range) extracts as plain text + inline formatting only, with no
        // line-start marker (so re-injection treats it inline, not block). Char-level
        // formatting (bold/italic/…) is unaffected — it's handled per-run inside
        // paragraphToMarkdown.
        var fullySel = (clipStart === 0 && clipEnd === 0);

        // Apply heading prefix
        if (headingLvl > 0 && headingLvl <= 6 && fullySel) {
          var hashes = "";
          for (var h = 0; h < headingLvl; h++) hashes = hashes + "#";
          paraMarkdown = hashes + " " + paraMarkdown;
        }

        // Apply list prefix with nesting indentation (only for a fully-selected ¶)
        var emitList = listInfo && fullySel;
        if (emitList) {
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
          // Not a (fully-selected) list item — reset all ordered counters
          orderedCounters = {};
        }

        mdParts.push({ md: paraMarkdown, isList: !!emitList });
        // Clip plain text to match selection bounds
        var paraPlain = paraText;
        if (clipStart > 0 || clipEnd > 0) {
          paraPlain = paraPlain.substring(clipStart, paraPlain.length - clipEnd);
        }
        plainParts.push(paraPlain);
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

      // Store table snapshots via Asc.scope (may be large, avoids JSON return size limits)
      Asc.scope.tableSnapshots = tableSnapshots.length > 0 ? tableSnapshots : null;

      return JSON.stringify({
        text: plainParts.join("\n"),
        md: mdLines.join(""),
        tableDocIndices: tableDocIndices,
        tableAmbiguity: tableAmbiguity,
        partialTableInfo: partialTableInfo,
        crossRefMeta: Asc.scope._crMeta || {}
      });
    }, false, false, function(resultJson) {
      // false = read-write (allows SetName on images for stable naming)
      // Update module-level counters from Asc.scope
      imageCounter = window.Asc.scope.imgCounter || imageCounter;
      footnoteCounter = window.Asc.scope._fnCounter || footnoteCounter;
      crossRefCounter = window.Asc.scope._crCounter || crossRefCounter;
      var result;
      try {
        result = JSON.parse(resultJson);
      } catch (e) {
        result = { text: "", md: "" };
      }
      // Read crossRefMeta from JSON return (Asc.scope objects set inside callCommand may not persist)
      lastCrossRefMeta = result.crossRefMeta || {};
      var plainText = (result.text || "").replace(/^\s+|\s+$/g, "");

      lastSelectedText = plainText;
      lastEnrichedMd = result.md || "";
      lastTableDocIndices = result.tableDocIndices || [];
      lastTableSnapshots = window.Asc.scope.tableSnapshots || null;
      lastTableAmbiguity = result.tableAmbiguity || null;
      lastPartialTableInfo = result.partialTableInfo || null;
      lastSelectedHtml = ""; // No longer used for primary extraction


      if (!plainText) {
        lastEnrichedMd = "";
      }

      // Push selection to React only when panel is listening
      if (selectionSubscribed) {
        var selData = buildEditIntentData();
        selData.html = lastSelectedHtml || null;
        castIntent("SELECTION_CHANGED", selData, true);
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
  // With text selected: casts AI_TEXT_ASSISTANT immediately.
  //   React handles double-tap detection and popover-to-panel transition.
  //   If panel is already open, React closes it on receiving AI_TEXT_ASSISTANT.
  // Without text selected: cast TOGGLE_SCRIBE_PANEL immediately.
  function handleCtrlShiftI(e) {
    var isCtrlShiftI = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i");
    if (!isCtrlShiftI) return;
    e.preventDefault();

    // Decide from the LIVE selection, not the cached lastSelectedText. When the
    // panel is closed and the user collapses a selection to a bare cursor, OO
    // does not fire init() (initOnSelectionChanged is non-empty only) and the
    // poll is stopped, so lastSelectedText would be stale and we'd wrongly open
    // the inline popover. GetSelectedText is always current.
    window.Asc.plugin.executeMethod("GetSelectedText", [], function(txt) {
      if (txt && txt.length > 0) {
        log("Ctrl+Shift+I triggered Scribe");
        // #1: keyboard opens inline Scribe with a prepare-then-reveal window.
        // Cast with deferReveal so React mounts the popover hidden (prepared)
        // and reveals it after a short delay. The reveal timer lives on the
        // HOST (foreground document), NOT here: this plugin runs in a hidden
        // background iframe whose setTimeout is heavily throttled (a 20ms timer
        // fired after 250-440ms in practice), so addon-side timing is unusable.
        // The toolbar/context-menu paths cast without deferReveal -> open now.
        lastSelectedText = txt;
        var data = buildEditIntentData();
        data.deferReveal = true;
        castIntent("AI_TEXT_ASSISTANT", data);
      } else {
        log("Ctrl+Shift+I: toggle panel");
        lastSelectedText = "";
        castIntent("TOGGLE_SCRIBE_PANEL", {}, true);
      }
    });
  }

  // Undo/redo trigger the passive init() extraction (via the resulting
  // selection change), whose callCommand truncates the redo stack and breaks
  // redo. We suppress that extraction briefly whenever an undo/redo is invoked.
  function suppressExtraction() {
    suppressExtractionUntil = Date.now() + 500;
  }

  // Keyboard: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z = redo.
  function handleUndoRedoKey(e) {
    var mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    var key = e.key;
    var isUndo = !e.shiftKey && (key === "z" || key === "Z");
    var isRedo = (key === "y" || key === "Y") || (e.shiftKey && (key === "z" || key === "Z"));
    if (isUndo || isRedo) suppressExtraction();
  }

  // Toolbar Undo/Redo buttons live in the OO editor document (window.parent,
  // same origin), so we can catch their clicks too — keyboard detection alone
  // misses mouse users, which broke undo/redo round-trips via the buttons.
  // OO button ids: id-toolbar-btn-undo / id-toolbar-btn-redo (slot-btn-*).
  function handleUndoRedoClick(e) {
    var t = e.target;
    if (t && t.closest && t.closest('[id*="btn-undo"],[id*="btn-redo"]')) {
      suppressExtraction();
    }
  }

  try {
    window.parent.document.addEventListener("keydown", handleCtrlShiftI);
    window.parent.document.addEventListener("keydown", handleUndoRedoKey);
    window.parent.document.addEventListener("click", handleUndoRedoClick, true);
    log("Ctrl+Shift+I shortcut registered on parent document");
  } catch (e) {
    log("Cannot register Ctrl+Shift+I on parent document: " + e.message);
    document.addEventListener("keydown", handleCtrlShiftI);
    document.addEventListener("keydown", handleUndoRedoKey);
    document.addEventListener("click", handleUndoRedoClick, true);
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

  // ==========================================================================
  // DEV TEST HOOKS (T-03 selection-case harness) — FLAG-GATED, DEV-ONLY.
  // Never active in production: gated on localStorage "scribe.testHooks"==="1"
  // or window.__scribeTestForce===true (set explicitly by the test driver).
  //
  // Contract: test-harness/ORACLE-SCHEMA.md §1-§2. Driveable two ways so the
  // channel can be chosen at run time:
  //   (a) global  window.__scribeTest(cmd) -> Promise   (frame-eval driving)
  //   (b) postMessage {scribeTest, reqId, ...} -> {scribeTestResult,...}
  //                                                      (host-relay driving)
  // Determinism: injectFixture short-circuits the LLM and calls buildAndInject
  // directly; OO serializes callCommands, so a dumpState issued right after
  // injectFixture runs only once the injection callCommand has completed.
  // ==========================================================================
  function testHooksEnabled() {
    try {
      if (typeof window !== "undefined" && window.__scribeTestForce === true) return true;
      return (typeof localStorage !== "undefined" && localStorage.getItem("scribe.testHooks") === "1");
    } catch (e) {
      return (typeof window !== "undefined" && window.__scribeTestForce === true);
    }
  }

  // Parse a SELECTION-CASES spec into endpoints. Two endpoint forms:
  //   "P<n>@<pos>"            → n-th TOP-LEVEL paragraph
  //   "T<n>.C(<r>,<c>)@<pos>" → 1st ¶ of cell (r,c) of the n-th TABLE (intra-cell)
  // <pos> = start|space|mid|end|x|<int>. A range "<a>..<b>" must stay within the
  // SAME target (same paragraph, or same table+cell) — intra-cell only for now.
  function parseSelSpec(spec) {
    if (!spec) return null;
    var parts = String(spec).split("..");
    function one(p) {
      var m = /^\s*P(\d+)@(\w+)\s*$/.exec(p);
      if (m) return { n: parseInt(m[1], 10), kind: m[2], cell: null };
      var mc = /^\s*T(\d+)\.C\((\d+),(\d+)\)@(\w+)\s*$/.exec(p);
      if (mc) return { n: parseInt(mc[1], 10), kind: mc[4], cell: { r: parseInt(mc[2], 10), c: parseInt(mc[3], 10) } };
      return null;
    }
    var a = one(parts[0]);
    var b = parts.length > 1 ? one(parts[1]) : a;
    if (!a || !b) return null;
    return { startN: a.n, startKind: a.kind, startCell: a.cell, endN: b.n, endKind: b.kind, endCell: b.cell };
  }

  // Both endpoints must target the SAME paragraph/cell (intra-target selection).
  function selSpecSameTarget(p) {
    if (p.startN !== p.endN) return false;
    var sc = p.startCell, ec = p.endCell;
    if (!sc && !ec) return true;
    return !!(sc && ec && sc.r === ec.r && sc.c === ec.c);
  }

  function hookSetSelection(spec) {
    return new Promise(function(resolve) {
      var p = parseSelSpec(spec);
      if (!p) { resolve({ ok: false, error: "bad selection spec: " + spec }); return; }
      if (!selSpecSameTarget(p)) {
        // Multi-paragraph / cross-cell range — out of scope (intra-target only).
        resolve({ ok: false, error: "multi-target selection not yet supported: " + spec });
        return;
      }
      Asc.scope._selspec = JSON.stringify(p);
      window.Asc.plugin.callCommand(function() {
        var p = JSON.parse(Asc.scope._selspec);
        var doc = Api.GetDocument();
        var target = null;
        if (p.startCell) {
          // n-th TABLE → cell (r,c) → 1st ¶ of the cell (intra-cell, §4ter).
          var tcnt = doc.GetElementsCount(), tseen = 0, tbl = null;
          for (var ti = 0; ti < tcnt; ti++) {
            var tel = doc.GetElement(ti);
            if (tel.GetClassType && tel.GetClassType() === "table") { tseen++; if (tseen === p.startN) { tbl = tel; break; } }
          }
          if (tbl) { try { target = tbl.GetCell(p.startCell.r, p.startCell.c).GetContent().GetElement(0); } catch (e) {} }
        } else {
          var count = doc.GetElementsCount(), seen = 0;
          for (var i = 0; i < count; i++) {
            var el = doc.GetElement(i);
            if (el.GetClassType && el.GetClassType() === "paragraph") { seen++; if (seen === p.startN) { target = el; break; } }
          }
        }
        if (!target) return JSON.stringify({ ok: false, error: "target not found (P/cell " + p.startN + ")" });
        // GetText() includes the trailing paragraph mark "\r\n" — strip it for char length.
        var txt = (target.GetText ? target.GetText() : "").replace(/[\r\n]+$/, "");
        var len = txt.length;
        var sk = p.startKind, ek = p.endKind;
        function resolveOffset(kind) {
          if (/^\d+$/.test(kind)) { var n = parseInt(kind, 10); return n > len ? len : n; }
          if (kind === "end") return len;
          if (kind === "mid") return Math.floor(len / 2);
          if (kind === "space") { var idx = txt.indexOf(" "); return idx >= 0 ? idx + 1 : 0; }
          return 0; // "start" | "x"
        }
        // Build a COLLAPSED range at char offset `off` by walking runs/hyperlinks
        // and using per-element GetRange(inOff,inOff) — char-reliable WITHIN one
        // element. (Document-absolute positions count element boundaries, so plain
        // char math mis-selects across runs; this avoids that.)
        function rangeAtChar(para, off) {
          var cnt = para.GetElementsCount ? para.GetElementsCount() : 0, acc = 0;
          for (var i = 0; i < cnt; i++) {
            var el = para.GetElement(i);
            var ct = el.GetClassType ? el.GetClassType() : "";
            if (ct !== "run" && ct !== "hyperlink") continue;
            var t = (el.GetText ? el.GetText() : "").replace(/[\r\n]+$/, "");
            if (off <= acc + t.length) {
              var inOff = off - acc;
              return el.GetRange ? el.GetRange(inOff, inOff) : null;
            }
            acc += t.length;
          }
          return null; // off past end
        }
        var s = resolveOffset(sk), e = resolveOffset(ek);
        var rng = null;
        if (s === 0 && e === len) {
          // Whole paragraph — GetRange() no-args is reliable regardless of run count.
          rng = target.GetRange ? target.GetRange() : null;
        } else if (s === e) {
          // Collapsed cursor (A0 @x, A2 @mid).
          rng = rangeAtChar(target, s) || (target.GetRange ? target.GetRange(0, 0) : null);
        } else {
          // Range — collapse at both endpoints then ExpandTo (union of the two
          // collapsed ranges, cf selectByRefs). rangeAtChar(len) lands collapsed
          // at the end of the last run, so @end works without a special case.
          var ra = rangeAtChar(target, s);
          var rb = rangeAtChar(target, e);
          if (ra && rb && ra.ExpandTo) rng = ra.ExpandTo(rb);
          else rng = ra || rb;
        }
        if (rng && rng.Select) rng.Select();
        return JSON.stringify({ ok: true, paraLen: len, mode: sk + ".." + ek, s: s, e: e });
      }, false, false, function(ret) {
        try { resolve(JSON.parse(ret)); } catch (e) { resolve({ ok: false, error: "setSelection parse: " + e }); }
      });
    });
  }

  function hookInjectFixture(md, mode) {
    return new Promise(function(resolve) {
      try {
        Asc.scope._testSelSpec = null; // never apply a stale test selection
        buildAndInject(md, mode === "insert" ? "insert" : "replace", null);
        resolve({ ok: true }); // dumpState issued next will run after this callCommand (OO serializes)
      } catch (e) {
        resolve({ ok: false, error: e.message });
      }
    });
  }

  // Atomic set-selection + inject (one callCommand) — needed for COLLAPSED
  // cursors (A0/A2): a cursor set by a separate setSelection callCommand resets
  // to offset 0 before injectFixture runs. The spec is queued in Asc.scope and
  // applied at the top of buildAndInject's own callCommand (see [TEST HOOK]).
  function hookInjectAtSelection(spec, md, mode) {
    return new Promise(function(resolve) {
      var p = parseSelSpec(spec);
      if (!p) { resolve({ ok: false, error: "bad selection spec: " + spec }); return; }
      if (!selSpecSameTarget(p)) {
        resolve({ ok: false, error: "multi-target selection not yet supported: " + spec });
        return;
      }
      try {
        Asc.scope._testSelSpec = JSON.stringify(p);
        buildAndInject(md, mode === "insert" ? "insert" : "replace", null);
        resolve({ ok: true, spec: spec });
      } catch (e) {
        resolve({ ok: false, error: e.message });
      }
    });
  }

  function hookDumpState(scope) {
    return new Promise(function(resolve) {
      window.Asc.plugin.callCommand(function() {
        var doc = Api.GetDocument();

        function runFlags(tp) {
          var r = {};
          if (!tp) return r;
          if (tp.GetBold && tp.GetBold()) r.b = 1;
          if (tp.GetItalic && tp.GetItalic()) r.i = 1;
          if (tp.GetStrikeout && tp.GetStrikeout()) r.s = 1;
          if (tp.GetUnderline && tp.GetUnderline()) r.u = 1;
          var ff = tp.GetFontFamily ? tp.GetFontFamily() : null;
          if (ff) {
            var f = ff.toLowerCase();
            if (f.indexOf("courier") !== -1 || f.indexOf("consolas") !== -1 || f.indexOf("mono") !== -1) r.code = 1;
          }
          return r;
        }
        function paraToBlock(para) {
          var runs = [];
          var n = para.GetElementsCount ? para.GetElementsCount() : 0;
          for (var i = 0; i < n; i++) {
            var el = para.GetElement(i);
            var ct = el.GetClassType ? el.GetClassType() : "";
            if (ct === "run") {
              var t = el.GetText ? el.GetText() : "";
              if (t === "") continue;
              var fl = runFlags(el.GetTextPr ? el.GetTextPr() : null);
              fl.t = t;
              runs.push(fl);
            } else if (ct === "hyperlink") {
              var ht = "", first = null;
              var hc = el.GetElementsCount ? el.GetElementsCount() : 0;
              for (var h = 0; h < hc; h++) {
                var ch = el.GetElement(h);
                var cht = ch.GetText ? ch.GetText() : "";
                if (cht) { ht += cht; if (!first) first = ch; }
              }
              if (ht) {
                var fl2 = first ? runFlags(first.GetTextPr ? first.GetTextPr() : null) : {};
                fl2.t = ht;
                var url = el.GetLinkedText ? el.GetLinkedText() : "";
                if (url) fl2.link = url;
                runs.push(fl2);
              }
            }
          }
          var pblock = { type: "p", runs: runs };
          try {
            var pst = para.GetStyle ? para.GetStyle() : null;
            var psn = (pst && pst.GetName) ? pst.GetName() : null;
            if (psn && psn !== "Normal") pblock.style = psn;
            var plvl = para.GetOutlineLvl ? para.GetOutlineLvl() : -1;
            if (typeof plvl === "number" && plvl >= 0) pblock.lvl = plvl;
          } catch (e) {}
          return pblock;
        }
        function cellToBlocks(cell) {
          var blocks = [];
          var c = cell && cell.GetContent ? cell.GetContent() : null;
          if (!c) return blocks;
          var n = c.GetElementsCount();
          for (var i = 0; i < n; i++) {
            var el = c.GetElement(i);
            if (el.GetClassType && el.GetClassType() === "paragraph") blocks.push(paraToBlock(el));
            // nested tables: out of spike scope (T13)
          }
          return blocks;
        }
        function tableToBlock(tbl) {
          var grid = [];
          var rc = tbl.GetRowsCount();
          for (var r = 0; r < rc; r++) {
            var row = tbl.GetRow(r);
            var cc = row.GetCellsCount();
            var cells = [];
            for (var ci = 0; ci < cc; ci++) {
              var cell = tbl.GetCell(r, ci);
              cells.push({ blocks: cell ? cellToBlocks(cell) : [] });
              // vmerge/hspan: deferred (T12) — captured in a later iteration
            }
            grid.push(cells);
          }
          return { type: "table", grid: grid };
        }

        var blocks = [], blockRanges = [];
        var bc = doc.GetElementsCount();
        for (var i = 0; i < bc; i++) {
          var el = doc.GetElement(i);
          var ct = el.GetClassType ? el.GetClassType() : "";
          if (ct === "paragraph") {
            var idx = blocks.length;
            blocks.push(paraToBlock(el));
            var rg = el.GetRange ? el.GetRange() : null;
            blockRanges.push({
              idx: idx,
              start: rg && rg.GetStartPos ? rg.GetStartPos() : -1,
              end: rg && rg.GetEndPos ? rg.GetEndPos() : -1
            });
          } else if (ct === "table") {
            blocks.push(tableToBlock(el));
            // table selection-mapping deferred to T4-T6 work
          }
        }

        var sel = null;
        var srange = doc.GetRangeBySelect ? doc.GetRangeBySelect() : null;
        if (srange) {
          var ss = srange.GetStartPos ? srange.GetStartPos() : -1;
          var se = srange.GetEndPos ? srange.GetEndPos() : -1;
          var locate = function(pos) {
            for (var k = 0; k < blockRanges.length; k++) {
              var br = blockRanges[k];
              if (pos >= br.start && pos <= br.end) return { block: br.idx, offset: pos - br.start };
            }
            return { block: -1, offset: -1 };
          };
          sel = { start: locate(ss), end: locate(se) };
        }

        return JSON.stringify({ blocks: blocks, selection: sel });
      }, false, false, function(ret) {
        try { resolve(JSON.parse(ret)); } catch (e) { resolve({ error: "dumpState parse: " + e }); }
      });
    });
  }

  // Run the REAL selection extraction (window.Asc.plugin.init path) on the current
  // selection and return the enriched markdown + plain text it produced. Lets the
  // harness capture the EXTRACTION side of §5bis (conditional ¶-style markers) and,
  // later, table-cell extraction — the round-trip counterpart of injectFixture.
  function hookExtractSelection() {
    return new Promise(function(resolve) {
      // Sentinel: init()'s extraction callback overwrites these. Poll until it
      // runs (its callCommand completes asynchronously, after this call returns).
      lastEnrichedMd = "__pending__";
      lastSelectedText = "__pending__";
      try { window.Asc.plugin.init(); } catch (e) {}
      var tries = 0;
      function check() {
        tries++;
        var done = (lastSelectedText !== "__pending__") || (lastEnrichedMd !== "__pending__");
        if (done || tries > 30) {
          resolve({
            ok: true,
            text: lastSelectedText === "__pending__" ? "" : lastSelectedText,
            md: lastEnrichedMd === "__pending__" ? "" : lastEnrichedMd,
            tries: tries
          });
        } else {
          setTimeout(check, 120);
        }
      }
      setTimeout(check, 120);
    });
  }

  function runTestCmd(action, params) {
    if (!testHooksEnabled()) return Promise.resolve({ ok: false, error: "test hooks disabled" });
    if (action === "setSelection") return hookSetSelection(params.spec);
    if (action === "injectFixture") return hookInjectFixture(params.md, params.mode);
    if (action === "injectAtSelection") return hookInjectAtSelection(params.spec, params.md, params.mode);
    if (action === "dumpState") return hookDumpState(params.scope || "region");
    if (action === "extractSelection") return hookExtractSelection();
    return Promise.resolve({ ok: false, error: "unknown scribeTest action: " + action });
  }

  // Channel (a): direct global, for frame-eval driving (Chrome DevTools / MCP).
  window.__scribeTest = function(cmd) {
    cmd = cmd || {};
    return runTestCmd(cmd.action, cmd);
  };

  // Channel (b): postMessage, for host-relay driving.
  window.addEventListener("message", function(event) {
    var msg = event.data;
    if (!msg || typeof msg.scribeTest !== "string") return;
    var action = msg.scribeTest, reqId = msg.reqId;
    runTestCmd(action, msg).then(function(res) {
      var reply = { scribeTestResult: action, reqId: reqId };
      if (action === "dumpState") {
        reply.model = { blocks: res.blocks, selection: res.selection };
        if (res.error) reply.error = res.error;
      } else {
        reply.ok = res.ok !== false;
        if (res.error) reply.error = res.error;
      }
      postToAncestors(reply);
    });
  });

})(window, undefined);
