let browserActionActionKey = "browserAction.action";
let legacyCaptureWholePageKey = "browserAction.captureWholePage";
let browserActionActions = ["menu", "entire", "visible", "select"];
let modifierActionKey = "browserAction.modifierAction";
let modifierActions = ["none", "entire", "visible", "select"];
let filenamePrefixKey = "downloads.filenamePrefix";

let prefsByCheckboxId = {
  "openDirectory": "downloads.openDirectory",
  "playSounds": "sounds.enabled"
};

function normalizeFilenamePrefix(value) {
  let prefix = value.trim();
  prefix = Array.from(prefix, function(character) {
    let invalidCharacters = "<>:\"/\\|?*";
    if (character.charCodeAt(0) < 32 ||
        invalidCharacters.includes(character)) {
      return "-";
    }
    return character;
  }).join("").replace(/[. ]+$/, "");
  return prefix || chrome.i18n.getMessage("save_file_prefix");
}

function updateFilenameExample(prefix) {
  document.getElementById("filenamePrefix-example").textContent =
    chrome.i18n.getMessage("options_filenamePrefix_example", prefix);
}

function getBrowserActionAction(results) {
  if (browserActionActions.includes(results[browserActionActionKey])) {
    return results[browserActionActionKey];
  }
  if (results[legacyCaptureWholePageKey] === true) {
    return "entire";
  }
  return "menu";
}

function getModifierAction(action, browserActionAction) {
  if (modifierActions.includes(action) && action !== browserActionAction) {
    return action;
  }
  return modifierActions.find(function(value) {
    return value !== "none" && value !== browserActionAction;
  });
}

function updateModifierActions(browserActionAction, modifierAction) {
  let availableAction = getModifierAction(
    modifierAction,
    browserActionAction
  );
  modifierActions.forEach(function(value) {
    let radio = document.querySelector(
      `input[name="modifierAction"][value="${value}"]`);
    let hidden = value === browserActionAction;
    radio.closest("label").hidden = hidden;
    radio.disabled = hidden;
    radio.checked = value === availableAction;
  });
  return availableAction;
}

let options = {
  handleEvent(evt) {
    switch (evt.type) {
      case "load":
        this.init();
        break;
      case "change":
        if (evt.target.name === "browserActionAction") {
          let modifierRadio = document.querySelector(
            'input[name="modifierAction"]:checked');
          let modifierAction = updateModifierActions(
            evt.target.value,
            modifierRadio.value
          );
          chrome.storage.local.set({
            [browserActionActionKey]: evt.target.value,
            [modifierActionKey]: modifierAction
          });
          break;
        }
        if (evt.target.name === "modifierAction") {
          chrome.storage.local.set({
            [modifierActionKey]: evt.target.value
          });
          break;
        }
        if (evt.target.id === "filenamePrefix") {
          let prefix = normalizeFilenamePrefix(evt.target.value);
          evt.target.value = prefix;
          updateFilenameExample(prefix);
          chrome.storage.local.set({
            [filenamePrefixKey]: prefix
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
      modifierActionKey,
      filenamePrefixKey,
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

      let modifierAction = modifierActions.includes(
        results[modifierActionKey]
      ) ? results[modifierActionKey] : "visible";
      document.getElementById("modifierAction-label").textContent =
        chrome.i18n.getMessage("options_modifierAction_label");
      modifierActions.forEach(function(value) {
        let radio = document.querySelector(
          `input[name="modifierAction"][value="${value}"]`);
        let messageName = value === "none" ?
          "options_modifierAction_none" : "action_" + value;
        document.getElementById(
          "modifierAction-" + value + "-label").textContent =
          chrome.i18n.getMessage(messageName);
        radio.addEventListener("change", options);
      });
      let availableModifierAction = updateModifierActions(
        action,
        modifierAction
      );
      if (availableModifierAction !== modifierAction) {
        chrome.storage.local.set({
          [modifierActionKey]: availableModifierAction
        });
      }

      let filenamePrefix = document.getElementById("filenamePrefix");
      filenamePrefix.value = normalizeFilenamePrefix(
        results[filenamePrefixKey] || ""
      );
      document.getElementById("filenamePrefix-label").textContent =
        chrome.i18n.getMessage("options_filenamePrefix_label");
      updateFilenameExample(filenamePrefix.value);
      filenamePrefix.addEventListener("change", options);

      Object.keys(prefsByCheckboxId).forEach(function(id) {
        let checkbox = document.getElementById(id);
        document.getElementById(id + "-label").textContent =
          chrome.i18n.getMessage("options_" + id + "_label");
        checkbox.checked = id === "playSounds" ?
          results[prefsByCheckboxId[id]] !== false :
          results[prefsByCheckboxId[id]] === true;
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
