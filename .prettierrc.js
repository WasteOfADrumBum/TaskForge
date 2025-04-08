module.exports = {
  // Specifies the number of spaces per indentation level.
  tabWidth: 2, // Default is 2, commonly used in JavaScript/TypeScript projects.

  // Indent lines with spaces or tabs. Set to `true` for spaces, `false` for tabs.
  useTabs: false, // If set to true, Prettier uses tabs for indentation.

  // Whether to add a semicolon at the end of every statement.
  semi: true, // Default is true. Add semicolons at the end of statements.

  // Whether to use single or double quotes in strings.
  singleQuote: true, // If true, single quotes will be used for strings. Default is false (double quotes).

  // If true, Prettier will add a trailing comma wherever possible in multi-line scenarios.
  trailingComma: "all", // Options: 'none', 'es5', 'all'. 'all' ensures trailing commas in all scenarios.

  // Controls the maximum line length. Prettier will wrap lines longer than this.
  printWidth: 100, // Default is 80. It's the number of characters Prettier allows per line.

  // Whether or not to insert spaces between brackets in object literals.
  bracketSpacing: true, // Default is true. If false, `{ foo: bar }` becomes `{foo: bar}`.

  // Whether to put the `>` of a multi-line JSX element at the end of the last line.
  jsxBracketSameLine: false, // When true, JSX closing brackets are placed at the end of the last line.

  // Use single or double quotes in JSX attributes.
  jsxSingleQuote: false, // Set to true to use single quotes in JSX attributes.

  // Determines the style of the line endings. Typically, use 'lf' for Unix systems, 'crlf' for Windows systems.
  endOfLine: "lf", // Options: 'auto', 'lf', 'crlf', 'cr', 'lf'. 'lf' is commonly used in Unix-based systems.

  // Whether to format embedded code (like template strings or expressions) in templates.
  embeddedLanguageFormatting: "auto", // Options: 'auto', 'off'. Auto will format embedded code.

  // Controls if Prettier will format comments. Can be set to 'always' or 'never'.
  commentFormat: "always", // Options: 'always', 'never'. Formatting comments is generally recommended.

  // Controls whether to handle newlines around function parameters.
  arrowParens: "always", // Options: 'always', 'avoid'. 'always' will include parentheses even for single-parameter arrow functions.

  // Whether to insert a space before `function` keyword in function expressions.
  spaceBeforeFunctionParen: true, // If set to false, function expressions will not have space before the parentheses.

  // Specify whether to allow Prettier to format the entire file or just part of the file.
  rangeStart: 0, // The start of the range to format (usually 0). By default, Prettier formats the entire file.

  // Specify where to stop formatting (usually end of file).
  rangeEnd: Infinity, // Prettier will format until the end of the file unless otherwise specified.

  // Forcing Prettier to format files that otherwise wouldn't be formatted.
  requirePragma: false, // If true, Prettier will format only files that contain a special comment (`@format`).

  // Option to specify which files Prettier should ignore when formatting.
  ignorePath: ".prettierignore", // Specify a `.prettierignore` file to exclude files.

  // Prettier will ignore files that match the files listed in the `files` glob pattern.
  overrides: [
    {
      files: "*.json",
      options: {
        tabWidth: 2,
        singleQuote: false,
        trailingComma: "all",
      },
    },
    {
      files: "*.md",
      options: {
        proseWrap: "always", // Wrap Markdown text for readability.
      },
    },
    {
      files: "*.ts",
      options: {
        semi: true, // Ensure semicolons are added in TypeScript files.
        singleQuote: true, // Use single quotes in TypeScript files.
        tabWidth: 4, // Use a tab width of 4 for TypeScript files (commonly used in TS projects).
      },
    },
    {
      files: "*.jsx",
      options: {
        jsxSingleQuote: true, // Use single quotes in JSX files.
      },
    },
  ],

  // This option will ensure Prettier formats everything consistently.
  htmlWhitespaceSensitivity: "css", // Options: 'css', 'strict', 'ignore'. 'css' respects the CSS display property for whitespace.

  // Controls whether to format the contents of `style` tags or `style` attributes in HTML files.
  stylelintIntegration: true, // Enables integration with Stylelint for CSS/SCSS files.

  // Whether to use consistent or flexible spacing between brackets in JSX or HTML attributes.
  jsxBracketSpacing: true, // If false, it removes spacing inside JSX brackets.

  // Controls whether to add a `@prettier` pragma to every formatted file.
  insertPragma: false, // Set to true to insert a `@prettier` pragma comment at the top of files.

  // Controls if Prettier should format template literals.
  templateLiterals: true, // If true, Prettier will format template literals and expressions in them.

  // Controls how Prettier handles JSON parsing.
  parser: "babel", // Options: 'babel', 'babel-ts', 'flow', 'typescript', 'json'. Set to 'babel' for JS files, 'typescript' for TS files.
};
