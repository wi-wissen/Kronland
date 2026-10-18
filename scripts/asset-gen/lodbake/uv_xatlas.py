# UV atlas for a low mesh with xatlas (pip install xatlas numpy).
# usage: python uv_xatlas.py in.obj out.obj resolution   (env XA_COST, XA_PAD, XA_NDW)
import sys, os
import numpy as np
import xatlas

src, dst, res = sys.argv[1], sys.argv[2], int(sys.argv[3])
V, F = [], []
for line in open(src):
    p = line.split()
    if not p:
        continue
    if p[0] == 'v':
        V.append([float(x) for x in p[1:4]])
    elif p[0] == 'f':
        F.append([int(x.split('/')[0]) - 1 for x in p[1:4]])
V = np.array(V, dtype=np.float32)
F = np.array(F, dtype=np.uint32)
atlas = xatlas.Atlas()
atlas.add_mesh(V, F)
co = xatlas.ChartOptions()
co.max_iterations = 4
co.normal_deviation_weight = float(os.environ.get('XA_NDW', 2.0))
co.straightness_weight = 6.0
co.normal_seam_weight = 4.0
co.max_cost = float(os.environ.get('XA_COST', 2.0))
po = xatlas.PackOptions()
po.resolution = res
po.padding = int(os.environ.get('XA_PAD', 4))
po.bilinear = True
po.blockAlign = False
po.bruteForce = True
atlas.generate(co, po)
vmap, idx, uvs = atlas[0]
print('charts', atlas.chart_count, 'verts', len(vmap), 'util', atlas.utilization)
with open(dst, 'w') as f:
    for i in vmap:
        f.write('v %f %f %f\n' % tuple(V[i]))
    for u in uvs:
        f.write('vt %f %f\n' % (u[0], u[1]))
    for t in idx:
        a, b, c = t + 1
        f.write('f %d/%d %d/%d %d/%d\n' % (a, a, b, b, c, c))
