// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle Drizzle's .sql migration files (see src/db/migrations).
config.resolver.sourceExts.push('sql');

module.exports = config;
