import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { snowMaterial, snowObject, snowUniforms, setSnowMelt, settleSnow, SNOW_SETTLE_S } from '../../src/render/snow.js';
import { teamMaterial } from '../../src/render/models.js';

/** Compile like three.js does: shader sources of the material type, then the material's additions. */
function compile(m, lib = 'standard') {
  const s = { uniforms: {}, vertexShader: THREE.ShaderLib[lib].vertexShader, fragmentShader: THREE.ShaderLib[lib].fragmentShader };
  m.onBeforeCompile(s, null);
  return s;
}

describe('Snow cover on buildings', () => {
  it('gives a snowy copy per source material and leaves the source untouched', () => {
    const src = new THREE.MeshStandardMaterial({ color: 0xa8503a });
    const key = src.customProgramCacheKey();
    const m = snowMaterial(src);
    expect(m).not.toBe(src);
    expect(snowMaterial(src)).toBe(m);
    expect(snowMaterial(m)).toBe(m);
    expect(src.customProgramCacheKey()).toBe(key);
    expect(m.customProgramCacheKey()).not.toBe(key);
    expect(m.color.getHex()).toBe(0xa8503a);
  });

  it('skips materials without lighting and empty input', () => {
    const basic = new THREE.MeshBasicMaterial();
    expect(snowMaterial(basic)).toBe(basic);
    expect(snowMaterial(null)).toBe(null);
    expect(snowObject(null)).toBe(null);
  });

  it('replaces the materials of an object, except meshes marked noSnow', () => {
    const src = new THREE.MeshStandardMaterial();
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(), src), b = new THREE.Mesh(new THREE.BoxGeometry(), [src, src]);
    const c = new THREE.Mesh(new THREE.BoxGeometry(), src);
    c.userData.noSnow = true;
    g.add(a, b, c);
    snowObject(g);
    expect(a.material).toBe(snowMaterial(src));
    expect(b.material).toEqual([a.material, a.material]);
    expect(c.material).toBe(src);
  });

  it('adds the snow to the shaders of all lit material types', () => {
    for (const [lib, M] of [['standard', THREE.MeshStandardMaterial], ['lambert', THREE.MeshLambertMaterial], ['phong', THREE.MeshPhongMaterial]]) {
      const s = compile(snowMaterial(new M()), lib);
      expect(s.uniforms.uBldSnow).toBe(snowUniforms.uBldSnow);
      expect(s.vertexShader).toContain('vSnowN = ');
      expect(s.fragmentShader).toContain('uniform float uBldSnow');
      // before lighting, after the colour
      expect(s.fragmentShader.indexOf('kSnowNoise(vSnowP')).toBeGreaterThan(s.fragmentShader.indexOf('#include <color_fragment>'));
      expect(s.fragmentShader.indexOf('kSnowNoise(vSnowP')).toBeLessThan(s.fragmentShader.indexOf('#include <alphatest_fragment>'));
      expect(s.fragmentShader).not.toContain('kTeamW');
    }
  });

  it('keeps the player colour free of snow', () => {
    const s = compile(snowMaterial(teamMaterial(new THREE.MeshStandardMaterial(), 0)));
    expect(s.uniforms.uTeam).toBeTruthy();
    expect(s.fragmentShader).toContain('(1.0 - kTeamW)');
    // the snow comes after the player colour
    expect(s.fragmentShader.indexOf('kTeamW = w;')).toBeLessThan(s.fragmentShader.indexOf('(1.0 - kTeamW)'));
  });

  it('copies of a snowy material (damage) melt on their own', () => {
    const m = snowMaterial(new THREE.MeshStandardMaterial());
    const copy = m.clone();
    copy.onBeforeCompile = m.onBeforeCompile;
    setSnowMelt(copy, 2);
    const a = compile(m), b = compile(copy);
    expect(a.uniforms.uSnowMelt.value).toBe(0);
    expect(b.uniforms.uSnowMelt.value).toBe(1);
    setSnowMelt(copy, 0.25);
    expect(b.uniforms.uSnowMelt.value).toBe(0.25);
  });

  it('settles and thaws within SNOW_SETTLE_S', () => {
    expect(settleSnow(0, 1, SNOW_SETTLE_S / 2)).toBeCloseTo(0.5);
    expect(settleSnow(0.9, 1, SNOW_SETTLE_S)).toBe(1);
    expect(settleSnow(1, 0, SNOW_SETTLE_S / 4)).toBeCloseTo(0.75);
    expect(settleSnow(0.1, 0, SNOW_SETTLE_S)).toBe(0);
    expect(settleSnow(1, 1, 0.1)).toBe(1);
  });
});
