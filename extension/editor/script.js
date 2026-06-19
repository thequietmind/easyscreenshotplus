/* global Annotations, CropOverlay, Utils */

var EditorCropOverlay = {
  __proto__: CropOverlay,
  _i18nInstructionId: "editor_crop_instruction",
  _dblclick() {
    this.stop();
  },
  _keydown(evt) {
    if (evt.keyCode == evt.DOM_VK_ESCAPE) {
      Editor.current = {id: "select"};
    } else if (evt.keyCode == evt.DOM_VK_RETURN) {
      this.stop();
    }
  },
  _resize() {
    var rect = Editor.canvas.getBoundingClientRect();
    this._overlay.overlay.style.left = rect.left + window.scrollX + "px";
    this._overlay.overlay.style.top = rect.top + window.scrollY + "px";
  },
  stop() {
    var crop = Utils.parse(this._overlay.target);
    if (!crop.w || !crop.h) {
      return;
    }
    this.cancel();
    Editor.crop(crop);
    Editor.current = {id: "select"};
  }
};

function selectedStyleAnnotation() {
  if (Editor.current && Editor.current.id == "button-select") {
    return Editor.selectedAnnotation;
  }
  return null;
}

var BaseControl = {
  get lineWidth() {
    var selected = selectedStyleAnnotation();
    if (selected && selected.type != "text") {
      return selected.lineWidth;
    }
    return Editor.prefs["editor.lineWidth"];
  },
  set lineWidth(value) {
    Editor.setStyle("lineWidth", Number(value));
  },
  get fontSize() {
    var selected = selectedStyleAnnotation();
    if (selected && selected.type == "text") {
      return selected.fontSize;
    }
    return Editor.prefs["editor.fontSize"];
  },
  set fontSize(value) {
    Editor.setStyle("fontSize", Number(value));
  },
  get color() {
    var selected = selectedStyleAnnotation();
    if (selected) {
      return selected.color;
    }
    return Editor.prefs["editor.color"];
  },
  set color(value) {
    Editor.setStyle("color", value);
  }
};

var Line = {
  get arrowMode() {
    var selected = selectedStyleAnnotation();
    if (selected && selected.type == "line") {
      return selected.arrowMode;
    }
    return Editor.prefs["editor.lineArrows"];
  },
  set arrowMode(value) {
    if (["none", "end", "both"].indexOf(value) >= 0) {
      Editor.setStyle("lineArrows", value);
    }
  }
};

var BarPopup = {
  get visible() {
    return this._ele.style.display != "none";
  },
  set visible(value) {
    this.toggle(value);
    this._anchor.toggle(value);
  },
  show() {
    this.toggle(true);
  },
  hide() {
    this.toggle(false);
  },
  toggle(toShow) {
    if (toShow === undefined) {
      toShow = !this.visible;
    }
    this._ele.style.display = toShow ? "block" : "none";
    document[toShow ? "addEventListener" : "removeEventListener"](
      "click",
      this._listeners.hide
    );
  }
};

var ColorPicker = {
  __proto__: BarPopup,
  _ele: null,
  _anchor: null,
  _listeners: {},
  init() {
    this._listeners.hide = () => this.visible = false;
    this._ele = Utils.qs("#colorpicker");
    this._ele.addEventListener("click", this.click.bind(this));
    [].forEach.call(this._ele.querySelectorAll("li"), function(li) {
      li.style.backgroundColor = li.dataset.color;
    });
  },
  click(evt) {
    if (evt.target.nodeName.toLowerCase() == "li") {
      BaseControl.color = evt.target.dataset.color;
    }
  }
};

var FontSelect = {
  __proto__: BarPopup,
  _ele: null,
  _anchor: null,
  _listeners: {},
  init() {
    this._listeners.hide = () => this.visible = false;
    this._ele = Utils.qs("#fontselect");
    this._ele.addEventListener("click", this.click.bind(this));
  },
  click(evt) {
    if (evt.target.nodeName.toLowerCase() == "li") {
      BaseControl.fontSize = Number(evt.target.textContent);
    }
  }
};

var BarItem = function(options) {
  Utils.extend(this, options);
  Utils.assert(this.id, "id is mandatory");
  Utils.assert(this._refresh, "_refresh method is mandatory");
  Utils.assert(this.click, "click method is mandatory");
  this._ele = Utils.qs("#button-" + this.id);
  this._ele.setAttribute(
    "title",
    chrome.i18n.getMessage("editor_" + this.id + "_tooltip")
  );
  this._init();
};

