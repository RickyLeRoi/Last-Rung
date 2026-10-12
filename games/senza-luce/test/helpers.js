// games/senza-luce/test/helpers.js
'use strict';
// Senza Luce specific helpers on top of the engine harness.
const engine = require('../../../engine/test/harness');

const boot = (options = {}) => engine.boot({ game: 'senza-luce', ...options });

module.exports = { boot, randomKeysPolicy: engine.randomKeysPolicy, W: engine.W, H: engine.H };
