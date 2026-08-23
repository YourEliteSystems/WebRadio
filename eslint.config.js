// @ts-check
import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            "eslint.config.js",
            "**/node_modules/**",
            "**/dist/**",
            "**/out/**",
            "**/.kilo/**",
            "docs/**",
            "docs_legacy/**",
            "logs/**",
            "data/**",
            "themes/**",
            "plugins/youtube/**",
            "integrations/**"
        ]
    },
    eslint.configs.recommended,
    tseslint.configs.disableTypeChecked,
    {
        files: ["**/*.js", "**/*.jsx"],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                ...globals.browser
            },
            parserOptions: {
                ecmaFeatures: { jsx: true }
            }
        },
        plugins: {
            "react-hooks": reactHooks
        },
        rules: {
            // Bewährte Regeln ohne bestehenden Code zu übermäßig anzupassen
            "no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
            ],
            "no-constant-condition": "warn",
            "prefer-const": "warn",
            eqeqeq: ["warn", "smart"],
            "no-var": "warn",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn"
        }
    },
    {
        files: ["renderer/**/*.js", "renderer/**/*.jsx"],
        languageOptions: {
            sourceType: "module",
            globals: {
                ...globals.browser
            }
        }
    }
);
