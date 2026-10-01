// Test-only Metro wrapper. The shared monorepo config watches the workspace,
// but Expo's embedded bundler otherwise promotes that watch folder to its
// server root. Keep entry and Expo Router paths relative to apps/mobile.
const path = require('path');
const config = require('../../metro.config');

config.server ??= {};
config.server.unstable_serverRoot = path.resolve(__dirname, '..', '..');

module.exports = config;
