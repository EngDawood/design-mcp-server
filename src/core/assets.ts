/**
 * The unified asset shape providers map their results onto, so callers (and
 * future cross-provider tools like a unified search) see one vocabulary no
 * matter which source an asset came from.
 */
export type AssetKind = "icon" | "illustration" | "photo" | "logo" | "animation";

export interface Asset {
  /** Provider id, e.g. "iconify". */
  provider: string;
  /** Provider-native id, e.g. "lucide:home" for Iconify. */
  id: string;
  /** Display title or name. */
  title: string;
  kind: AssetKind;
  /** Fetchable preview image URL, when the source offers one. */
  previewUrl?: string;
  /** Fetchable URL of the asset itself (SVG/PNG/JSON per the source). */
  assetUrl?: string;
  /** Page about this asset on the source site, when one exists. */
  pageUrl?: string;
  /** License label as the source states it, e.g. "MIT", "Free with attribution". */
  license?: string;
}
