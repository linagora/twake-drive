(function(window, undefined) {
  "use strict";

  window.Asc.plugin.init = function(data) {
    console.log(
      "[Scribe] Plugin loaded. Selection:",
      data ? data.substring(0, 80) : "(none)"
    );
  };

  window.Asc.plugin.button = function(id) {
    this.executeCommand("close", "");
  };

})(window, undefined);
