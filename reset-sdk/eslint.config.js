const tseslint = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')
const importPlugin = require('eslint-plugin-import')
const eslintJs = require('@eslint/js')
const prettierConfig = require('eslint-config-prettier')
const globals = require('globals') // For defining global variables

module.exports = [
  // Base config for all files
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module', // Ensure this is set for all files including JS
      globals: {
        ...globals.node, // Node.js global variables
        ...globals.es2021 // ES2021 globals
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    }
  },
  // JavaScript specific configurations
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...eslintJs.configs.recommended,
    rules: {
      // Add any JS-specific rule overrides here
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  // TypeScript specific configurations
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module' // Explicitly set for TS files as well
      }
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx']
        }
        // typescript: {}, // Replaced with node resolver for now
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx']
      }
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs['eslint-recommended'].overrides[0].rules,
      ...importPlugin.configs.typescript.rules,
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index']
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true
          }
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_.*', varsIgnorePattern: '^_.*' }
      ]
    }
  },
  // Ignore patterns
  {
    ignores: [
      'node_modules/',
      'dist/',
      'eslint.config.js',
      'jest.config.js',
      'examples/**'
    ]
  },
  prettierConfig // Apply Prettier config last to override styling rules
]
