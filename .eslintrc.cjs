module.exports = {
  root: true,
  extends: ["@react-native-community"],
  env: {
    es2021: true,
    node: true,
  },
  ignorePatterns: [
    "node_modules/**",
    ".expo/**",
    "android/**",
    "ios/**",
    "dist/**",
  ],
  overrides: [
    {
      files: ['scripts/check-notification-sounds.mjs'],
      parser: 'espree',
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    {
      files: ['scripts/check-security.mjs', 'scripts/check-livekit-signal-lifecycle.mjs', 'scripts/check-checkin-call-audio.mjs', 'scripts/check-checkin-call-handoff.mjs', 'scripts/check-startup-modals.mjs', 'scripts/check-session-guide-regressions.mjs', 'scripts/check-checkin-call-personalization.mjs', 'scripts/generate-checkin-handoff-voice.mjs'],
      parser: 'espree',
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "warn",
    // The app has an established single-quote style and is not yet globally
    // formatted by Prettier. Keep ESLint useful without making a new lint
    // configuration turn every existing file into a formatting failure.
    "prettier/prettier": "off",
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-no-comment-textnodes": "warn",
    "react-native/no-color-literals": "off",
    "react-native/no-inline-styles": "off",
  },
};
