# blender -b -P bake.py -- <near_unpacked.glb> <low_uv.obj> <outprefix> <size> <smoothAngleDeg>
import bpy, sys, re, math, mathutils
near_path, low_path, prefix, S, ang = sys.argv[sys.argv.index('--') + 1:][:5]
S = int(S); ang = float(ang)
bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.context.scene.objects)
bpy.ops.import_scene.gltf(filepath=near_path)
new = [o for o in bpy.context.scene.objects if o not in before]
meshes = sorted([o for o in new if o.type == 'MESH' and not re.search(r'_netz$', o.name)], key=lambda o: -len(o.data.polygons))
high = meshes[0]
for m in list(high.modifiers):
    if m.type == 'ARMATURE': high.modifiers.remove(m)
M = high.matrix_world.copy()
for o in new:
    if o is not high: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.wm.obj_import(filepath=low_path, forward_axis='NEGATIVE_Z', up_axis='Y')
low = [o for o in bpy.context.scene.objects if o is not high][0]
bpy.ops.object.select_all(action='DESELECT'); low.select_set(True); bpy.context.view_layer.objects.active = low; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
high.select_set(True); bpy.context.view_layer.objects.active = high; bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
M = mathutils.Matrix.Identity(4)
low.matrix_world = M
high.matrix_world = M
bpy.ops.object.select_all(action='DESELECT')
low.select_set(True); bpy.context.view_layer.objects.active = low
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(ang))
mat = bpy.data.materials.new('bake'); mat.use_nodes = True
nt = mat.node_tree; nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
nt.links.new(bsdf.outputs[0], out.inputs[0])
low.data.materials.clear(); low.data.materials.append(mat)
def target(name, srgb):
    img = bpy.data.images.new(name, S, S, alpha=False)
    img.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    node = nt.nodes.new('ShaderNodeTexImage'); node.image = img
    return img, node
cimg, cnode = target('color', True); nimg, nnode = target('normal', False)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 16
reach = max(high.dimensions)
def bake(kind, node):
    for n in nt.nodes: n.select = False
    node.select = True; nt.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    high.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active = low
    b = sc.render.bake
    b.use_selected_to_active = True
    b.cage_extrusion = reach * float(__import__('os').environ.get('CAGE', '0.02'))
    b.max_ray_distance = reach * 0.08
    b.margin = 16; b.margin_type = 'EXTEND'; b.use_clear = True
    if kind == 'DIFFUSE':
        b.use_pass_direct = False; b.use_pass_indirect = False; b.use_pass_color = True
    if kind == 'NORMAL': b.normal_space = 'TANGENT'
    bpy.ops.object.bake(type=kind)
bake('DIFFUSE', cnode); bake('NORMAL', nnode)
for img, ext in ((cimg, 'color'), (nimg, 'normal')):
    img.filepath_raw = f'{prefix}.{ext}.png'; img.file_format = 'PNG'; img.save()
# export the low mesh in raw mesh space with Blender's normals + MikkTSpace tangents
low.matrix_world = mathutils.Matrix.Identity(4)
bpy.ops.object.select_all(action='DESELECT'); low.select_set(True)
bpy.data.objects.remove(high, do_unlink=True)
bpy.ops.export_scene.gltf(filepath=f'{prefix}.low.glb', use_selection=True, export_tangents=True, export_normals=True, export_texcoords=True, export_materials='NONE', export_yup=True, export_apply=True)
print('BAKE_DONE')
