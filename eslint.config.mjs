import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Mirrors tests/lint/logical-properties.test.ts, but reports at edit time in
// the editor instead of only when the suite runs. The variant chain
// `(?:[\w-]+:)*` is what makes `sm:text-left` and `hover:md:ml-4` fail too.
const PHYSICAL_DIRECTION =
  String.raw`/(?:^|["'\s])(?:[\w-]+:)*(?:-?(?:ml|mr|pl|pr)-|text-(?:left|right)(?:["'\s]|$)|(?:border|rounded)-(?:l|r)-|(?:left|right)-\d)/`;

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `JSXAttribute[name.name='className'] Literal[value=${PHYSICAL_DIRECTION}]`,
          message:
            "Physical-direction utilities break RTL. Use ms/me, ps/pe, text-start/text-end, border-s/border-e, rounded-s/rounded-e, start-*/end-*.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