BarItem.prototype = {
  _init() {
    this.refresh = (function(changes, area) {
      var prefId = "editor." + this.id;
      if (area != "local" || !changes[prefId]) {
        return;
      }
      Editor.prefs[prefId] = changes[prefId].newValue;
      this._refresh();
    }).bind(this);
    this._refresh();
    chrome.storage.onChanged.addListener(this.refresh);
    this._ele.addEventListener("click", this.click.bind(this));
    this._initPopup();
  },
  uninit() {
    chrome.storage.onChanged.removeListener(this.refresh);
  },
  _initPopup() {
    if (this._popup) {
      this._popup.init();
      this._popup._anchor = this;
      this._ele.appendChild(this._popup._ele);
    }
  },
  get pressed() {
    return this._ele.classList.contains("current");
  },
  set pressed(value) {
    this.toggle(value);
    if (this._popup) {
      this._popup.toggle(value);
    }
  },
  toggle(toPress) {
    if (toPress === undefined) {
      toPress = !this.pressed;
    }
    this._ele.classList[toPress ? "add" : "remove"]("current");
  }
};

var Floatbar = {
  _ele: null,
  items: {},
  anchorEle: null,
  init() {
    this._ele = Utils.qs("#floatbar");
    this.items = {
      lineWidth: new BarItem({
        id: "lineWidth",
        _refresh() {
          Array.prototype.forEach.call(
            this._ele.getElementsByTagName("li"),
            function(li) {
              li.classList[
                li.value == BaseControl.lineWidth ? "add" : "remove"
              ]("current");
            }
          );
        },
        click(evt) {
          if (evt.target.nodeName.toLowerCase() == "li") {
            BaseControl.lineWidth = evt.target.value;
          }
        }
      }),
      lineArrows: new BarItem({
        id: "lineArrows",
        _refresh() {
          Array.prototype.forEach.call(
            this._ele.querySelectorAll("li"),
            function(li) {
              li.classList[
                li.dataset.value == Line.arrowMode ? "add" : "remove"
              ]("current");
            }
          );
        },
        click(evt) {
          var option = evt.target.closest("li[data-value]");
          if (option && this._ele.contains(option)) {
            Line.arrowMode = option.dataset.value;
          }
        }
      }),
      fontSize: new BarItem({
        id: "fontSize",
        _popup: FontSelect,
        _refresh() {
          this._ele.firstChild.textContent = BaseControl.fontSize + " px";
        },
        click(evt) {
          Floatbar.pressItem(this);
          evt.stopPropagation();
        }
      }),
      color: new BarItem({
        id: "color",
        _popup: ColorPicker,
        _refresh() {
          this._ele.firstChild.style.backgroundColor = BaseControl.color;
        },
        click(evt) {
          Floatbar.pressItem(this);
          evt.stopPropagation();
        }
      })
    };
    window.addEventListener("resize", this);
  },
  handleEvent(evt) {
    if (evt.type == "resize") {
      this.reposition();
    }
  },
  reposition() {
    if (this.anchorEle) {
      this._ele.style.left = this.anchorEle.getBoundingClientRect().left + "px";
    }
  },
  show(buttonEle, itemsToShow) {
    if (buttonEle) {
      this.anchorEle = buttonEle;
      this.reposition();
    }
    this._ele.style.display = "block";
    Object.keys(this.items).forEach(function(id) {
      this.items[id]._ele.style.display =
        itemsToShow.indexOf(id) >= 0 ? "inline-block" : "none";
      this.items[id]._refresh();
    }, this);
  },
  hide() {
    this._ele.style.display = "none";
  },
  pressItem(item) {
    var id;
    for (id in this.items) {
      if (this.items[id].id != item.id) {
        this.items[id].pressed = false;
      }
    }
    item.pressed = !item.pressed;
  }
};

var Button = function(options) {
  Utils.extend(this, options);
  Utils.assert(this.id, "id is mandatory");
  Utils.assert(this.key, "key is mandatory");
  this._ele = Utils.qs("#button-" + this.id);
  this._ele.setAttribute(
    "title",
    chrome.i18n.getMessage("editor_" + this.id + "_tooltip") +
      " (" + this.key + ")"
  );
};

Button.prototype = {
  start() {
    this._ele.classList.add("current");
    Editor._current = this._ele;
    Editor.canvas.className = this.id + "canvas";
    Editor.selection.className = this.id + "canvas";
    Editor.selection.style.pointerEvents = this.id == "select" ? "auto" : "none";
    if (this.id == "select") {
      Editor.refreshSelectionFloatbar();
    } else if (this.floatbar) {
      Floatbar.show(this._ele, this.floatbar);
    } else {
      Floatbar.hide();
    }
    if (this.id == "crop") {
      var rect = Editor.canvas.getBoundingClientRect();
      EditorCropOverlay.start(
        rect.left + window.scrollX,
        rect.top + window.scrollY,
        Editor.canvas.width,
        Editor.canvas.height
      );
    }
  },
  finish: Utils.emptyFunction,
  clear() {
    this._ele.classList.remove("current");
    if (this.id == "crop") {
      EditorCropOverlay.cancel();
    }
    Editor.canvas.className = "";
    Editor.selection.className = "";
    Editor.selection.style.pointerEvents = "none";
    Floatbar.hide();
  }
};

