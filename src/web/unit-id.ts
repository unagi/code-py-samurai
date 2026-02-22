export function normalizeIdPrefix(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

export function stripTrailingDigits(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] >= "0" && value[end - 1] <= "9") end--;
  return value.slice(0, end);
}
