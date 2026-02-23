/** @type {import("stylelint").Config} */
export default {
  ignoreFiles: ["node_modules/**", "dist/**"],
  rules: {
    "no-duplicate-selectors": true,
    "declaration-block-no-duplicate-properties": true,
    "declaration-block-no-duplicate-custom-properties": true,
    "declaration-block-no-shorthand-property-overrides": true,
    "no-descending-specificity": true,
    "declaration-no-important": true,
    "selector-max-id": 0,
    "selector-max-specificity": "0,4,1",
    "selector-max-compound-selectors": 4,
    "selector-max-combinators": 3,
    "max-nesting-depth": 2
  }
};
