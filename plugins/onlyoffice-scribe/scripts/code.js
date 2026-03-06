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
    log("Intent cast: " + action + " id=" + intentId + (oneWay ? " (one-way)" : ""));

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

  // Build AI_TEXT_EDIT intent data with optional HTML field (EXTR-02)
  function buildEditIntentData() {
    var data = { text: lastSelectedText };
    if (lastSelectedHtml && lastSelectedHtml.length > 0) {
      data.html = lastSelectedHtml;
      data.format = "html";
    }
    return data;
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

  // ---- Trigger-intent listener (host -> plugin) ----
  // Cozy Drive sends trigger-intent to ask the plugin to cast an AI_TEXT_EDIT intent
  window.addEventListener("message", function(event) {
    var msg = event.data;
    if (!msg || msg.type !== "cozy-bridge:trigger-intent") return;

    if (msg.action === "AI_TEXT_EDIT" && lastSelectedText.length > 0) {
      log("Trigger-intent received, casting AI_TEXT_EDIT");
      castIntent("AI_TEXT_EDIT", buildEditIntentData());
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
    log("init() called");

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
      log("Context menu read: " + (lastSelectedText ? lastSelectedText.substring(0, 80) : "(empty)"));
      // Use stored HTML from latest init() call
      castIntent("AI_TEXT_EDIT", buildEditIntentData());
    });
  });

  // ---- Ctrl+I / Cmd+K shortcut for Scribe ----
  try {
    window.parent.document.addEventListener("keydown", function(e) {
      var isCtrlK = (e.ctrlKey || e.metaKey) && e.key === "i";
      if (isCtrlK && lastSelectedText.length > 0) {
        e.preventDefault();
        log("Ctrl+I triggered Scribe");
        castIntent("AI_TEXT_EDIT", buildEditIntentData());
      }
    });
    log("Ctrl+I shortcut registered on parent document");
  } catch (e) {
    log("Cannot register Ctrl+I on parent document: " + e.message);
    // Fallback: register on plugin's own document (limited, but still useful)
    document.addEventListener("keydown", function(e) {
      var isCtrlK = (e.ctrlKey || e.metaKey) && e.key === "i";
      if (isCtrlK && lastSelectedText.length > 0) {
        e.preventDefault();
        log("Ctrl+I triggered Scribe (fallback)");
        castIntent("AI_TEXT_EDIT", buildEditIntentData());
      }
    });
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
      log("Toolbar button clicked (attachEvent)");
      triggerScribeIfSelection();
    });

    log("Toolbar button added");
  }

  // Fallback: global toolbar click event
  window.Asc.plugin.event_onToolbarMenuClick = function(id) {
    log("Toolbar menu click event: " + id);
    if (id === "scribeToolbarBtn") {
      triggerScribeIfSelection();
    }
  };

  function triggerScribeIfSelection() {
    if (lastSelectedText.length > 0) {
      castIntent("AI_TEXT_EDIT", buildEditIntentData());
    } else {
      log("No text selected — toolbar click ignored");
    }
  }

  document.addEventListener("DOMContentLoaded", function() {
    log("Plugin loaded, Scribe trigger ready");
  });

})(window, undefined);
