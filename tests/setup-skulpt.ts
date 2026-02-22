/**
 * Vitest setup file: loads Skulpt into globalThis before tests run.
 * Skulpt is a UMD library that sets `Sk` on the global scope.
 * The non-minified dist is used because the minified version
 * has initialization issues in Node.js.
 *
 * skulpt-stdlib.js provides built-in Python module files (e.g. `re`, `math`).
 * It must be loaded after skulpt.js to populate `Sk.builtinFiles`.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("skulpt/dist/skulpt.js");
require("skulpt/dist/skulpt-stdlib.js");
