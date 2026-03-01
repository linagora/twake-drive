(function(window, undefined) {
  "use strict";

  // ---- State ----
  var lastSelectedText = "";
  var pendingIntents = {};
  var cozyOrigin = "*"; // TODO: restrict to actual Cozy origin in production

  // ---- Target window for postMessage ----
  // Cozy apps run inside an iframe from the Cozy Stack, so the frame hierarchy is:
  //   Cozy Stack (window.top) > Cozy Drive iframe > OO Editor iframe > Plugin iframe
  // CozyBridge listens on the Cozy Drive iframe window, which is window.parent.parent.
  // We post to all ancestor frames so the message reaches CozyBridge regardless of nesting.
  function postToAncestors(message) {
    var current = window.parent;
    var count = 0;
    while (current && current !== window) {
      try {
        current.postMessage(message, cozyOrigin);
        count++;
      } catch (e) {
        // Cross-origin frame we can't post to — stop
        break;
      }
      if (current === current.parent) break;
      current = current.parent;
    }
    log("Posted to " + count + " ancestor frame(s)");
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

  // ---- UI: updateUI() ----
  function updateUI() {
    var btn = document.getElementById("scribe-trigger");
    var hint = document.getElementById("scribe-hint");

    var hasSelection = lastSelectedText.length > 0;

    if (btn) {
      btn.disabled = !hasSelection;
    }
    if (hint) {
      if (hasSelection) {
        hint.classList.add("hidden");
      } else {
        hint.classList.remove("hidden");
      }
    }
  }

  // ---- castIntent: send an intent to Cozy Drive via postMessage ----
  // Per locked user decision: Promise-based API.
  // The plugin iframe (not callCommand) runs in a modern browser context
  // where Promise should be available. Fallback to callback-only if not.
  function castIntent(action, data) {
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
    log("Intent cast: " + action + " id=" + intentId);

    if (typeof Promise !== "undefined") {
      return new Promise(function(resolve, reject) {
        pendingIntents[intentId] = { action: action, resolve: resolve, reject: reject };
      });
    } else {
      // Fallback: store for correlation, response handled via message listener + handleIntentResponse
      // castIntent returns undefined in this case -- callers should not depend on the return value
      log("Promise unavailable in sandbox -- using callback fallback");
      pendingIntents[intentId] = { action: action, resolve: null, reject: null };
      return undefined;
    }
  }

  // ---- handleIntentResponse: apply document modification from response ----
  function handleIntentResponse(msg) {
    if (msg.action === "replace") {
      log("Applying replace: " + (msg.data && msg.data.text ? msg.data.text.substring(0, 80) : "(empty)"));
      window.Asc.plugin.executeMethod("PasteText", [msg.data.text]);
    } else if (msg.action === "insert") {
      log("Applying insert after selection");
      insertAfterWithText(msg.data.text);
    } else if (msg.action === "cancel") {
      log("Intent cancelled -- no document modification");
    }
  }

  // ---- Insert after selection helper (Phase 1 workaround) ----
  // InsertContent replaces the selection, so we re-create the original
  // paragraphs and append the new text after them.
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
    log("Intent response: action=" + msg.action + " status=" + msg.status);

    // Resolve the Promise if available
    if (pending.resolve) {
      pending.resolve({ action: msg.action, result: msg.data });
    }

    // Always handle the response for document modification
    if (msg.status === "ok") {
      handleIntentResponse(msg);
    }
  });

  // ---- Mouse position tracking for floating button coordinates ----
  var lastMousePosition = { x: 0, y: 0 };

  try {
    window.parent.document.addEventListener("mouseup", function(e) {
      lastMousePosition.x = e.clientX;
      lastMousePosition.y = e.clientY;
    });
    log("Mouse tracking attached to parent document");
  } catch (e) {
    log("Cannot attach to parent document (cross-origin): " + e.message);
  }

  // ---- Selection state notification ----
  var selectionDebounceTimer = null;
  var SELECTION_DEBOUNCE_MS = 300;

  function notifySelectionState(hasSelection, text) {
    postToAncestors({
      type: "cozy-bridge:selection-state",
      version: 1,
      source: "onlyoffice-plugin",
      data: {
        hasSelection: hasSelection,
        text: hasSelection ? text : "",
        top: hasSelection ? lastMousePosition.y : 0,
        left: hasSelection ? lastMousePosition.x : 0
      }
    });
  }

  // ---- Selection detection (via init) ----
  // OO calls init with the selected text. When the selection is cleared,
  // it may send an empty string, whitespace-only, or stop calling init.
  // We trim and treat whitespace-only as no selection.
  window.Asc.plugin.init = function(data) {
    log("init() called, data=" + (data ? data.substring(0, 60) : "(null)"));
    var text = (data || "").replace(/^\s+|\s+$/g, "");
    lastSelectedText = text;
    updateUI();

    if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);

    if (text.length > 0) {
      selectionDebounceTimer = setTimeout(function() {
        notifySelectionState(true, text);
      }, SELECTION_DEBOUNCE_MS);
    } else {
      notifySelectionState(false, "");
    }
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
      log("Context menu read: " + (lastSelectedText ? lastSelectedText.substring(0, 80) : "(empty)"));
      updateUI();
      castIntent("AI_TEXT_EDIT", { text: lastSelectedText });
    });
  });

  // ---- Ctrl+K / Cmd+K shortcut for Scribe ----
  try {
    window.parent.document.addEventListener("keydown", function(e) {
      var isCtrlK = (e.ctrlKey || e.metaKey) && e.key === "k";
      if (isCtrlK && lastSelectedText.length > 0) {
        e.preventDefault();
        log("Ctrl+K triggered Scribe");
        castIntent("AI_TEXT_EDIT", { text: lastSelectedText });
      }
    });
    log("Ctrl+K shortcut registered on parent document");
  } catch (e) {
    log("Cannot register Ctrl+K on parent document: " + e.message);
    // Fallback: register on plugin's own document (limited, but still useful)
    document.addEventListener("keydown", function(e) {
      var isCtrlK = (e.ctrlKey || e.metaKey) && e.key === "k";
      if (isCtrlK && lastSelectedText.length > 0) {
        e.preventDefault();
        log("Ctrl+K triggered Scribe (fallback)");
        castIntent("AI_TEXT_EDIT", { text: lastSelectedText });
      }
    });
  }

  // ---- Trigger button click handler ----
  document.addEventListener("DOMContentLoaded", function() {
    var btn = document.getElementById("scribe-trigger");
    if (btn) {
      btn.addEventListener("click", function() {
        if (lastSelectedText) {
          castIntent("AI_TEXT_EDIT", { text: lastSelectedText });
        }
      });
    }

    log("Plugin loaded, Scribe trigger ready");
    updateUI();
  });

})(window, undefined);
