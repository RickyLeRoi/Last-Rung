// engine/world/camera.js
'use strict';
const Camera = {
  // Eases currentX toward targetX, keeping the view inside the world.
  follow(currentX, targetX, worldWidth, screenWidth, lerp) {
    const target = clamp(targetX, 0, worldWidth - screenWidth);
    return currentX + (target - currentX) * lerp;
  },
  decayShake(shake) {
    shake *= 0.88;
    return shake < 0.3 ? 0 : shake;
  },
};
