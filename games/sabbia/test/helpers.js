// games/sabbia/test/helpers.js
'use strict';
// Sabbia specific helpers on top of the engine harness.
const engine = require('../../../engine/test/harness');

const boot = (options = {}) => engine.boot({ game: 'sabbia', ...options });

module.exports = { boot, randomKeysPolicy: engine.randomKeysPolicy, W: engine.W, H: engine.H };
