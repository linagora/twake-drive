(function(window, undefined) {
  "use strict";

  // ---- State ----
  var lastSelectedText = "";
  var lastSelectedHtml = "";
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

  // Build AI_TEXT_ASSISTANT intent data with optional HTML field (EXTR-02)
  function buildEditIntentData() {
    var data = { text: lastSelectedText };
    if (lastSelectedHtml && lastSelectedHtml.length > 0) {
      data.html = lastSelectedHtml;
      data.format = "html";
    }
    return data;
  }

  // ---- Paste HTML with smart spacing ----
  // Prevents init() and polling from interfering during paste.
  var pasteInProgress = false;

  // ---- flattenTokens: convert marked lexer output to flat paragraph+runs ----
  // Takes the array returned by marked.lexer(md) and produces:
  //   [{ type: "paragraph", runs: [{ text, bold, italic }] }]
  // Handles bold (strong), italic (em), nested formatting, and unknown block fallback.
  function flattenTokens(markedTokens) {
    var blocks = [];

    function flattenInline(tokens, parentBold, parentItalic, parentStrikethrough, parentCode, parentLink) {
      var runs = [];
      for (var i = 0; i < tokens.length; i++) {
        var tok = tokens[i];
        if (tok.type === "text") {
          runs.push({ text: tok.text, bold: !!parentBold, italic: !!parentItalic, strikethrough: !!parentStrikethrough, code: !!parentCode, link: parentLink || null });
        } else if (tok.type === "strong") {
          runs = runs.concat(flattenInline(tok.tokens, true, parentItalic, parentStrikethrough, parentCode, parentLink));
        } else if (tok.type === "em") {
          runs = runs.concat(flattenInline(tok.tokens, parentBold, true, parentStrikethrough, parentCode, parentLink));
        } else if (tok.type === "del") {
          runs = runs.concat(flattenInline(tok.tokens, parentBold, parentItalic, true, parentCode, parentLink));
        } else if (tok.type === "codespan") {
          runs.push({ text: tok.text, bold: !!parentBold, italic: !!parentItalic, strikethrough: !!parentStrikethrough, code: true, link: parentLink || null });
        } else if (tok.type === "link") {
          runs = runs.concat(flattenInline(tok.tokens || [], parentBold, parentItalic, parentStrikethrough, parentCode, tok.href));
        } else if (tok.tokens) {
          runs = runs.concat(flattenInline(tok.tokens, parentBold, parentItalic, parentStrikethrough, parentCode, parentLink));
        } else if (tok.text) {
          runs.push({ text: tok.text, bold: !!parentBold, italic: !!parentItalic, strikethrough: !!parentStrikethrough, code: !!parentCode, link: parentLink || null });
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
            runs: flattenInline(inlineTokens, false, false, false, false, null)
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
        blocks.push({ type: "paragraph", runs: flattenInline(block.tokens || [], false, false, false, false, null) });
      } else if (block.type === "heading") {
        blocks.push({
          type: "heading",
          depth: block.depth,
          runs: flattenInline(block.tokens || [], false, false, false, false, null)
        });
      } else if (block.type === "list") {
        flattenList(block, 0);
      } else if (block.type === "space") {
        // skip -- implicit paragraph separator
      } else if (block.tokens) {
        // Unknown block type with tokens: treat as paragraph fallback
        blocks.push({ type: "paragraph", runs: flattenInline(block.tokens || [], false, false, false, false, null) });
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
    var tokens = window.marked.lexer(md);
    var flat = flattenTokens(tokens);

    if (flat.length === 0) {
      log("No blocks parsed -- falling back to PasteHtml");
      if (fallbackHtml) { pasteHtml(fallbackHtml, mode); }
      return;
    }

    pasteInProgress = true;
    stopHidePolling();
    Asc.scope.tokens = JSON.stringify(flat);
    Asc.scope._mode = mode || "replace";

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

      // Helper: create a space run matching surrounding font
      function makeSpaceRun() {
        var sr = Api.CreateRun();
        sr.AddText(" ");
        if (srcFontFamily) sr.SetFontFamily(srcFontFamily);
        if (srcFontSize) sr.SetFontSize(srcFontSize);
        return sr;
      }

      var content = [];
      for (var i = 0; i < blocks.length; i++) {
        var block = blocks[i];
        var isFirst = (i === 0);
        var isLast = (i === blocks.length - 1);

        if (block.type === "heading") {
          var p = Api.CreateParagraph();
          var styleName = "Heading " + block.depth;
          var headingStyle = doc.GetStyle(styleName);
          if (headingStyle) p.SetStyle(headingStyle);
          // Prepend space run if this is the first block and needs spacing
          if (isFirst && needSpaceBefore) p.AddElement(makeSpaceRun());
          var runs = block.runs || [];
          for (var j = 0; j < runs.length; j++) {
            var run = runs[j];
            if (run.link) {
              var link = Api.CreateHyperlink(run.link, run.text, "");
              p.AddElement(link);
            } else {
              var r = Api.CreateRun();
              r.AddText(run.text);
              if (run.bold) r.SetBold(true);
              if (run.italic) r.SetItalic(true);
              if (run.strikethrough) r.SetStrikeout(true);
              if (run.code) {
                r.SetFontFamily("Courier New");
                if (srcFontSize) r.SetFontSize(srcFontSize);
              }
              // Heading runs: no srcFont applied (heading style defines sizing)
              p.AddElement(r);
            }
          }
          // Append space run if this is the last block and needs spacing
          if (isLast && needSpaceAfter) p.AddElement(makeSpaceRun());
          content.push(p);
        } else if (block.type === "list_item") {
          var p = Api.CreateParagraph();
          var numbering = block.ordered ? orderedNumbering : bulletNumbering;
          var numLvl = numbering.GetLevel(block.level);
          p.SetNumbering(numLvl);
          if (isFirst && needSpaceBefore) p.AddElement(makeSpaceRun());
          var runs = block.runs || [];
          for (var j = 0; j < runs.length; j++) {
            var run = runs[j];
            if (run.link) {
              var link = Api.CreateHyperlink(run.link, run.text, "");
              p.AddElement(link);
            } else {
              var r = Api.CreateRun();
              r.AddText(run.text);
              if (run.bold) r.SetBold(true);
              if (run.italic) r.SetItalic(true);
              if (run.strikethrough) r.SetStrikeout(true);
              if (run.code) {
                r.SetFontFamily("Courier New");
                if (srcFontSize) r.SetFontSize(srcFontSize);
              } else if (block.type !== "heading") {
                if (srcFontFamily) r.SetFontFamily(srcFontFamily);
                if (srcFontSize) r.SetFontSize(srcFontSize);
              }
              p.AddElement(r);
            }
          }
          if (isLast && needSpaceAfter) p.AddElement(makeSpaceRun());
          content.push(p);
        } else if (block.type === "paragraph") {
          var p = Api.CreateParagraph();
          if (isFirst && needSpaceBefore) p.AddElement(makeSpaceRun());
          var runs = block.runs || [];
          for (var j = 0; j < runs.length; j++) {
            var run = runs[j];
            if (run.link) {
              var link = Api.CreateHyperlink(run.link, run.text, "");
              p.AddElement(link);
            } else {
              var r = Api.CreateRun();
              r.AddText(run.text);
              if (run.bold) r.SetBold(true);
              if (run.italic) r.SetItalic(true);
              if (run.strikethrough) r.SetStrikeout(true);
              if (run.code) {
                r.SetFontFamily("Courier New");
                if (srcFontSize) r.SetFontSize(srcFontSize);
              } else if (block.type !== "heading") {
                if (srcFontFamily) r.SetFontFamily(srcFontFamily);
                if (srcFontSize) r.SetFontSize(srcFontSize);
              }
              p.AddElement(r);
            }
          }
          if (isLast && needSpaceAfter) p.AddElement(makeSpaceRun());
          content.push(p);
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

    // With initDataType:"html", data contains HTML string from OO
    // Store class-stripped HTML for rich text pipeline
    lastSelectedHtml = stripOoClasses(data || "");

    // Fetch plain text in parallel via GetSelectedText (needed for button display and fallback)
    window.Asc.plugin.executeMethod("GetSelectedText", [{
      Numbering: false,
      Math: false,
      TableCellSeparator: "\n",
      ParaSeparator: "\n",
      TabSymbol: String.fromCharCode(9)
    }], function(text) {
      var plainText = (text || "").replace(/^\s+|\s+$/g, "");

      // If GetSelectedText returned empty but we have HTML, extract text approximation
      if (plainText.length === 0 && data) {
        plainText = data.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/^\s+|\s+$/g, "");
      }

      lastSelectedText = plainText;

      if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);

      if (plainText.length > 0) {
        selectionDebounceTimer = setTimeout(function() {
          castIntent("SHOW_SCRIBE_BUTTON", { text: plainText }, true);
          scribeButtonShown = true;
          startHidePolling();
        }, SELECTION_DEBOUNCE_MS);
      } else {
        // No text found -- also clear HTML since selection is empty
        lastSelectedHtml = "";
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
