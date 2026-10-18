# python -I uv.py <dir> [resolution]  -> <dir>/low_uv.obj (positions from low.obj, UV from xatlas run on low_uvin.obj)
import sys, numpy as np, xatlas
d = sys.argv[1]; res = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
def read(f):
    v, fc = [], []
    for l in open(f):
        p = l.split()
        if not p: continue
        if p[0] == 'v': v.append([float(x) for x in p[1:4]])
        elif p[0] == 'f': fc.append([int(x.split('/')[0]) - 1 for x in p[1:4]])
    return np.array(v, dtype=np.float32), np.array(fc, dtype=np.uint32)
v, f = read(d + '/low.obj'); vm, _ = read(d + '/low_uvin.obj')
atlas = xatlas.Atlas()
atlas.add_mesh(vm, f)
co = xatlas.ChartOptions(); co.max_iterations = 4
po = xatlas.PackOptions(); po.resolution = res; po.padding = 6; po.bilinear = True; po.bruteForce = True
atlas.generate(co, po)
vmap, idx, uv = atlas[0]
print('charts', atlas.chart_count, 'verts', len(vmap), 'util', atlas.utilization)
with open(d + '/low_uv.obj', 'w') as o:
    for i in vmap: o.write('v %f %f %f\n' % tuple(v[i]))
    for t in uv: o.write('vt %f %f\n' % (t[0], t[1]))
    for t in idx: o.write('f %d/%d %d/%d %d/%d\n' % (t[0]+1, t[0]+1, t[1]+1, t[1]+1, t[2]+1, t[2]+1))
