/* global CropOverlay */

(function() {
  let captureSizeLimit = Math.pow(2, 13);
  let imageSizeLimit = Math.pow(2, 15) - 1;

  function getPageSize() {
    let root = document.documentElement;
    let body = document.body || root;
    return {
      width: Math.max(
        body.scrollWidth,
        body.offsetWidth,
        root.clientWidth,
        root.scrollWidth,
        root.offsetWidth
      ),
      height: Math.max(
        body.scrollHeight,
        body.offsetHeight,
        root.clientHeight,
        root.scrollHeight,
        root.offsetHeight
      )
    };
  }

  function getSize(message) {
    let rootScrollable = document.scrollingElement ||
      (document.compatMode === "BackCompat" ?
        document.body : document.documentElement);
    if (message.type === "entire") {
      let pixelRatio = window.devicePixelRatio || 1;
      let tileSize = Math.floor(captureSizeLimit / pixelRatio);
      let maximumSize = Math.floor(imageSizeLimit / pixelRatio);
      let pageSize = getPageSize();
      return {
        rect: {
          x: message.selected.x || 0,
          y: message.selected.y || 0,
          width: Math.min(message.selected.w || pageSize.width, maximumSize),
          height: Math.min(message.selected.h || pageSize.height, maximumSize)
        },
        tileSize
      };
    }

    return {
      rect: {
        x: rootScrollable.scrollLeft,
        y: rootScrollable.scrollTop,
        width: rootScrollable.clientWidth,
        height: rootScrollable.clientHeight
      }
    };
  }

  function handleRuntimeMessage(message, sender, sendResponse) {
    switch (message.type) {
      case "select":
        CropOverlay.init();
        CropOverlay.start();
        sendResponse({});
        return false;
      case "entire":
      case "visible": {
        CropOverlay.init();
        CropOverlay.cancel();

        sendResponse(getSize(message));
        return false;
      }
      case "ping":
        sendResponse({
          type: "pong"
        });
        return false;
      default:
        return false;
    }
  }

  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
})();
