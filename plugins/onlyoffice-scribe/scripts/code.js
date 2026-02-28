(function(window, undefined) {
  "use strict";

  // ---- State ----
  var lastSelectedText = "";
  var logMessages = [];

  // ---- Helper: log(msg) ----
  function log(msg) {
    console.log("[Scribe] " + msg);
    logMessages.push(timestamp() + " " + msg);
    if (logMessages.length > 10) {
      logMessages.shift();
    }
    var el = document.getElementById("log-output");
    if (el) {
      el.textContent = logMessages.join("\n");
      el.scrollTop = el.scrollHeight;
    }
  }

  function timestamp() {
    var d = new Date();
    return d.getHours().toString().padStart(2, "0") + ":" +
           d.getMinutes().toString().padStart(2, "0") + ":" +
           d.getSeconds().toString().padStart(2, "0");
  }

  // ---- Helper: mockTransform(text) -- MOCK-01 ----
  function mockTransform(text) {
    var lines = text.split("\n");
    var prefixed = [];
    for (var i = 0; i < lines.length; i++) {
      prefixed.push("$ " + lines[i]);
    }
    return "--- SCRIBE START ---\n" + prefixed.join("\n") + "\n--- SCRIBE END ---";
  }

  // ---- Helper: updateUI() ----
  function updateUI() {
    var selEl = document.getElementById("selected-text");
    var dotEl = document.getElementById("status-dot");
    var statusEl = document.getElementById("status-text");
    var btnReplace = document.getElementById("btn-replace");
    var btnInsert = document.getElementById("btn-insert");

    if (selEl) {
      selEl.textContent = lastSelectedText || "(no selection)";
    }

    var hasSelection = lastSelectedText.length > 0;

    if (dotEl) {
      if (hasSelection) {
        dotEl.classList.add("active");
      } else {
        dotEl.classList.remove("active");
      }
    }
    if (statusEl) {
      statusEl.textContent = hasSelection ? "Selection active" : "No selection";
    }
    if (btnReplace) {
      btnReplace.disabled = !hasSelection;
    }
    if (btnInsert) {
      btnInsert.disabled = !hasSelection;
    }
  }

  // ---- PLUG-02: Selection detection (via init) ----
  window.Asc.plugin.init = function(data) {
    lastSelectedText = data || "";
    log("Selection: " + (lastSelectedText ? lastSelectedText.substring(0, 80) + "..." : "(none)"));
    updateUI();
  };

  // ---- Required: button handler ----
  window.Asc.plugin.button = function(id) {
    this.executeCommand("close", "");
  };

  // ---- PLUG-03: Read selected text (explicit via GetSelectedText) ----
  function readSelection() {
    log("Reading selection via GetSelectedText...");
    window.Asc.plugin.executeMethod("GetSelectedText", [{
      Numbering: false,
      Math: false,
      TableCellSeparator: "\n",
      ParaSeparator: "\n",
      TabSymbol: String.fromCharCode(9)
    }], function(text) {
      lastSelectedText = text || "";
      log("GetSelectedText result: " + (lastSelectedText ? lastSelectedText.substring(0, 80) : "(empty)"));
      updateUI();
    });
  }

  // ---- PLUG-04: Replace selected text ----
  function replaceWithMock() {
    if (!lastSelectedText) {
      log("No selection to replace");
      return;
    }
    var transformed = mockTransform(lastSelectedText);
    log("Replacing selection with mock transform...");
    window.Asc.plugin.executeMethod("PasteText", [transformed]);
    log("PasteText called");
  }

  // ---- PLUG-05: Insert text after selection ----
  // InsertContent replaces the selection, so we re-create the original
  // paragraphs and append the new text after them.
  function insertAfterSelection() {
    if (!lastSelectedText) {
      log("No selection for insert");
      return;
    }
    var transformed = mockTransform(lastSelectedText);
    log("Inserting mock transform after selection...");
    Asc.scope.textToInsert = transformed;
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
      // Add transformed text as new paragraph after original
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
    log("callCommand dispatched for InsertContent");
  }

  // ---- Context menu: show "Scribe" when text selected ----
  window.Asc.plugin.event_onContextMenuShow = function(options) {
    if (options.type === "Selection") {
      this.executeMethod("AddContextMenuItem", [{
        guid: this.guid,
        items: [{
          id: "onClickScribe",
          text: {
            en: "Scribe - AI Assistant",
            fr: "Scribe - Assistant IA"
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
      // Send to Cozy Drive host
      window.top.postMessage({
        type: "scribe:selection-ready",
        source: "scribe-plugin",
        payload: { text: lastSelectedText }
      }, "*"); // TODO: restrict origin in production
    });
  });

  // ---- Wire button click handlers ----
  document.addEventListener("DOMContentLoaded", function() {
    var btnRead = document.getElementById("btn-read");
    var btnReplace = document.getElementById("btn-replace");
    var btnInsert = document.getElementById("btn-insert");

    if (btnRead) {
      btnRead.addEventListener("click", readSelection);
    }
    if (btnReplace) {
      btnReplace.addEventListener("click", replaceWithMock);
    }
    if (btnInsert) {
      btnInsert.addEventListener("click", insertAfterSelection);
    }

    log("Plugin loaded, test panel ready");
    updateUI();
  });

})(window, undefined);
