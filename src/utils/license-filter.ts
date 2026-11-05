/**
 * Copied from asset-finder-mcp (MIT, Erfangit23) — see THIRD_PARTY.md.
 */
import type { Asset, LicenseType } from "../types.js";

/**
 * Filters assets by license type.
 */
export function filterByLicense(assets: Asset[], license?: LicenseType): Asset[] {
  if (!license) return assets;
  return assets.filter((a) => {
    if (license === "free-for-commercial") {
      return ["mit", "cc0", "cc-by", "free-for-commercial"].includes(a.license);
    }
    return a.license === license;
  });
}

/**
 * Filters assets by format.
 */
export function filterByFormat(assets: Asset[], format?: string): Asset[] {
  if (!format) return assets;
  return assets.filter((a) => a.format === format);
}

/**
 * Filters assets by dominant color (basic hex matching).
 */
export function filterByColor(assets: Asset[], color?: string): Asset[] {
  if (!color) return assets;
  const normalized = color.toLowerCase().replace("#", "");
  return assets.filter((a) => {
    if (!a.colorPalette) return false;
    return a.colorPalette.some(
      (c) => c.toLowerCase().replace("#", "") === normalized
    );
  });
}
