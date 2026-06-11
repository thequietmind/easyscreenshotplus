let blobUrisByDownloadId = new Map();
let dataUrisByTabId = new Map();
let tabIdByDownloadId = new Map();
let tabIdByEditorId = new Map();
let browserActionActionKey = "browserAction.action";
let legacyCaptureWholePageKey = "browserAction.captureWholePage";
let browserActionActions = ["menu", "entire", "visible", "select"];
let browserActionAction = "menu";
let modifierActionKey = "browserAction.modifierAction";
let modifierActions = ["none", "entire", "visible", "select"];
let modifierAction = "visible";
let soundsEnabledKey = "sounds.enabled";
let soundsEnabled = true;

function dataUriToBlob(dataUri) {
  const binary = atob(dataUri.split(",", 2)[1]);
  const data = Uint8Array.from(binary, char => char.charCodeAt(0));
  const blob = new Blob([data], {type: "image/png"});
  return blob;
}

function formatTimestamp(date) {
  let pad = n => String(n).padStart(2, "0");
  let day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  let hours = date.getHours();
  let suffix = hours < 12 ? "AM" : "PM";
  let hour12 = (hours % 12) || 12;
  let time = `${hour12}.${pad(date.getMinutes())}.${pad(date.getSeconds())} ${suffix}`;
  return `${day} at ${time}`;
}

function playSound(id) {
  if (!soundsEnabled) {
    return;
  }
  document.getElementById(id).play();
}

function getSnapshot(message, tab, sendResponse) {
  switch (message.action) {
    case "select":
      chrome.tabs.sendMessage(tab.id, {
        type: "select"
      }, undefined, sendResponse);
      break;
    case "entire":
    case "visible":
      chrome.tabs.sendMessage(tab.id, {
        type: message.action,
        selected: (message.selected || {})
      }, function(options) {
        browser.tabs.captureTab(tab.id, options).then(dataUri => {
          onCaptureEnded(tab.id, dataUri);
        });
      });
      break;
    default:
      break;
  }
}

function handleAction(message, sendResponse) {
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function(tabs) {
    if (tabs.length < 1) {
      sendResponse({
        error: "No active tab in currentWindow?"
      });
      return;
    }
    if (tabs.length > 1) {
      console.error(tabs);
    }

    getSnapshot(message, tabs[0], sendResponse);
  });
}

function handleCommand(cmd) {
  if (!cmd.startsWith("ess-")) {
    return;
  }

  let action = cmd.slice("ess-".length);
  if (action === "menu") {
    openCaptureMenu();
    return;
  }

  handleAction({action}, response => {
    if (response && response.error) {
      console.error(response.error);
    } else {
      console.log(response);
    }
  });
}

function handleDownloadChange(downloadDelta) {
  if (!blobUrisByDownloadId.has(downloadDelta.id)) {
    return;
  }

  if (!downloadDelta.state ||
      downloadDelta.state.current === "in_progress") {
    return;
  }

  URL.revokeObjectURL(blobUrisByDownloadId.get(downloadDelta.id));
  blobUrisByDownloadId.delete(downloadDelta.id);
  chrome.tabs.remove(tabIdByDownloadId.get(downloadDelta.id), function() {
    tabIdByDownloadId.delete(downloadDelta.id);
  });

  if (downloadDelta.state.current === "interrupt") {
    notify(chrome.i18n.getMessage("save_failure"));
    return;
  }
  playSound("sound-export");
  chrome.downloads.search({
    id: downloadDelta.id
  }, function(results) {
    notify(chrome.i18n.getMessage("save_success"),
           (results.length && results[0].filename));
  });

  chrome.storage.local.get(["downloads.openDirectory"], function(results) {
    if (results["downloads.openDirectory"] !== true) {
      return;
    }

    chrome.downloads.show(downloadDelta.id);
  });
}

function handlePopupAction(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case "select":
      case "entire":
      case "visible":
        handleAction(message, sendResponse);
        return true;
      default:
        return false;
    }
  } catch (ex) {
    sendResponse({
      error: ex.message
    });
    return false;
  }
}

function handleRuntimeMessage(message, sender, sendResponse) {
  if (["content2bg",
       "editor2bg",
       "popup2bg"].indexOf(message.dir) < 0) {
    return;
  }
  console.log(message);
  switch (message.type) {
    case "copy_image": {
      let msgKey = message.failed ? "copy_failure" : "copy_success";
      notify(chrome.i18n.getMessage(msgKey));
      chrome.tabs.remove(sender.tab.id);
      playSound("sound-export");
      break;
    }
    case "download": {
      let timestamp = formatTimestamp(new Date());
      // save in an alternative folder ?
      let filename = chrome.i18n.getMessage("save_file_name", timestamp);
      let blob = dataUriToBlob(message.url);
      let url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url,
        incognito: sender.tab.incognito,
        filename,
        conflictAction: "uniquify"
      }, function(downloadId) {
        blobUrisByDownloadId.set(downloadId, url);
        tabIdByDownloadId.set(downloadId, sender.tab.id);
      });
      break;
    }
    case "editor_ready": {
      let tabId = tabIdByEditorId.get(sender.tab.id);
      if (!tabId) {
        break;
      }
      let dataUri = dataUrisByTabId.get(tabId);
      if (!dataUri) {
        break;
      }
      sendResponse({ dataUri });
      dataUrisByTabId.delete(tabId);
      tabIdByEditorId.delete(sender.tab.id);
      playSound("sound-capture");
      break;
    }
    case "popup_action":
      handlePopupAction(message, sender, sendResponse);
      break;
    case "removetab":
      chrome.tabs.remove(sender.tab.id);
      break;
    default:
      break;
  }
}

