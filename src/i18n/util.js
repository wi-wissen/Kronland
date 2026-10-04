/** Building names per level as flat keys building.<type>.<level>. */
export function levels(type, names) {
  const out = {};
  names.forEach((n, i) => { out[`building.${type}.${i}`] = n; });
  return out;
}
