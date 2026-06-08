const js = require("@eslint/js");
const globals = require("globals");
const nounsanitized = require("eslint-plugin-no-unsanitized");

module.exports = [
  js.configs.recommended,
  {
    files: ["extension/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.webextensions
      }
    },
    plugins: {
      "no-unsanitized": nounsanitized
    },
    rules: {
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
      "no-unused-vars": ["error", {args: "none", caughtErrors: "none"}]
    }
  }
];
