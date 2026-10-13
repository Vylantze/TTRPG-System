export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
  rules: {
    // Existing responsive and System-specific overrides deliberately reuse selectors.
    'no-descending-specificity': null,
    'no-duplicate-selectors': null,
  },
};
