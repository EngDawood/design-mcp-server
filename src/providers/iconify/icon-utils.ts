/**
 * Copied from better-icons (MIT, Copyright better-auth contributors),
 * src/icon-utils.ts — https://github.com/better-auth/better-icons
 *
 * Adaptation: the preference-sorting helpers (`sortByLearnedPreferences`,
 * `sortByPreferredCollections`) were dropped — this server keeps no
 * per-user preferences and no caller needs style sorting; everything else
 * is byte-identical logic.
 */
export interface IconData {
  body: string;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
}

export interface IconSet {
  icons?: Record<string, IconData>;
  aliases?: Record<string, { parent: string }>;
  width?: number;
  height?: number;
}

/**
 * Resolve icon alias to the actual icon name.
 * Handles multi-level aliases (A → B → C).
 */
export function resolveIconAlias(iconSet: IconSet, name: string, maxDepth = 10): string {
  let current = name;
  let depth = 0;

  while (iconSet.aliases?.[current] && depth < maxDepth) {
    current = iconSet.aliases[current]?.parent ?? current;
    depth++;
  }

  return current;
}

// SVG elements that can have fill applied
const SVG_SHAPE_ELEMENTS = ["path", "circle", "rect", "polygon", "polyline", "line", "ellipse"];

/**
 * Add fill color to SVG elements that don't already have fill or stroke.
 * Handles all common SVG shape elements, not just path.
 */
function applyFillToBody(body: string, color: string): string {
  let result = body;

  for (const element of SVG_SHAPE_ELEMENTS) {
    // Match opening tags for this element that don't already have fill= or stroke=
    // Use a more precise regex that captures the full opening tag
    const tagRegex = new RegExp(`<${element}(?![^>]*(?:fill=|stroke=))([^>]*?)(/?)>`, "g");
    result = result.replace(tagRegex, `<${element} fill="${color}"$1$2>`);
  }

  return result;
}

export function buildSvg(
  iconData: IconData,
  defaults: { width?: number; height?: number },
  options?: { size?: number; color?: string }
): string {
  const width = iconData.width || defaults.width || 24;
  const height = iconData.height || defaults.height || 24;
  const viewBox = `${iconData.left || 0} ${iconData.top || 0} ${width} ${height}`;
  const svgSize = options?.size
    ? `width="${options.size}" height="${options.size}"`
    : `width="1em" height="1em"`;

  const color = options?.color || "currentColor";
  const body = applyFillToBody(iconData.body, color);

  return `<svg xmlns="http://www.w3.org/2000/svg" ${svgSize} viewBox="${viewBox}">${body}</svg>`;
}
