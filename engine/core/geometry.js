// engine/core/geometry.js
'use strict';
// Visits every integer point of the line from (startX, startY) to (endX, endY), both ends included.
function bresenham(startX, startY, endX, endY, visit) {
  let x = Math.round(startX), y = Math.round(startY);
  endX = Math.round(endX); endY = Math.round(endY);
  const deltaX = Math.abs(endX - x), stepX = x < endX ? 1 : -1, deltaY = -Math.abs(endY - y), stepY = y < endY ? 1 : -1;
  let error = deltaX + deltaY, index = 0;
  for (;;) {
    visit(x, y, index++);
    if (x === endX && y === endY) break;
    const doubleError = 2 * error;
    if (doubleError >= deltaY) { error += deltaY; x += stepX; }
    if (doubleError <= deltaX) { error += deltaX; y += stepY; }
  }
}

// 20261012 ++ RG #cone_contains
// cone = { x, y, pitch, half, length, facing }: pitch in radians below the horizontal on the side the cone faces (facing 1 = right,
// the default, -1 = left), half = half opening angle. minHalfWidth (px, optional) keeps the cone at least that wide near its apex.
function coneContains(cone, x, y, minHalfWidth) {
  const deltaX = (x - cone.x) * (cone.facing || 1), deltaY = y - cone.y;
  if (deltaX <= 0 || Math.hypot(deltaX, deltaY) > cone.length) return false;
  return Math.abs(Math.atan2(deltaY, deltaX) - cone.pitch) <= Math.max(cone.half, (minHalfWidth || 0) / deltaX);
}

// Adds x0/x1/y0/y1 (bounding box) to a hazard whose points are a flat [x, y, x, y, ...] list in `pts`.
function withBounds(hazard) {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < hazard.pts.length; i += 2) {
    minX = Math.min(minX, hazard.pts[i]); maxX = Math.max(maxX, hazard.pts[i]);
    minY = Math.min(minY, hazard.pts[i + 1]); maxY = Math.max(maxY, hazard.pts[i + 1]);
  }
  return Object.assign(hazard, { x0: minX, x1: maxX, y0: minY, y1: maxY });
}