var TextInput = {
  _input: null,
  _annotationId: null,
  _original: null,
  _canceling: false,
  _creating: false,
  init() {
    this._input = Utils.qs("#textinput");
    this._input.wrap = "off";
    this._input.addEventListener("blur", this.commit.bind(this));
    this._input.addEventListener("keydown", this.keydown.bind(this));
    this._input.addEventListener("input", this.resize.bind(this));
    this._input.addEventListener("scroll", function() {
      this.scrollTop = 0;
      this.scrollLeft = 0;
    });
  },
  get active() {
    return this._input.style.display == "block";
  },
  open(point, annotation) {
    var rect = Editor.canvas.getBoundingClientRect();
    var fontSize = annotation ? annotation.fontSize : BaseControl.fontSize;
    this._annotationId = annotation ? annotation.id : null;
    this._original = annotation ? Annotations.clone(annotation) : null;
    this._creating = !annotation;
    this._canceling = false;
    this._input.value = annotation ? annotation.text : "";
    this._input.style.color = annotation ? annotation.color : BaseControl.color;
    this._input.style.fontSize = fontSize + "px";
    this._input.style.left =
      rect.left + window.scrollX + point.x + "px";
    this._input.style.top =
      rect.top + window.scrollY + point.y + "px";
    this._input.style.borderColor = Utils.hex2rgba(
      annotation ? annotation.color : BaseControl.color,
      0.5
    );
    this._input.style.display = "block";
    this.resize();
    this._input.focus();
    if (annotation) {
      this._input.select();
    }
  },
  resize() {
    this._input.style.width = "40px";
    this._input.style.height = "22px";
    this._input.style.width = Math.max(40, this._input.scrollWidth) + "px";
    this._input.style.height = Math.max(22, this._input.scrollHeight) + "px";
  },
  keydown(evt) {
    if (evt.key == "Escape") {
      this._canceling = true;
      evt.preventDefault();
      this._input.blur();
    } else if (evt.ctrlKey && evt.key == "Enter") {
      evt.preventDefault();
      this._input.blur();
    }
  },
  commit() {
    var value;
    var annotation;
    var point;
    if (!this.active) {
      return;
    }
    value = this._input.value;
    if (!this._canceling) {
      if (this._creating) {
        if (!/^\s*$/.test(value)) {
          point = Editor.pagePoint({
            pageX: parseFloat(this._input.style.left),
            pageY: parseFloat(this._input.style.top)
          });
          annotation = Editor.createTextAnnotation(
            value,
            point.x,
            point.y,
            BaseControl.color,
            BaseControl.fontSize
          );
          Editor.annotations.push(annotation);
          Editor.selectedAnnotationId = annotation.id;
          Editor.commitVector();
        }
      } else {
        annotation = Editor.annotationById(this._annotationId);
        if (annotation) {
          if (/^\s*$/.test(value)) {
            Editor.removeAnnotation(annotation.id);
            Editor.commitVector();
          } else {
            annotation.text = value;
            Editor.measureText(annotation);
            if (JSON.stringify(this._original) != JSON.stringify(annotation)) {
              Editor.commitVector();
            }
          }
        }
      }
    }
    this._input.style.display = "none";
    this._annotationId = null;
    this._original = null;
    this._creating = false;
    this._canceling = false;
    Editor.current = {id: "select"};
    Editor.render();
  }
};

