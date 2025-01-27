import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import pkg from "@eslint/js";

const { configs } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: configs.recommended,
  allConfig: configs.all
});

export default [
  configs.recommended,
  ...compat.extends(
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "next/typescript",
    "next/core-web-vitals",
    "plugin:prettier/recommended"
  ),
  {
    rules: {
      "no-console": "off",
      "import/no-anonymous-default-export": "off"
    }
  }
];
