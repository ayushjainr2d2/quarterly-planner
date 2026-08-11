/** One color per theme — shared between List and Timeline so a theme reads
 * the same everywhere. Deliberately medium-saturation so it holds up on both
 * the paper and ink backgrounds. */
export const THEME_PALETTE = [
  { bg: "#8b7bd8", text: "#ffffff", soft: "rgba(139,123,216,0.14)" },
  { bg: "#5aa9c7", text: "#ffffff", soft: "rgba(90,169,199,0.14)" },
  { bg: "#4fae8f", text: "#ffffff", soft: "rgba(79,174,143,0.14)" },
  { bg: "#c9974e", text: "#1a1408", soft: "rgba(201,151,78,0.16)" },
  { bg: "#c26b53", text: "#ffffff", soft: "rgba(194,107,83,0.14)" },
  { bg: "#7c8591", text: "#ffffff", soft: "rgba(124,133,145,0.14)" },
] as const;

export type ThemeColor = (typeof THEME_PALETTE)[number];

/** Hashes the theme name itself (not array position) so the same theme gets the
 * same color regardless of which view renders it or what order groups land in. */
export function themeColorFor(theme: string): ThemeColor {
  let hash = 0;
  for (let i = 0; i < theme.length; i++) {
    hash = (hash * 31 + theme.charCodeAt(i)) >>> 0;
  }
  return THEME_PALETTE[hash % THEME_PALETTE.length];
}
