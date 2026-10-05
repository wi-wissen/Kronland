// Prompt building blocks for concept images (see docs/STIL.md). English, because image models work most
// reliably with it.

/** Marker colour for team areas (becomes the mask texture in postprocess.mjs). */
export const MARKER = 'pure magenta (#FF00FF)';

export const STYLE = [
  'Character turnaround sheet: exactly four full-body views side by side – front, right side, back, left side –',
  'same character, A-pose (arms angled down ~40°, hands open), feet flat, standing straight.',
  'Stylized 3D-render look (warm, soft, hand-painted textures), stocky proportions (large head and hands, short legs,',
  'about 4 heads tall), clear readable silhouette from a high top-down game camera.',
  'Plain uniform light warm-grey background, no shadows on the ground, no props in the hands unless the description names a weapon or tool held in the hand, no text, no frame.',
  `All team-color areas (scarf, cap or headband, banners) are painted in ${MARKER} but keep their material structure,`,
  'folds, knit pattern and soft shading (do not paint them as a flat color fill); magenta appears nowhere else.',
  'Clothing in linen, brown, leather and grey tones – no green clothing (it would blend into the grass).',
  'Medieval peasant fantasy setting, no modern items, no logos.',
].join(' ');

export const FEMALE = [
  'Turn this male character into a female counterpart: same profession, same clothing pieces, colors and materials,',
  'same marker-colored areas, same art style, proportions and A-pose, same four views and background.',
  'Change face, hair and body shape to a woman; no beard.',
  'Keep every held tool, weapon or object EXACTLY as in the male sheet (same hand, same position away from the body), keep stoles, sashes and capes.',
].join(' ');

/**
 * Simplified far concept (game model) from the detail sheet: same character, large shapes, flat colours.
 * Used this way for the serfs (the woman later got a simple face added afterwards – which is why
 * the face is included here right away).
 */
export const FAR = [
  'Create a strongly SIMPLIFIED low-detail version of this exact character for viewing from far away in a strategy game',
  '(figure only 40 pixels tall). Keep the same four views, A-pose, proportions, stocky silhouette, background and the',
  'same main colors. Simplify: hair becomes ONE solid chunky smooth shape (like a sculpted helmet of hair / one thick',
  'braid or bun, no loose strands or curls), clothing becomes a few large flat color areas with clear light/dark',
  'contrast, remove small pouches, buckles, straps, patches, stitching, laces and wrinkles, hands as simple mitten-like',
  'shapes, boots as simple blocks. Big clean shapes, flat even colors with only soft shading. Keep a simple friendly face:',
  'two simple dark eyes, simple eyebrows, a small nose and mouth. The team-color areas (cap or headband and scarf) stay',
  `${MARKER}, large and clearly visible from above; magenta nowhere else.`,
].join(' ');