const HISTORY_LENGTH_MAX = 50;
var Editor = {
  _canvas: null,
  _ctx: null,
  _baseCanvas: null,
  _baseCtx: null,
  _selection: null,
  _selectionCtx: null,
  _current: null,
  _history: [],
  _baseData: null,
  _nextAnnotationId: 1,
  _pointer: null,
  _preview: null,
  _inited: false,
  annotations: [],
  selectedAnnotationId: null,
  buttons: {},
  prefs: {
    "editor.lineWidth": 6,
    "editor.lineArrows": "end",
    "editor.fontSize": 18,
    "editor.color": "#FF0000"
  },
  get canvas() {
    return this._canvas;
  },
  get ctx() {
    return this._ctx;
  },
  get selection() {
    return this._selection;
  },
  get selectedAnnotation() {
    return this.annotationById(this.selectedAnnotationId);
  },
  get current() {
    return this._current;
  },
  set current(newCurrent) {
    var oldId = this._current ? this._getID(this._current) : "";
    var newId = newCurrent ? this._getID(newCurrent) : "";
    var oldButton = oldId ? this.buttons[oldId] : null;
    var newButton = newId ? this.buttons[newId] : null;

    if (newButton && newButton.simple) {
      newButton.start();
      return;
    }
    if (oldButton && !oldButton.simple) {
      oldButton.clear();
    }
    if (newButton) {
      newButton.start();
    }
  },
  init(img) {
    this._canvas = Utils.qs("#display");
    this._ctx = this._canvas.getContext("2d");
    this._selection = Utils.qs("#selection");
    this._selectionCtx = this._selection.getContext("2d");
    this._baseCanvas = document.createElement("canvas");
    this._baseCtx = this._baseCanvas.getContext("2d");
    try {
      this._baseCanvas.width = img.width;
      this._baseCanvas.height = img.height;
      this._baseCtx.drawImage(img, 0, 0);
    } catch (ex) {
      ["fontselect", "floatbar", "textinput"].forEach(function(id) {
        Utils.qs("#" + id).style.display = "none";
      });
      console.error(ex);
      window.location.href = chrome.i18n.getMessage("feedbackUrl");
      return;
    }
    this._baseData = this._baseCtx.getImageData(
      0,
      0,
      this._baseCanvas.width,
      this._baseCanvas.height
    );
    this._setupToolbar();
    Floatbar.init();
    TextInput.init();
    EditorCropOverlay.init();
    this._setupEvents();
    this.pushHistory();
    this._disableUndo();
    this.current = {id: "select"};
    this.render();
    this._inited = true;
  },
  _setupEvents() {
    this._canvas.addEventListener("mousedown", this.startDrawing.bind(this));
    this._selection.addEventListener("mousedown", this.startSelection.bind(this));
    this._selection.addEventListener("mousemove", this.hoverSelection.bind(this));
    this._selection.addEventListener("dblclick", this.editSelectedText.bind(this));
    window.addEventListener("resize", this.positionSelection.bind(this));
    document.body.addEventListener("keydown", this.keydown.bind(this));
    document.body.addEventListener("keypress", this.shortcut.bind(this));
  },
  _setupToolbar() {
    var self = this;
    [].forEach.call(document.querySelectorAll("#toolbar > li"), function(li) {
      li.addEventListener("click", function(evt) {
        var button = evt.target.closest("#toolbar > li");
        if (button && !button.hasAttribute("disabled")) {
          self.current = button;
        }
      });
    });
    this._setupButtons();
  },
  _setupButtons() {
    var floatbars = {
      stroke: ["lineWidth", "color"],
      line: ["lineWidth", "lineArrows", "color"],
      text: ["fontSize", "color"]
    };
    this.buttons = {
      select: new Button({
        id: "select",
        key: "V"
      }),
      crop: new Button({
        id: "crop",
        key: "X"
      }),
      rectangle: new Button({
        id: "rectangle",
        key: "R",
        floatbar: floatbars.stroke
      }),
      circle: new Button({
        id: "circle",
        key: "E",
        floatbar: floatbars.stroke
      }),
      line: new Button({
        id: "line",
        key: "D",
        floatbar: floatbars.line
      }),
      pencil: new Button({
        id: "pencil",
        key: "F",
        floatbar: floatbars.stroke
      }),
      text: new Button({
        id: "text",
        key: "T",
        floatbar: floatbars.text
      }),
      blur: new Button({
        id: "blur",
        key: "B"
      }),
      undo: new Button({
        id: "undo",
        key: "Z",
        simple: true,
        start: this._undo.bind(this)
      }),
      local: new Button({
        id: "local",
        key: "S",
        simple: true,
        start: this._saveLocal.bind(this)
      }),
      copy: new Button({
        id: "copy",
        key: "C",
        simple: true,
        start: this._copyToClipboard.bind(this)
      }),
      cancel: new Button({
        id: "cancel",
        key: "Q",
        simple: true,
        start: this._cancelAndClose.bind(this)
      })
    };
  },
  _getID(element) {
    return element && element.id ? element.id.replace(/^button-/, "") : "";
  },
  annotationById(id) {
    return this.annotations.find(function(annotation) {
      return annotation.id == id;
    }) || null;
  },
  annotationIndex(id) {
    return this.annotations.findIndex(function(annotation) {
      return annotation.id == id;
    });
  },
  removeAnnotation(id) {
    var index = this.annotationIndex(id);
    if (index >= 0) {
      this.annotations.splice(index, 1);
    }
    if (this.selectedAnnotationId == id) {
      this.selectedAnnotationId = null;
    }
  },
  pagePoint(evt) {
    var rect = this._canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(
        this._canvas.width,
        evt.pageX - rect.left - window.scrollX
      )),
      y: Math.max(0, Math.min(
        this._canvas.height,
        evt.pageY - rect.top - window.scrollY
      ))
    };
  },
  render() {
    this._canvas.width = this._baseCanvas.width;
    this._canvas.height = this._baseCanvas.height;
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._ctx.drawImage(this._baseCanvas, 0, 0);
    this.annotations.forEach(function(annotation) {
      Annotations.render(this._ctx, annotation);
    }, this);
    if (this._preview) {
      Annotations.render(this._ctx, this._preview);
    }
    this._selection.width = this._canvas.width;
    this._selection.height = this._canvas.height;
    this.positionSelection();
    this.renderChrome();
  },
  positionSelection() {
    var rect = this._canvas.getBoundingClientRect();
    this._selection.style.left = rect.left + window.scrollX + "px";
    this._selection.style.top = rect.top + window.scrollY + "px";
    this._selection.style.width = rect.width + "px";
    this._selection.style.height = rect.height + "px";
  },
  renderChrome() {
    var annotation = this.selectedAnnotation;
    var box;
    var handles;
    this._selectionCtx.clearRect(
      0,
      0,
      this._selection.width,
      this._selection.height
    );
    if (!annotation || this._getID(this._current) != "select") {
      return;
    }
    box = Annotations.bounds(annotation);
    this._selectionCtx.save();
    this._selectionCtx.strokeStyle = "#ffffff";
    this._selectionCtx.lineWidth = 3;
    this._selectionCtx.strokeRect(box.x, box.y, box.width, box.height);
    this._selectionCtx.strokeStyle = "#1677ff";
    this._selectionCtx.lineWidth = 1;
    this._selectionCtx.strokeRect(box.x, box.y, box.width, box.height);
    handles = Annotations.handles(annotation);
    handles.forEach(function(handle) {
      this._selectionCtx.beginPath();
      this._selectionCtx.arc(handle.x, handle.y, 4, 0, Math.PI * 2);
      this._selectionCtx.fillStyle = "#ffffff";
      this._selectionCtx.fill();
      this._selectionCtx.strokeStyle = "#1677ff";
      this._selectionCtx.lineWidth = 2;
      this._selectionCtx.stroke();
    }, this);
    this._selectionCtx.restore();
  },
  refreshSelectionFloatbar() {
    var annotation = this.selectedAnnotation;
    var items;
    if (!annotation) {
      Floatbar.hide();
      return;
    }
    if (annotation.type == "line") {
      items = ["lineWidth", "lineArrows", "color"];
    } else if (annotation.type == "text") {
      items = ["fontSize", "color"];
    } else {
      items = ["lineWidth", "color"];
    }
    Floatbar.show(this.buttons.select._ele, items);
  },
  selectAnnotation(annotation) {
    this.selectedAnnotationId = annotation ? annotation.id : null;
    this.render();
    this.refreshSelectionFloatbar();
  },
  nextId() {
    return "annotation-" + this._nextAnnotationId++;
  },
  createTextAnnotation(text, x, y, color, fontSize) {
    var annotation = {
      id: this.nextId(),
      type: "text",
      x,
      y,
      width: 0,
      height: 0,
      text,
      color,
      fontSize
    };
    this.measureText(annotation);
    return annotation;
  },
  measureText(annotation) {
    var lines = annotation.text.split("\n");
    this._ctx.save();
    this._ctx.font =
      annotation.fontSize + "px Arial, Helvetica, sans-serif";
    annotation.width = Math.max.apply(null, lines.map(function(line) {
      return this._ctx.measureText(line || " ").width;
    }, this));
    annotation.height = lines.length * annotation.fontSize * 1.2;
    this._ctx.restore();
  },
  startDrawing(evt) {
    var tool = this._getID(this._current);
    var point;
    if (["select", "crop", "undo", "local", "copy", "cancel"].indexOf(tool) >= 0) {
      return;
    }
    point = this.pagePoint(evt);
    if (tool == "text") {
      TextInput.open(point);
      evt.preventDefault();
      return;
    }
    this._pointer = {
      mode: tool == "blur" ? "blurring" : "creating",
      tool,
      start: point,
      points: [point],
      changed: false,
      baseData: tool == "blur" ? this._baseCtx.getImageData(
        0,
        0,
        this._baseCanvas.width,
        this._baseCanvas.height
      ) : null
    };
    if (tool == "blur") {
      this.blurAt(point);
      this._pointer.changed = true;
    } else {
      this.updatePreview(point, evt.shiftKey);
    }
    document.addEventListener("mousemove", this.drawMoveBound =
      this.drawingMove.bind(this));
    document.addEventListener("mouseup", this.drawUpBound =
      this.drawingEnd.bind(this));
    evt.preventDefault();
  },
  drawingMove(evt) {
    var point = this.pagePoint(evt);
    if (this._pointer.mode == "blurring") {
      this.blurAt(point);
      this._pointer.changed = true;
      this.render();
    } else {
      if (this._pointer.tool == "pencil") {
        this._pointer.points.push(point);
      }
      this.updatePreview(point, evt.shiftKey);
      this._pointer.changed = true;
    }
    evt.preventDefault();
  },
  drawingEnd(evt) {
    var pointer = this._pointer;
    var point = this.pagePoint(evt);
    document.removeEventListener("mousemove", this.drawMoveBound);
    document.removeEventListener("mouseup", this.drawUpBound);
    if (pointer.mode == "blurring") {
      if (pointer.changed) {
        this.commitRaster();
      }
      this.current = {id: "select"};
    } else {
      if (pointer.tool == "pencil" && pointer.points.length == 1) {
        this._preview = this.makePreview(point, evt.shiftKey);
      }
      if (this._preview && (pointer.changed || pointer.tool == "pencil")) {
        this.annotations.push(Annotations.clone(this._preview));
        this.selectedAnnotationId = this._preview.id;
        this.commitVector();
        this.current = {id: "select"};
      }
      this._preview = null;
    }
    this._pointer = null;
    this.render();
    evt.preventDefault();
  },
  updatePreview(point, shiftKey) {
    this._preview = this.makePreview(point, shiftKey);
    this.render();
  },
  makePreview(point, shiftKey) {
    var pointer = this._pointer;
    var start = pointer.start;
    var width = point.x - start.x;
    var height = point.y - start.y;
    var size;
    if (shiftKey && (pointer.tool == "rectangle" || pointer.tool == "circle")) {
      size = Math.min(Math.abs(width), Math.abs(height));
      width = (width < 0 ? -1 : 1) * size;
      height = (height < 0 ? -1 : 1) * size;
    }
    if (pointer.tool == "rectangle" || pointer.tool == "circle") {
      return Annotations.normalizeShape({
        id: this._preview ? this._preview.id : this.nextId(),
        type: pointer.tool,
        x: start.x,
        y: start.y,
        width,
        height,
        color: this.prefs["editor.color"],
        lineWidth: this.prefs["editor.lineWidth"]
      });
    }
    if (pointer.tool == "line") {
      if (shiftKey) {
        point = Annotations.constrainLineEnd(start, point);
      }
      return {
        id: this._preview ? this._preview.id : this.nextId(),
        type: "line",
        start: Annotations.clone(start),
        end: Annotations.clone(point),
        color: this.prefs["editor.color"],
        lineWidth: this.prefs["editor.lineWidth"],
        arrowMode: this.prefs["editor.lineArrows"]
      };
    }
    return {
      id: this._preview ? this._preview.id : this.nextId(),
      type: "pencil",
      points: Annotations.clone(pointer.points),
      color: this.prefs["editor.color"],
      lineWidth: this.prefs["editor.lineWidth"]
    };
  },
  handleAt(annotation, point) {
    return Annotations.handles(annotation).find(function(handle) {
      return Math.hypot(point.x - handle.x, point.y - handle.y) <= 7;
    }) || null;
  },
  startSelection(evt) {
    var point = this.pagePoint(evt);
    var selected = this.selectedAnnotation;
    var handle = selected ? this.handleAt(selected, point) : null;
    var hit = selected && Annotations.hit(selected, point) ?
      selected : Annotations.topmost(this.annotations, point);
    if (handle) {
      this._pointer = {
        mode: selected.type == "line" ? "endpoint" : "resizing",
        handle: handle.name,
        start: point,
        original: Annotations.clone(selected),
        changed: false
      };
    } else if (hit) {
      this.selectedAnnotationId = hit.id;
      this._pointer = {
        mode: "moving",
        start: point,
        original: Annotations.clone(hit),
        changed: false
      };
    } else {
      this.selectAnnotation(null);
      return;
    }
    this.render();
    this.refreshSelectionFloatbar();
    document.addEventListener("mousemove", this.selectMoveBound =
      this.selectionMove.bind(this));
    document.addEventListener("mouseup", this.selectUpBound =
      this.selectionEnd.bind(this));
    evt.preventDefault();
  },
  selectionMove(evt) {
    var point = this.pagePoint(evt);
    var dx = point.x - this._pointer.start.x;
    var dy = point.y - this._pointer.start.y;
    var changed;
    if (this._pointer.mode == "moving") {
      changed = Annotations.move(this._pointer.original, dx, dy);
    } else if (this._pointer.mode == "resizing") {
      changed = Annotations.resize(
        this._pointer.original,
        this._pointer.handle,
        dx,
        dy,
        evt.shiftKey
      );
    } else {
      changed = Annotations.moveEndpoint(
        this._pointer.original,
        this._pointer.handle,
        dx,
        dy
      );
    }
    this.annotations[this.annotationIndex(changed.id)] = changed;
    this._pointer.changed =
      JSON.stringify(this._pointer.original) != JSON.stringify(changed);
    this.render();
    evt.preventDefault();
  },
  selectionEnd(evt) {
    document.removeEventListener("mousemove", this.selectMoveBound);
    document.removeEventListener("mouseup", this.selectUpBound);
    if (this._pointer.changed) {
      this.commitVector();
    }
    this._pointer = null;
    this.render();
    evt.preventDefault();
  },
  hoverSelection(evt) {
    var point;
    var selected;
    var handle;
    var cursors = {
      nw: "nwse-resize",
      se: "nwse-resize",
      ne: "nesw-resize",
      sw: "nesw-resize",
      n: "ns-resize",
      s: "ns-resize",
      e: "ew-resize",
      w: "ew-resize",
      start: "crosshair",
      end: "crosshair"
    };
    if (this._pointer) {
      return;
    }
    point = this.pagePoint(evt);
    selected = this.selectedAnnotation;
    handle = selected ? this.handleAt(selected, point) : null;
    if (handle) {
      this._selection.style.cursor = cursors[handle.name];
    } else if (selected && Annotations.hit(selected, point)) {
      this._selection.style.cursor = "move";
    } else if (Annotations.topmost(this.annotations, point)) {
      this._selection.style.cursor = "pointer";
    } else {
      this._selection.style.cursor = "default";
    }
  },
  editSelectedText(evt) {
    var point = this.pagePoint(evt);
    var annotation = Annotations.topmost(this.annotations, point);
    if (annotation && annotation.type == "text") {
      this.selectAnnotation(annotation);
      TextInput.open({x: annotation.x, y: annotation.y}, annotation);
      evt.preventDefault();
    }
  },
  setStyle(property, value) {
    var prefNames = {
      color: "editor.color",
      lineWidth: "editor.lineWidth",
      lineArrows: "editor.lineArrows",
      fontSize: "editor.fontSize"
    };
    var annotation = selectedStyleAnnotation();
    var annotationProperty = property == "lineArrows" ? "arrowMode" : property;
    var applicable = annotation && (
      property == "color" ||
      property == "fontSize" && annotation.type == "text" ||
      property == "lineArrows" && annotation.type == "line" ||
      property == "lineWidth" && annotation.type != "text"
    );
    if (isNaN(value) && property != "color" && property != "lineArrows") {
      return;
    }
    this.prefs[prefNames[property]] = value;
    chrome.storage.local.set({
      [prefNames[property]]: value
    });
    if (applicable && annotation[annotationProperty] != value) {
      annotation[annotationProperty] = value;
      if (annotation.type == "text" && property == "fontSize") {
        this.measureText(annotation);
      }
      this.commitVector();
      this.render();
    }
    Object.keys(Floatbar.items).forEach(function(id) {
      Floatbar.items[id]._refresh();
    });
  },
  blurAt(point) {
    var radius = 7;
    var sx = Math.max(0, Math.floor(point.x - radius));
    var sy = Math.max(0, Math.floor(point.y - radius));
    var ex = Math.min(this._baseCanvas.width, Math.ceil(point.x + radius));
    var ey = Math.min(this._baseCanvas.height, Math.ceil(point.y + radius));
    var source = this._baseCtx.getImageData(sx, sy, ex - sx, ey - sy);
    var output = new ImageData(
      new Uint8ClampedArray(source.data),
      source.width,
      source.height
    );
    var x;
    var y;
    var sampleX;
    var sampleY;
    var channel;
    var count;
    var totals;
    var index;
    for (y = 0; y < source.height; y++) {
      for (x = 0; x < source.width; x++) {
        if (Math.hypot(sx + x - point.x, sy + y - point.y) > radius) {
          continue;
        }
        totals = [0, 0, 0, 0];
        count = 0;
        for (sampleY = Math.max(0, y - 3);
          sampleY <= Math.min(source.height - 1, y + 3);
          sampleY++) {
          for (sampleX = Math.max(0, x - 3);
            sampleX <= Math.min(source.width - 1, x + 3);
            sampleX++) {
            index = 4 * (sampleY * source.width + sampleX);
            for (channel = 0; channel < 4; channel++) {
              totals[channel] += source.data[index + channel];
            }
            count++;
          }
        }
        index = 4 * (y * source.width + x);
        for (channel = 0; channel < 4; channel++) {
          output.data[index + channel] =
            Math.floor(totals[channel] / count);
        }
      }
    }
    this._baseCtx.putImageData(output, sx, sy);
  },
  crop(crop) {
    var data = this._baseCtx.getImageData(crop.x, crop.y, crop.w, crop.h);
    this._baseCanvas.width = crop.w;
    this._baseCanvas.height = crop.h;
    this._baseCtx = this._baseCanvas.getContext("2d");
    this._baseCtx.putImageData(data, 0, 0);
    this.annotations = Annotations.cropTranslate(
      this.annotations,
      crop.x,
      crop.y
    );
    this.selectedAnnotationId = null;
    this.commitRaster();
    this.render();
  },
  pushHistory() {
    this._history.push({
      baseData: this._baseData,
      annotations: Annotations.clone(this.annotations)
    });
    if (this._history.length > HISTORY_LENGTH_MAX) {
      this._history.shift();
    }
    if (this._history.length > 1) {
      this._enableUndo();
    }
  },
  commitVector() {
    this.pushHistory();
  },
  commitRaster() {
    this._baseData = this._baseCtx.getImageData(
      0,
      0,
      this._baseCanvas.width,
      this._baseCanvas.height
    );
    this.pushHistory();
  },
  _undo() {
    var state;
    if (this._history.length <= 1) {
      return;
    }
    this._history.pop();
    state = this._history[this._history.length - 1];
    this._baseData = state.baseData;
    this._baseCanvas.width = state.baseData.width;
    this._baseCanvas.height = state.baseData.height;
    this._baseCtx = this._baseCanvas.getContext("2d");
    this._baseCtx.putImageData(state.baseData, 0, 0);
    this.annotations = Annotations.clone(state.annotations);
    this.selectedAnnotationId = null;
    this.current = {id: "select"};
    if (this._history.length <= 1) {
      this._disableUndo();
    }
    this.render();
  },
  _enableUndo() {
    Utils.qs("#button-undo").removeAttribute("disabled");
  },
  _disableUndo() {
    Utils.qs("#button-undo").setAttribute("disabled", "true");
  },
  cancelPointer() {
    if (!this._pointer) {
      return false;
    }
    document.removeEventListener("mousemove", this.drawMoveBound);
    document.removeEventListener("mouseup", this.drawUpBound);
    document.removeEventListener("mousemove", this.selectMoveBound);
    document.removeEventListener("mouseup", this.selectUpBound);
    if (this._pointer.original) {
      this.annotations[
        this.annotationIndex(this._pointer.original.id)
      ] = this._pointer.original;
    } else if (this._pointer.baseData) {
      this._baseCtx.putImageData(this._pointer.baseData, 0, 0);
    }
    this._pointer = null;
    this._preview = null;
    return true;
  },
  keydown(evt) {
    var targetName = evt.target.nodeName.toLowerCase();
    var editable = targetName == "textarea" || targetName == "input" ||
      evt.target.isContentEditable;
    if (evt.key == "Escape") {
      if (TextInput.active) {
        return;
      }
      if (!this.cancelPointer()) {
        this.selectedAnnotationId = null;
      }
      this.current = {id: "select"};
      this.render();
      evt.preventDefault();
    } else if (!editable && (evt.key == "Delete" || evt.key == "Backspace") &&
        this.selectedAnnotation) {
      this.removeAnnotation(this.selectedAnnotationId);
      this.commitVector();
      this.render();
      this.refreshSelectionFloatbar();
      evt.preventDefault();
    }
  },
  shortcut(evt) {
    if (evt.target.nodeName.toLowerCase() == "textarea" ||
        evt.target.nodeName.toLowerCase() == "input" ||
        evt.target.isContentEditable) {
      return;
    }
    Object.keys(this.buttons).some(function(id) {
      var button = this.buttons[id];
      var found = evt.key &&
        evt.key.toLowerCase() == button.key.toLowerCase();
      if (found) {
        this.current = {id};
        evt.preventDefault();
      }
      return found;
    }, this);
  },
  _saveLocal() {
    this.render();
    chrome.runtime.sendMessage({
      "dir": "editor2bg",
      "type": "download",
      "url": this.canvas.toDataURL()
    });
  },
  async _copyToClipboard() {
    var failed = false;
    this.render();
    try {
      var response = await fetch(this.canvas.toDataURL());
      var arrayBuffer = await response.arrayBuffer();
      await browser.clipboard.setImageData(arrayBuffer, "png");
    } catch (ex) {
      failed = true;
    }
    await browser.runtime.sendMessage({
      "dir": "editor2bg",
      "type": "copy_image",
      "failed": failed
    });
  },
  _cancelAndClose() {
    chrome.runtime.sendMessage({
      "dir": "editor2bg",
      "type": "removetab"
    });
  }
};

window.addEventListener("load", function() {
  chrome.storage.local.get(Object.keys(Editor.prefs), function(results) {
    Editor.prefs = Utils.extend(Editor.prefs, results);
    chrome.runtime.sendMessage(undefined, {
      "dir": "editor2bg",
      "type": "editor_ready"
    }, undefined, function(response) {
      var dataUri = response && response.dataUri;
      var img;
      if (!dataUri) {
        Editor.init();
        return;
      }
      img = new Image();
      img.onload = function(evt) {
        Editor.init(evt.target);
      };
      img.src = dataUri;
    });
  });
  document.title = chrome.i18n.getMessage("editor_title");
});

window.addEventListener("unload", function() {
  var item;
  for (item in Floatbar.items) {
    Floatbar.items[item].uninit();
  }
});
