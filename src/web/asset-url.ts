/**
 * Resolve a public asset path using Vite's BASE_URL.
 *
 * In development BASE_URL is "/", in GitHub Pages it is "/code-py-samurai/".
 * Accepts paths with or without a leading slash:
 *   assetUrl("/assets/tiles/cave-floor.png")
 *   assetUrl("assets/tiles/cave-floor.png")
 * Both return the correctly prefixed path.
 */
const BASE = import.meta.env.BASE_URL;

export function assetUrl(path: string): string {
  const relative = path.startsWith("/") ? path.slice(1) : path;
  return `${BASE}${relative}`;
}
