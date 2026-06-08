let prefsByCheckboxId = {
  "captureWholePage": "browserAction.captureWholePage",
  "openDirectory": "downloads.openDirectory"
};

let options = {
  handleEvent(evt) {
    switch (evt.type) {
      case "load":
        this.init();
        break;
      case "change":
        chrome.storage.local.set({
          [prefsByCheckboxId[evt.target.id]]: evt.target.checked
        });
        break;
      default:
        break;
    }
  },
  init() {
    document.title = chrome.i18n.getMessage("options_title");

    chrome.storage.local.get(Object.values(prefsByCheckboxId), function(results) {
      Object.keys(prefsByCheckboxId).forEach(function(id) {
        let checkbox = document.getElementById(id);
        document.getElementById(id + "-label").textContent =
          chrome.i18n.getMessage("options_" + id + "_label");
        checkbox.checked = (results[prefsByCheckboxId[id]] === true);
        checkbox.addEventListener("change", options);
      });
    });
  }
}

window.addEventListener("load", options);
