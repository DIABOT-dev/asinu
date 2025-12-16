const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force Metro to prefer CJS entry points over ESM
config.resolver.resolverMainFields = ['react-native', 'main', 'browser', 'module'];

// Support .cjs files
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

module.exports = config;
