// Which GPU resources must survive when the renderer of an old world is freed while a successor keeps using the same
// WebGL renderer (stage restart, world switch). Pure scene-graph walking, no WebGL: tests/render/restartReuse.test.js.

/**
 * Add the geometries, materials and textures of the given scene roots to a set.
 * @param {Iterable<any>} roots objects with traverse() (scenes, groups, cached model roots)
 * @param {Set<any>} [into]
 * @returns {Set<any>}
 */
export function collectHeld(roots, into = new Set()) {
  for (const root of roots) {
    root?.traverse?.((o) => {
      if (o.geometry) into.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        into.add(m);
        for (const v of Object.values(m)) if (v?.isTexture) into.add(v);
      }
    });
  }
  return into;
}
