let browserActionActionKey = "browserAction.action";
let legacyCaptureWholePageKey = "browserAction.captureWholePage";
let browserActionActions = ["menu", "entire", "visible", "select"];

let prefsByCheckboxId = {
  "openDirectory": "downloads.openDirectory"
};

function getBrowserActionAction(results) {
  if (browserActionActions.includes(results[browserActionActionKey])) {
    return results[browserActionActionKey];
  }
  if (results[legacyCaptureWholePageKey] === true) {
    return "entire";
  }
  return "menu";
}

let options = {
  handleEvent(evt) {
    switch (evt.type) {
      case "load":
        this.init();
        break;
      case "change":
        if (evt.target.name === "browserActionAction") {
          chrome.storage.local.set({
            [browserActionActionKey]: evt.target.value
          });
          break;
        }
        chrome.storage.local.set({
          [prefsByCheckboxId[evt.target.id]]: evt.target.checked
        });
        break;
      case "click":
        browser.commands.openShortcutSettings();
        break;
      default:
        break;
    }
  },
  init() {
    document.title = chrome.i18n.getMessage("options_title");

    chrome.storage.local.get([
      browserActionActionKey,
      legacyCaptureWholePageKey,
      ...Object.values(prefsByCheckboxId)
    ], function(results) {
      let action = getBrowserActionAction(results);
      document.getElementById("browserActionAction-label").textContent =
        chrome.i18n.getMessage("options_browserActionAction_label");
      browserActionActions.forEach(function(value) {
        let radio = document.querySelector(
          `input[name="browserActionAction"][value="${value}"]`);
        let messageName = value === "menu" ?
          "options_browserActionAction_menu" : "action_" + value;
        document.getElementById(
          "browserActionAction-" + value + "-label").textContent =
          chrome.i18n.getMessage(messageName);
        radio.checked = (value === action);
        radio.addEventListener("change", options);
      });

      Object.keys(prefsByCheckboxId).forEach(function(id) {
        let checkbox = document.getElementById(id);
        document.getElementById(id + "-label").textContent =
          chrome.i18n.getMessage("options_" + id + "_label");
        checkbox.checked = (results[prefsByCheckboxId[id]] === true);
        checkbox.addEventListener("change", options);
      });

      let manageShortcuts = document.getElementById("manageShortcuts");
      manageShortcuts.textContent =
        chrome.i18n.getMessage("options_manageShortcuts_label");
      manageShortcuts.addEventListener("click", options);
    });
  }
}

window.addEventListener("load", options);
