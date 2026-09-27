const assert = require('assert');
const path = require('path');

const functions = require('../lib/index.js');
const googleApisPath = `${path.sep}node_modules${path.sep}googleapis${path.sep}`;
const googleApisLoaded = Object.keys(require.cache).some((filename) => filename.includes(googleApisPath));

assert.equal(typeof functions.googleLoginStart, 'function', 'googleLoginStart must remain exported');
assert.equal(typeof functions.googleCallback, 'function', 'googleCallback must remain exported');
assert.equal(
  googleApisLoaded,
  false,
  'loading the Functions entry point for OAuth must not eagerly load googleapis',
);

console.log('oauth initialization test passed');
