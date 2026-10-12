// games/faro/test/helpers.js
'use strict';
// Faro specific helpers on top of the engine harness.
const engine = require('../../../engine/test/harness');

const boot = (options = {}) => engine.boot({ game: 'faro', ...options });

module.exports = { boot, randomKeysPolicy: engine.randomKeysPolicy, W: engine.W, H: engine.H };
