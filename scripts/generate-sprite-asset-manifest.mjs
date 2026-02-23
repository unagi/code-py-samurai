import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SPRITES_ROOT = path.resolve("public/assets/sprites");
const OUTPUT_PATH = path.resolve("src/web/generated/sprite-assets.manifest.generated.json");

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SPRITE_FILE_RE = /^(?<state>[a-z][a-z0-9-]*?)(?:-(?<dir>east|west|left|right))?\.png$/;
const MANIFEST_STATE_ALIASES_BY_UNIT = {
  captive: {
    bound: "idle",
    rescued: "death",
  },
};

/**
 * @typedef {{ path: string; width: number; height: number; frames: number }} SpriteAssetFrameDef
 * @typedef {{ [variant: string]: SpriteAssetFrameDef }} SpriteAssetStateManifest
 * @typedef {{ [state: string]: SpriteAssetStateManifest }} UnitSpriteAssetManifest
 * @typedef {{ schemaVersion: 1; units: Record<string, UnitSpriteAssetManifest> }} SpriteAssetManifest
 */

async function readPngSize(filePath) {
  const buf = await readFile(filePath);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`Not a PNG file: ${filePath}`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid PNG size (${width}x${height}): ${filePath}`);
  }
  return { width, height };
}

function inferFrameCount(width, height, filePath) {
  if (width % height !== 0) {
    throw new Error(`Cannot infer frame count from non-square-strip image (${width}x${height}): ${filePath}`);
  }
  const frames = width / height;
  if (frames < 1 || !Number.isInteger(frames)) {
    throw new Error(`Invalid inferred frame count (${frames}) for: ${filePath}`);
  }
  return frames;
}

function normalizeManifestState(unitKind, rawState) {
  const aliases = MANIFEST_STATE_ALIASES_BY_UNIT[unitKind];
  if (!aliases) {
    return rawState;
  }
  return aliases[rawState] ?? rawState;
}

function toPublicAssetPath(absPath) {
  const rel = path.relative(path.resolve("public"), absPath).replaceAll(path.sep, "/");
  return `/${rel}`;
}

/**
 * @param {string} dirPath
 * @returns {Promise<string[]>}
 */
async function listDirectPngFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => path.join(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * @returns {Promise<SpriteAssetManifest>}
 */
async function buildManifest() {
  const units = /** @type {Record<string, UnitSpriteAssetManifest>} */ ({});
  const unitEntries = await readdir(SPRITES_ROOT, { withFileTypes: true });
  const unitDirs = unitEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  for (const unitKind of unitDirs) {
    const unitDirPath = path.join(SPRITES_ROOT, unitKind);
    const pngFiles = await listDirectPngFiles(unitDirPath);
    if (pngFiles.length === 0) continue;

    const unitManifest = /** @type {UnitSpriteAssetManifest} */ ({});

    for (const absFilePath of pngFiles) {
      const fileName = path.basename(absFilePath);
      const match = fileName.match(SPRITE_FILE_RE);
      if (!match?.groups) {
        continue;
      }

      const state = normalizeManifestState(unitKind, match.groups.state);
      const dir = match.groups.dir ?? "none";
      const { width, height } = await readPngSize(absFilePath);
      const frames = inferFrameCount(width, height, absFilePath);

      const stateManifest = unitManifest[state] ?? {};
      stateManifest[dir] = {
        path: toPublicAssetPath(absFilePath),
        width,
        height,
        frames,
      };
      unitManifest[state] = stateManifest;
    }

    if (Object.keys(unitManifest).length > 0) {
      units[unitKind] = unitManifest;
    }
  }

  return {
    schemaVersion: 1,
    units,
  };
}

async function main() {
  const manifest = await buildManifest();
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
