// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/lib/ammo/**", // 3D物理エンジンの wasm ファイルが含まれるため、eslint の対象外にする
  ]),
  ...storybook.configs["flat/recommended"],
  {
    // 対象にするテストファイルのパターンを指定
    files: [
      "**/__tests__/**/*.[jt]s?(x)", 
      "**/?(*.)+(spec|test).[jt]s?(x)",
      "**/*.stories.[jt]s?(x)"
    ],
    // テストファイルでは any を許可する
    rules: {
      "@typescript-eslint/no-explicit-any": "off"
    }
  }
]);

export default eslintConfig;
