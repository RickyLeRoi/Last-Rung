// games/sabbia/src/materials.js
'use strict';
// Material ids and the per-id tables the simulation reads every cell (built once from CONFIG.materials).
const MATERIAL_KEYS = ['empty', 'iron', 'wood', 'grass', 'sand', 'fire', 'water', 'steam', 'acid', 'hotAir', 'coldAir'];
const MATERIAL = Object.freeze(Object.fromEntries(MATERIAL_KEYS.map((key, id) => [key, id])));
const ERASER = 255;
const KIND = Object.freeze({ empty: 0, static: 1, powder: 2, liquid: 3, gas: 4 });

const materialSpec = id => CONFIG.materials[MATERIAL_KEYS[id]];
const KIND_OF = Uint8Array.from(MATERIAL_KEYS, key => KIND[CONFIG.materials[key].kind]);
const DENSITY = Float32Array.from(MATERIAL_KEYS, key => (CONFIG.materials[key].density === undefined ? Infinity : CONFIG.materials[key].density));
const CONDUCT = Float32Array.from(MATERIAL_KEYS, key => CONFIG.materials[key].conduct);
const ACID_RATE = Float32Array.from(MATERIAL_KEYS, key => CONFIG.materials[key].acid || 0);
const HEAT_SHARE = Float32Array.from(MATERIAL_KEYS, key => 1 / (CONFIG.materials[key].capacity || 1));   // degrees per unit of heat

const materialName = id => (id === ERASER ? 'GOMMA' : materialSpec(id).name);

// Temperature a freshly painted cell starts with.
function startTemperature(id) {
  const spec = materialSpec(id);
  if (id === MATERIAL.fire) return CONFIG.heat.fire;
  return spec.start === undefined ? CONFIG.heat.ambient : spec.start;
}