function notify(title, text) {
  chrome.notifications.create({
    "type": "basic",
    "iconUrl": "icons/icon-48.png", // ?
    "title": (title || ""),
    "message": (text || "")
  });
}

function onCaptureEnded(tabId, dataUri) {
  try {
    dataUrisByTabId.set(tabId, dataUri);

    chrome.tabs.create({
      openerTabId: tabId,
      url: chrome.runtime.getURL("editor/page.html")
    }, function(tab) {
      tabIdByEditorId.set(tab.id, tabId);
    });
  } catch (ex) {
    console.error(ex);
  }
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

function getModifierAction(action) {
  if (modifierActions.includes(action) && action !== browserActionAction) {
    return action;
  }
  return modifierActions.find(function(value) {
    return value !== "none" && value !== browserActionAction;
  });
}

function applyBrowserActionAction(action) {
  browserActionAction = browserActionActions.includes(action) ? action : "menu";
  modifierAction = getModifierAction(modifierAction);
  chrome.browserAction.setPopup({
    popup: ""
  });
}

function openCaptureMenu() {
  browser.browserAction.setPopup({
    popup: "/popup/page.html"
  }).then(() => browser.browserAction.openPopup())
    .catch(error => {
      console.error("Easy Screenshot Plus: failed to open capture menu", error);
    }).finally(() => {
      applyBrowserActionAction(browserActionAction);
    });
}

function hasAlternateActionModifier(clickData) {
  return clickData.modifiers.includes("Command") ||
    clickData.modifiers.includes("Ctrl");
}

function runToolbarAction(action) {
  if (action === "menu") {
    openCaptureMenu();
    return;
  }

  handleAction({action}, function(response) {
    if (response && response.error) {
      console.error(response.error);
    }
  });
}

chrome.commands.onCommand.addListener(handleCommand);
chrome.downloads.onChanged.addListener(handleDownloadChange);
chrome.runtime.onMessage.addListener(handleRuntimeMessage);

chrome.browserAction.onClicked.addListener(function(tab, clickData) {
  let action = browserActionAction;
  if (modifierAction !== "none" && hasAlternateActionModifier(clickData)) {
    action = modifierAction;
  }
  runToolbarAction(action);
});

applyBrowserActionAction(browserActionAction);

chrome.storage.local.get([
  browserActionActionKey,
  legacyCaptureWholePageKey,
  modifierActionKey,
  soundsEnabledKey
], function(results) {
  applyBrowserActionAction(getBrowserActionAction(results));
  modifierAction = getModifierAction(results[modifierActionKey]);
  soundsEnabled = results[soundsEnabledKey] !== false;
});

chrome.storage.onChanged.addListener(function(changes, area) {
  if (area !== "local") {
    return;
  }
  if (changes[soundsEnabledKey]) {
    soundsEnabled = changes[soundsEnabledKey].newValue !== false;
  }
  if (changes[modifierActionKey]) {
    modifierAction = getModifierAction(changes[modifierActionKey].newValue);
  }
  if (changes[browserActionActionKey]) {
    applyBrowserActionAction(changes[browserActionActionKey].newValue);
    return;
  }
  if (changes[legacyCaptureWholePageKey] &&
      changes[legacyCaptureWholePageKey].newValue === true) {
    applyBrowserActionAction("entire");
    return;
  }
  if (changes[legacyCaptureWholePageKey]) {
    applyBrowserActionAction("menu");
  }
});

let menus = browser.menus || browser.contextMenus || chrome.contextMenus;
if (menus) {
  try {
    menus.create({
      id: "ess-settings",
      title: chrome.i18n.getMessage("action_settings"),
      contexts: ["browser_action"]
    });
  } catch (ex) {
    console.error("Easy Screenshot Plus: failed to create settings menu", ex);
  }
  menus.onClicked.addListener(function(info) {
    if (info.menuItemId === "ess-settings") {
      chrome.runtime.openOptionsPage();
    }
  });
} else {
  console.error("Easy Screenshot Plus: menus API unavailable " +
                "(is the \"menus\" permission granted?)");
}
console.log("background.js loaded");
