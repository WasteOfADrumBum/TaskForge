module.exports = {
  // Specifies the root of the project
  root: true,

  // Extends several ESLint configurations
  extends: [
    "eslint:recommended", // Enforces ESLint's recommended rules
    "plugin:@typescript-eslint/recommended", // Enforces recommended rules for TypeScript
    "plugin:react/recommended", // Enforces recommended React rules
    "plugin:react-hooks/recommended", // Enforces React Hooks rules
    "plugin:prettier/recommended", // Integrates Prettier for code formatting
    "plugin:import/errors", // Lints import statements
    "plugin:import/warnings", // Warns about import issues
    "plugin:import/typescript", // Ensures import type support for TypeScript files
  ],

  // Plugins for additional rules and features
  plugins: ["@typescript-eslint", "react", "react-hooks", "import", "prettier"],

  // Defines the parser to use TypeScript with ESLint
  parser: "@typescript-eslint/parser",

  // Parsing options for TypeScript and JSX
  parserOptions: {
    ecmaVersion: 2022, // Supports modern ECMAScript features
    sourceType: "module", // Allows ES module imports
    ecmaFeatures: {
      jsx: true, // Enables JSX parsing
    },
  },

  // Specifies global variables (useful for frameworks like React or Node.js)
  globals: {
    JSX: "readonly", // Prevents redeclaring JSX in React code
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },

  // Defines rules and their severity (error, warn, or off)
  rules: {
    // General ESLint rules
    "no-console": "warn", // Warns on console statements (useful for development)
    "no-debugger": "error", // Disallows debugger statements in production

    // Enforcing consistent indentation
    indent: ["error", 2], // 2 spaces indentation

    // Enforces single quotes for strings
    quotes: ["error", "single"],

    // Enforces semicolons at the end of statements
    semi: ["error", "always"],

    // Disallow unused variables
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }], // Ignores unused function arguments prefixed with `_`

    // Enforces consistent line breaks
    "linebreak-style": ["error", "unix"], // Ensures LF line endings (cross-platform)

    // Prettier integration
    "prettier/prettier": "error", // Reports Prettier issues as errors

    // React-specific rules
    "react/jsx-uses-react": "off", // React 17+ does not require React in every JSX file
    "react/react-in-jsx-scope": "off", // Not needed with React 17+ JSX Transform
    "react/jsx-pascal-case": "error", // Ensures JSX components use PascalCase
    "react/jsx-no-undef": "error", // Ensures all JSX components are defined

    // React Hooks rules
    "react-hooks/rules-of-hooks": "error", // Ensures React hooks are used properly
    "react-hooks/exhaustive-deps": "warn", // Warns about missing dependencies in useEffect

    // TypeScript-specific rules
    "@typescript-eslint/explicit-module-boundary-types": "off", // Disables requirement for explicit return types in functions
    "@typescript-eslint/no-explicit-any": "warn", // Warns when `any` type is used
    "@typescript-eslint/ban-ts-comment": "warn", // Warns when `@ts-ignore` or `@ts-expect-error` is used
    "@typescript-eslint/no-non-null-assertion": "warn", // Warns when `!` is used to assert non-nullability

    // Import plugin rules
    "import/no-unresolved": "error", // Ensures all imports are resolvable
    "import/named": "error", // Ensures named imports are correctly imported
    "import/default": "error", // Ensures default imports are correctly imported
    "import/no-extraneous-dependencies": ["error", { devDependencies: true }], // Allows dev dependencies in specific files like tests

    // Enforces a consistent return
    "consistent-return": "off", // Not strict on return consistency

    // Encourages concise code
    "arrow-body-style": ["error", "as-needed"], // Only uses curly braces in arrow functions when necessary
    "no-else-return": "error", // Disallows else after a return statement

    // Enforces object shorthand notation
    "object-shorthand": "error", // Requires using object shorthand for properties

    // Disallow unnecessary ternary operators
    "no-unneeded-ternary": "error", // Disallows ternary operators where a simple `if` statement could work

    // Encourages destructuring for variables and parameters
    "prefer-destructuring": ["error", { object: true, array: true }],

    // Encourages the use of async/await over .then()/.catch() in promises
    "prefer-async-await": "error", // Requires async/await over Promise chaining
    "no-void": "error", // Avoids using `void` operator in expressions

    // Enforce a maximum number of lines per file
    "max-lines": ["warn", 300], // Warns if a file exceeds 300 lines

    // Enforces the use of `const` for variables that are never reassigned
    "prefer-const": "error", // Requires `const` for variables that are not reassigned
  },

  // Overrides for specific file types (e.g., specific settings for TypeScript or React)
  overrides: [
    {
      files: ["*.ts", "*.tsx"], // Applies rules specifically for TypeScript files
      rules: {
        "@typescript-eslint/explicit-module-boundary-types": "off", // Disables explicit return type for TS files
      },
    },
    {
      files: ["*.jsx", "*.tsx"], // Applies rules for JSX files
      rules: {
        "react/react-in-jsx-scope": "off", // React 17+ JSX transform doesn't need React in scope
      },
    },
  ],

  // Environment settings for code to run in browser or Node.js, among other environments
  env: {
    browser: true,
    node: true,
    es2021: true, // Ensures ECMAScript 2021 syntax is supported
  },
};
