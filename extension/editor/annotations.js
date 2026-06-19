/* exported Annotations */

var Annotations = (function() {
  var HANDLE_NAMES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeShape(annotation) {
    var normalized = clone(annotation);
    if (normalized.width < 0) {
      normalized.x += normalized.width;
      normalized.width = -normalized.width;
    }
    if (normalized.height < 0) {
      normalized.y += normalized.height;
      normalized.height = -normalized.height;
    }
    return normalized;
  }

  function lineMetrics(annotation) {
    var dx = annotation.end.x - annotation.start.x;
    var dy = annotation.end.y - annotation.start.y;
    var length = Math.hypot(dx, dy);
    var ux = length ? dx / length : 1;
    var uy = length ? dy / length : 0;
    var px = -uy;
    var py = ux;
    var arrowLength = Math.max(12, annotation.lineWidth * 3.25);
    var arrowInset = arrowLength * 0.68;
    var halfWidth = Math.max(6, annotation.lineWidth * 1.65);

    return {
      length,
      ux,
      uy,
      px,
      py,
      arrowLength,
      arrowInset,
      halfWidth
    };
  }

  function arrowPoints(tip, from, lineWidth) {
    var annotation = {
      start: from,
      end: tip,
      lineWidth
    };
    var metrics = lineMetrics(annotation);
    var baseX = tip.x - metrics.arrowLength * metrics.ux;
    var baseY = tip.y - metrics.arrowLength * metrics.uy;
    var notchX = tip.x - metrics.arrowInset * metrics.ux;
    var notchY = tip.y - metrics.arrowInset * metrics.uy;

    return [
      {x: tip.x, y: tip.y},
      {
        x: baseX + metrics.halfWidth * metrics.px,
        y: baseY + metrics.halfWidth * metrics.py
      },
      {x: notchX, y: notchY},
      {
        x: baseX - metrics.halfWidth * metrics.px,
        y: baseY - metrics.halfWidth * metrics.py
      }
    ];
  }

  function bounds(annotation) {
    var padding = (annotation.lineWidth || 0) / 2;
    var points;
    var minX;
    var minY;
    var maxX;
    var maxY;

    if (annotation.type == "rectangle" || annotation.type == "circle") {
      annotation = normalizeShape(annotation);
      return {
        x: annotation.x - padding,
        y: annotation.y - padding,
        width: annotation.width + padding * 2,
        height: annotation.height + padding * 2
      };
    }
    if (annotation.type == "text") {
      return {
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height
      };
    }
    if (annotation.type == "line") {
      points = [annotation.start, annotation.end];
      if (annotation.arrowMode == "end" || annotation.arrowMode == "both") {
        points = points.concat(arrowPoints(
          annotation.end,
          annotation.start,
          annotation.lineWidth
        ));
      }
      if (annotation.arrowMode == "both") {
        points = points.concat(arrowPoints(
          annotation.start,
          annotation.end,
          annotation.lineWidth
        ));
      }
    } else {
      points = annotation.points;
    }

    minX = Math.min.apply(null, points.map(function(point) {
      return point.x;
    }));
    minY = Math.min.apply(null, points.map(function(point) {
      return point.y;
    }));
    maxX = Math.max.apply(null, points.map(function(point) {
      return point.x;
    }));
    maxY = Math.max.apply(null, points.map(function(point) {
      return point.y;
    }));
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    };
  }

  function handles(annotation) {
    var box;
    var x;
    var y;
    var right;
    var bottom;
    var centerX;
    var centerY;

    if (annotation.type == "line") {
      return [
        {name: "start", x: annotation.start.x, y: annotation.start.y},
        {name: "end", x: annotation.end.x, y: annotation.end.y}
      ];
    }
    if (annotation.type != "rectangle" && annotation.type != "circle") {
      return [];
    }
    annotation = normalizeShape(annotation);
    x = annotation.x;
    y = annotation.y;
    right = x + annotation.width;
    bottom = y + annotation.height;
    centerX = x + annotation.width / 2;
    centerY = y + annotation.height / 2;
    box = [
      [x, y],
      [centerX, y],
      [right, y],
      [right, centerY],
      [right, bottom],
      [centerX, bottom],
      [x, bottom],
      [x, centerY]
    ];
    return box.map(function(point, index) {
      return {
        name: HANDLE_NAMES[index],
        x: point[0],
        y: point[1]
      };
    });
  }

  function distanceToSegment(point, start, end) {
    var dx = end.x - start.x;
    var dy = end.y - start.y;
    var lengthSquared = dx * dx + dy * dy;
    var ratio;
    var x;
    var y;

    if (!lengthSquared) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }
    ratio = ((point.x - start.x) * dx + (point.y - start.y) * dy) /
      lengthSquared;
    ratio = Math.max(0, Math.min(1, ratio));
    x = start.x + ratio * dx;
    y = start.y + ratio * dy;
    return Math.hypot(point.x - x, point.y - y);
  }

  function pointInPolygon(point, polygon) {
    var inside = false;
    var previous = polygon.length - 1;
    polygon.forEach(function(currentPoint, current) {
      var previousPoint = polygon[previous];
      var crosses = currentPoint.y > point.y != previousPoint.y > point.y;
      var edgeX;
      if (crosses) {
        edgeX = (previousPoint.x - currentPoint.x) *
          (point.y - currentPoint.y) /
          (previousPoint.y - currentPoint.y) + currentPoint.x;
        if (point.x < edgeX) {
          inside = !inside;
        }
      }
      previous = current;
    });
    return inside;
  }

  function hit(annotation, point) {
    var tolerance = Math.max(6, (annotation.lineWidth || 0) / 2 + 4);
    var normalized;
    var centerX;
    var centerY;
    var radiusX;
    var radiusY;
    var expandedX;
    var expandedY;
    var index;

    if (annotation.type == "rectangle") {
      normalized = normalizeShape(annotation);
      return point.x >= normalized.x - tolerance &&
        point.x <= normalized.x + normalized.width + tolerance &&
        point.y >= normalized.y - tolerance &&
        point.y <= normalized.y + normalized.height + tolerance;
    }
    if (annotation.type == "circle") {
      normalized = normalizeShape(annotation);
      centerX = normalized.x + normalized.width / 2;
      centerY = normalized.y + normalized.height / 2;
      radiusX = normalized.width / 2;
      radiusY = normalized.height / 2;
      expandedX = radiusX + tolerance;
      expandedY = radiusY + tolerance;
      if (!expandedX || !expandedY) {
        return Math.hypot(point.x - centerX, point.y - centerY) <= tolerance;
      }
      return Math.pow((point.x - centerX) / expandedX, 2) +
        Math.pow((point.y - centerY) / expandedY, 2) <= 1;
    }
    if (annotation.type == "text") {
      return point.x >= annotation.x - tolerance &&
        point.x <= annotation.x + annotation.width + tolerance &&
        point.y >= annotation.y - tolerance &&
        point.y <= annotation.y + annotation.height + tolerance;
    }
    if (annotation.type == "line") {
      if (distanceToSegment(point, annotation.start, annotation.end) <= tolerance) {
        return true;
      }
      if (annotation.arrowMode == "end" || annotation.arrowMode == "both") {
        if (pointInPolygon(point, arrowPoints(
          annotation.end,
          annotation.start,
          annotation.lineWidth
        ))) {
          return true;
        }
      }
      return annotation.arrowMode == "both" && pointInPolygon(point, arrowPoints(
        annotation.start,
        annotation.end,
        annotation.lineWidth
      ));
    }
    for (index = 1; index < annotation.points.length; index++) {
      if (distanceToSegment(
        point,
        annotation.points[index - 1],
        annotation.points[index]
      ) <= tolerance) {
        return true;
      }
    }
    return annotation.points.length == 1 &&
      Math.hypot(
        point.x - annotation.points[0].x,
        point.y - annotation.points[0].y
      ) <= tolerance;
  }

  function topmost(annotations, point) {
    var index;
    for (index = annotations.length - 1; index >= 0; index--) {
      if (hit(annotations[index], point)) {
        return annotations[index];
      }
    }
    return null;
  }

  function move(annotation, dx, dy) {
    var moved = clone(annotation);
    if (moved.type == "rectangle" || moved.type == "circle" ||
        moved.type == "text") {
      moved.x += dx;
      moved.y += dy;
    } else if (moved.type == "line") {
      moved.start.x += dx;
      moved.start.y += dy;
      moved.end.x += dx;
      moved.end.y += dy;
    } else {
      moved.points.forEach(function(point) {
        point.x += dx;
        point.y += dy;
      });
    }
    return moved;
  }

  function resize(annotation, handle, dx, dy, preserveAspect) {
    var resized = normalizeShape(annotation);
    var left = resized.x;
    var top = resized.y;
    var right = resized.x + resized.width;
    var bottom = resized.y + resized.height;
    var ratio = resized.height ? resized.width / resized.height : 1;
    var horizontal = handle.indexOf("w") >= 0 ? "left" :
      handle.indexOf("e") >= 0 ? "right" : "";
    var vertical = handle.indexOf("n") >= 0 ? "top" :
      handle.indexOf("s") >= 0 ? "bottom" : "";
    var width;
    var height;

    if (horizontal == "left") {
      left += dx;
    } else if (horizontal == "right") {
      right += dx;
    }
    if (vertical == "top") {
      top += dy;
    } else if (vertical == "bottom") {
      bottom += dy;
    }
    if (preserveAspect && horizontal && vertical && ratio) {
      width = Math.abs(right - left);
      height = Math.abs(bottom - top);
      if (width / Math.max(height, 0.0001) > ratio) {
        height = width / ratio;
      } else {
        width = height * ratio;
      }
      if (horizontal == "left") {
        left = right + (left <= right ? -width : width);
      } else {
        right = left + (right >= left ? width : -width);
      }
      if (vertical == "top") {
        top = bottom + (top <= bottom ? -height : height);
      } else {
        bottom = top + (bottom >= top ? height : -height);
      }
    }
    resized.x = left;
    resized.y = top;
    resized.width = right - left;
    resized.height = bottom - top;
    return normalizeShape(resized);
  }

  function moveEndpoint(annotation, endpoint, dx, dy) {
    var moved = clone(annotation);
    moved[endpoint].x += dx;
    moved[endpoint].y += dy;
    return moved;
  }

  function cropTranslate(annotations, x, y) {
    return annotations.map(function(annotation) {
      return move(annotation, -x, -y);
    });
  }

  function constrainLineEnd(start, end) {
    var dx = end.x - start.x;
    var dy = end.y - start.y;
    var size = Math.min(Math.abs(dx), Math.abs(dy));
    return {
      x: start.x + (dx < 0 ? -size : size),
      y: start.y + (dy < 0 ? -size : size)
    };
  }

  function drawArrow(ctx, tip, from, lineWidth) {
    var points = arrowPoints(tip, from, lineWidth);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(function(point) {
      ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fill();
  }

  function renderLine(ctx, annotation) {
    var metrics = lineMetrics(annotation);
    var insetDivisor = annotation.arrowMode == "both" ? 2 : 1;
    var inset = Math.min(metrics.arrowInset, metrics.length / insetDivisor);
    var start = annotation.start;
    var end = annotation.end;
    var shaftStart = start;
    var shaftEnd = end;

    if (annotation.arrowMode == "end" || annotation.arrowMode == "both") {
      shaftEnd = {
        x: end.x - metrics.ux * inset,
        y: end.y - metrics.uy * inset
      };
    }
    if (annotation.arrowMode == "both") {
      shaftStart = {
        x: start.x + metrics.ux * inset,
        y: start.y + metrics.uy * inset
      };
    }
    ctx.beginPath();
    ctx.lineCap = annotation.arrowMode == "none" ? "round" : "butt";
    ctx.moveTo(shaftStart.x, shaftStart.y);
    ctx.lineTo(shaftEnd.x, shaftEnd.y);
    ctx.stroke();
    if (annotation.arrowMode == "end" || annotation.arrowMode == "both") {
      drawArrow(ctx, end, start, annotation.lineWidth);
    }
    if (annotation.arrowMode == "both") {
      drawArrow(ctx, start, end, annotation.lineWidth);
    }
  }

  function renderText(ctx, annotation) {
    var lineHeight = annotation.fontSize * 1.2;
    ctx.font = annotation.fontSize + "px Arial, Helvetica, sans-serif";
    ctx.textBaseline = "top";
    annotation.text.split("\n").forEach(function(line, index) {
      ctx.fillText(line, annotation.x, annotation.y + index * lineHeight);
    });
  }

  function render(ctx, annotation) {
    var normalized;
    ctx.save();
    ctx.lineWidth = annotation.lineWidth || 1;
    ctx.strokeStyle = annotation.color;
    ctx.fillStyle = annotation.color;
    if (annotation.type == "rectangle") {
      normalized = normalizeShape(annotation);
      ctx.strokeRect(
        normalized.x,
        normalized.y,
        normalized.width,
        normalized.height
      );
    } else if (annotation.type == "circle") {
      normalized = normalizeShape(annotation);
      ctx.beginPath();
      ctx.ellipse(
        normalized.x + normalized.width / 2,
        normalized.y + normalized.height / 2,
        normalized.width / 2,
        normalized.height / 2,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    } else if (annotation.type == "line") {
      renderLine(ctx, annotation);
    } else if (annotation.type == "pencil") {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (annotation.points.length == 1) {
        ctx.beginPath();
        ctx.arc(
          annotation.points[0].x,
          annotation.points[0].y,
          annotation.lineWidth / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else {
        ctx.beginPath();
        annotation.points.forEach(function(point, index) {
          ctx[index ? "lineTo" : "moveTo"](point.x, point.y);
        });
        ctx.stroke();
      }
    } else if (annotation.type == "text") {
      renderText(ctx, annotation);
    }
    ctx.restore();
  }

  return {
    arrowPoints,
    bounds,
    clone,
    constrainLineEnd,
    cropTranslate,
    handles,
    hit,
    move,
    moveEndpoint,
    normalizeShape,
    render,
    resize,
    topmost
  };
}());
