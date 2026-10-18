# Bake colour (+ optional normal map) of a high-poly building onto a low mesh (Blender 4.x headless).
# usage: blender -b -P bake.py -- high.glb low.obj out.glb size [--uv keep|smart] [--sharp DEG] [--nonormal]
#        [--extrude F] [--samples N]
# --uv keep: use the UV of the OBJ (e.g. from uv_xatlas.py); smart: Blender Smart UV Project.
# --sharp DEG: hard edges above DEG (split normals exported); a smooth cage (normals averaged per position)
#              keeps the bake rays continuous across hard edges.
import bpy, sys, math, bmesh
from mathutils import Vector

a = sys.argv[sys.argv.index('--') + 1:]
high_p, low_p, dst, size = a[0], a[1], a[2], int(a[3])
opt = {}
i = 4
while i < len(a):
    k = a[i][2:]
    if k in ('nonormal',):
        opt[k] = True
        i += 1
    else:
        opt[k] = a[i + 1]
        i += 2
uvmode = opt.get('uv', 'keep')
sharp = float(opt.get('sharp', 0))
extr = float(opt.get('extrude', 0.02))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=high_p)
highs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in highs:
    o.select_set(True)
bpy.context.view_layer.objects.active = highs[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(highs) > 1:
    bpy.ops.object.join()
high = bpy.context.view_layer.objects.active

bpy.ops.wm.obj_import(filepath=low_p)
low = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o is not high][0]
bpy.ops.object.select_all(action='DESELECT')
low.select_set(True)
bpy.context.view_layer.objects.active = low
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = low.data
print('LOW tris', len(me.polygons))

if uvmode == 'smart' or not me.uv_layers:
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    me.uv_layers.new(name='UV')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(float(opt.get('uvangle', 66))), island_margin=0.004)
    bpy.ops.uv.pack_islands(margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')

# shading: smooth, optionally hard edges above an angle
for p in me.polygons:
    p.use_smooth = True
if sharp > 0:
    bm = bmesh.new()
    bm.from_mesh(me)
    # edges between different (welded-by-position) faces: mark sharp by dihedral angle; UV seams of xatlas split
    # vertices, so compare by position
    key = lambda v: (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5))
    edges = {}
    for f in bm.faces:
        for e in f.edges:
            k = tuple(sorted((key(e.verts[0]), key(e.verts[1]))))
            edges.setdefault(k, []).append((f.normal.copy(), e))
    lim = math.radians(sharp)
    for k, lst in edges.items():
        if len(lst) == 2 and lst[0][0].angle(lst[1][0], 0) > lim:
            for _, e in lst:
                e.smooth = False
        elif len(lst) != 2:
            for _, e in lst:
                e.smooth = False
    bm.to_mesh(me)
    bm.free()
    me.update()

# cage: copy of the low mesh, every vertex pushed out along the normal averaged over all vertices at that position
bb = max(high.dimensions)
cage = low.copy()
cage.data = me.copy()
bpy.context.collection.objects.link(cage)
acc = {}
key3 = lambda co: (round(co.x, 5), round(co.y, 5), round(co.z, 5))
for p in cage.data.polygons:
    n = p.normal * p.area
    for vi in p.vertices:
        k = key3(cage.data.vertices[vi].co)
        acc[k] = acc.get(k, Vector()) + n
for v in cage.data.vertices:
    n = acc[key3(v.co)]
    if n.length > 0:
        v.co = v.co + n.normalized() * bb * extr

low.data.materials.clear()
mat = bpy.data.materials.new('baked')
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial')
bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
bsdf.inputs['Roughness'].default_value = 1.0
nt.links.new(bsdf.outputs[0], out.inputs[0])
ci = bpy.data.images.new('color', size, size, alpha=True)
ci.generated_color = (0, 0, 0, 0)
ct = nt.nodes.new('ShaderNodeTexImage')
ct.image = ci
nt.links.new(ct.outputs[0], bsdf.inputs['Base Color'])
if not opt.get('nonormal'):
    ni = bpy.data.images.new('normal', size, size, alpha=True)
    ni.generated_color = (0, 0, 0, 0)
    ni.colorspace_settings.name = 'Non-Color'
    nn = nt.nodes.new('ShaderNodeTexImage')
    nn.image = ni
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(nn.outputs[0], nm.inputs['Color'])
    nt.links.new(nm.outputs[0], bsdf.inputs['Normal'])
low.data.materials.append(mat)

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = int(opt.get('samples', 4))


def bake(kind, node):
    for x in nt.nodes:
        x.select = False
    node.select = True
    nt.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    high.select_set(True)
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    b = sc.render.bake
    b.use_selected_to_active = True
    b.use_cage = True
    b.cage_object = cage
    b.max_ray_distance = bb * extr * 3
    b.margin = 0
    b.margin_type = 'EXTEND'
    b.use_clear = True
    if kind == 'DIFFUSE':
        b.use_pass_direct = False
        b.use_pass_indirect = False
        b.use_pass_color = True
    else:
        b.normal_space = 'TANGENT'
    bpy.ops.object.bake(type=kind)


import os
stem = os.path.abspath(os.path.splitext(dst)[0])
def save(img, path):
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
bake('DIFFUSE', ct)
save(ci, stem + '_color.png')
if not opt.get('nonormal'):
    bake('NORMAL', nn)
    save(ni, stem + '_normal.png')
    ni.pack()
ci.pack()
bpy.data.objects.remove(cage, do_unlink=True)
bpy.data.objects.remove(high, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
low.select_set(True)
bpy.context.view_layer.objects.active = low
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_image_format='JPEG',
                          export_jpeg_quality=int(opt.get('jpeg', 88)), export_normals=True, export_tangents=False)
print('DONE')
