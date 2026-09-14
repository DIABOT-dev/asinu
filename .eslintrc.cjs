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
