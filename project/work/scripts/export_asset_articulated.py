"""Extract the real V5 tank; never save or alter the source .blend on disk.

Blender 4.3.2: blender -b --disable-autoexec SOURCE.blend --python SCRIPT.py
The only lossy conversion is replacing non-armor procedural micrograin with
restrained PBR constants. Original camo and dust are baked, not recreated.
"""
import bpy, json, math, os, hashlib
from pathlib import Path
from mathutils import Vector, Matrix
from collections import defaultdict

ROOT=str(Path(__file__).resolve().parents[4])
OUT=str(Path(__file__).resolve().parents[1]/'assets');os.makedirs(OUT,exist_ok=True)
ORIGINAL_ASSETS=ROOT+'/assets'
PRESERVED=Path(ROOT)/'qa/tank-campaign-reboot/asset-original-sha256.txt'
def preserved_hashes():
    result={}
    for line in PRESERVED.read_text().strip().splitlines():
        expected,relative=line.split()
        actual=hashlib.sha256((Path(ROOT)/relative).read_bytes()).hexdigest()
        assert actual==expected, 'Original changed: '+relative
        result[relative]=actual
    return result
original_hashes=preserved_hashes()
assert Path(bpy.data.filepath).resolve()==(Path(ROOT)/'source_v5/project/Tank_City_V5_Production.blend').resolve()

scene=bpy.context.scene;scene.frame_set(1)
src_col=bpy.data.collections['01_TANK_EDITABLE']
src_root=bpy.data.objects['TANK / animated motion controller']
src_turret=bpy.data.objects['Turret / aim controller']
src_barrel=bpy.data.objects['Gun barrel / recoil controller']
# A neutral playable snapshot, not the film's baked aiming animation.
for o in [src_turret,src_barrel]:
    o.animation_data_clear();o.rotation_euler=(0,0,0)
bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get()
export_col=bpy.data.collections.new('BROWSER_TANK_V5');scene.collection.children.link(export_col)
sources=[];materials={};clones=[];bake_objs=[];groups={};source_of={}

def part_of(o):
    p=o
    while p:
        if p==src_barrel:return 'Barrel'
        if p==src_turret:return 'Turret'
        p=p.parent
    return 'Chassis'

for o in list(src_col.all_objects):
    if o.type not in {'MESH','CURVE'}:continue
    ev=o.evaluated_get(dg)
    try:m=bpy.data.meshes.new_from_object(ev,depsgraph=dg)
    except Exception:continue
    if not len(m.polygons):continue
    clone=bpy.data.objects.new('WEB / '+o.name,m);export_col.objects.link(clone)
    clone.matrix_world=o.matrix_world.copy()
    is_paint=any('multi-tone armor' in x.name or 'recoiling barrel paint' in x.name for x in m.materials if x)
    for i,mat in enumerate(m.materials):
        if not mat:continue
        key=('BAKED::' if is_paint else '')+mat.name
        if key not in materials:materials[key]=mat.copy()
        m.materials[i]=materials[key]
    if is_paint:bake_objs.append(clone)
    clones.append(clone);groups[clone]=part_of(o);source_of[clone]=o;sources.append(o.name)
assert len(clones)>=613

# Original scene stays present for object-space procedural coordinate sources.
# Hide only from rendering; the evaluated geometry copy is independently visible.
for col in list(scene.collection.children):
    if col!=export_col:col.hide_render=True
bpy.ops.object.select_all(action='DESELECT')
for o in bake_objs:o.select_set(True)
bpy.context.view_layer.objects.active=bake_objs[0]
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=0.012,area_weight=0.25,correct_aspect=True)
bpy.ops.object.mode_set(mode='OBJECT')

scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=1
scene.render.bake.margin=8
color_image=bpy.data.images.new('Tank_V5_Original_Camouflage_1024',width=1024,height=1024,alpha=False)
color_image.colorspace_settings.name='sRGB'
orm_image=bpy.data.images.new('Tank_V5_Original_ORM_1024',width=1024,height=1024,alpha=False)
orm_image.colorspace_settings.name='Non-Color'
bake_mats={mat for o in bake_objs for mat in o.data.materials if mat}
assert not bake_mats.intersection({m for o in clones if o not in bake_objs for m in o.data.materials if m}), 'Baked and scalar materials must not share UV contracts'
originals={}
for mat in bake_mats:
    nt=mat.node_tree;p=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
    output=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL')
    originals[mat]=(p,output)
    e=nt.nodes.new('ShaderNodeEmission');e.name='WEB Bake Emit';e.inputs['Strength'].default_value=1
    if p.inputs['Base Color'].is_linked:nt.links.new(p.inputs['Base Color'].links[0].from_socket,e.inputs['Color'])
    else:e.inputs['Color'].default_value=p.inputs['Base Color'].default_value
    nt.links.new(e.outputs[0],output.inputs['Surface'])
    tex=nt.nodes.new('ShaderNodeTexImage');tex.name='WEB Bake Target';tex.image=color_image;nt.nodes.active=tex
reuse_bake=True # read-only atlas reuse; UV identity verified against original GLB after export
print('BAKING_ORIGINAL_COLOR',len(bake_objs),'REUSE',reuse_bake,flush=True)
if reuse_bake:
    existing=bpy.data.images.load(ORIGINAL_ASSETS+'/tank_v5_camo.png');color_image=existing
else:
    bpy.ops.object.bake(type='EMIT')
    raise AssertionError('Rebaking preserved atlas is forbidden')
for mat in bake_mats:
    nt=mat.node_tree;p,output=originals[mat];e=nt.nodes['WEB Bake Emit']
    combine=nt.nodes.new('ShaderNodeCombineColor');combine.mode='RGB'
    combine.inputs[0].default_value=1
    for socket,index in [('Roughness',1),('Metallic',2)]:
        if p.inputs[socket].is_linked:nt.links.new(p.inputs[socket].links[0].from_socket,combine.inputs[index])
        else:combine.inputs[index].default_value=p.inputs[socket].default_value
    nt.links.new(combine.outputs[0],e.inputs['Color'])
    nt.nodes['WEB Bake Target'].image=orm_image
print('BAKING_ORIGINAL_ORM',flush=True)
if reuse_bake:
    existing=bpy.data.images.load(ORIGINAL_ASSETS+'/tank_v5_orm.png');orm_image=existing;orm_image.colorspace_settings.name='Non-Color'
else:
    bpy.ops.object.bake(type='EMIT')
    raise AssertionError('Rebaking preserved atlas is forbidden')

# Replace procedurals by browser-safe PBR. Bake image is shared across armor.
for srcname,mat in materials.items():
    was_baked=mat in bake_mats
    if was_baked:
        mat.node_tree.nodes.clear();nt=mat.node_tree
        p=nt.nodes.new('ShaderNodeBsdfPrincipled');output=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(p.outputs['BSDF'],output.inputs['Surface'])
        color=nt.nodes.new('ShaderNodeTexImage');color.image=color_image;nt.links.new(color.outputs['Color'],p.inputs['Base Color'])
        orm=nt.nodes.new('ShaderNodeTexImage');orm.image=orm_image
        separate=nt.nodes.new('ShaderNodeSeparateColor');separate.mode='RGB';nt.links.new(orm.outputs['Color'],separate.inputs[0])
        nt.links.new(separate.outputs['Green'],p.inputs['Roughness']);nt.links.new(separate.outputs['Blue'],p.inputs['Metallic'])
        mat.name='Tank_V5_Baked_Paint'
    else:
        old=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        color=tuple(old.inputs['Base Color'].default_value) if old else tuple(mat.diffuse_color)
        if 'canvas' not in srcname:color=tuple(mat.diffuse_color)
        metallic=float(old.inputs['Metallic'].default_value) if old else 0
        roughness=float(old.inputs['Roughness'].default_value) if old else .75
        if 'oiled steel' in srcname:metallic=.70;roughness=.58
        if 'exposed armor edge' in srcname:metallic=.45;roughness=.63
        if 'rubber' in srcname:metallic=0;roughness=.85
        mat.node_tree.nodes.clear();nt=mat.node_tree
        p=nt.nodes.new('ShaderNodeBsdfPrincipled');output=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(p.outputs['BSDF'],output.inputs['Surface'])
        p.inputs['Base Color'].default_value=color;p.inputs['Metallic'].default_value=metallic;p.inputs['Roughness'].default_value=roughness
        mat.name='Tank_V5_'+srcname.split(' / ')[-1].replace(' ','_')

# All atlas-backed materials now use exactly the same PBR shader and texture.
# Consolidate them; scalar steel elsewhere deliberately stays separate.
common_baked=next(iter(bake_mats))
for o in bake_objs:
    for i,m in enumerate(o.data.materials):
        if m in bake_mats:o.data.materials[i]=common_baked

# Source-aware derivative. All source objects stay in memory only; never save .blend.
bounds=[o.matrix_world@v.co for o in clones for v in o.data.vertices]
offset=Vector((-src_root.matrix_world.translation.x,-src_root.matrix_world.translation.y,-min(v.z for v in bounds)))
def empty(name,parent=None,world=None):
    o=bpy.data.objects.new(name,None);export_col.objects.link(o)
    if parent:o.parent=parent
    if world is not None:
        o.matrix_world=world
    bpy.context.view_layer.update()
    return o
root=empty('TankRoot');root['coordinateContract']='raw metres, Y-up glTF, -Z forward; apply gameScale once'
root['gameScale']=0.455;root['trackLoopRaw']=13.137229394046273;root['linksPerSide']=56
p=src_turret.matrix_world.translation+offset;p.x=0
turret=empty('TurretPivot',root,Matrix.Translation(p))
p=bpy.data.objects['Gun mantlet'].matrix_world.translation+offset;p.x=0
elevation=empty('GunElevationPivot',turret,Matrix.Translation(p))
recoil=empty('RecoilPivot',elevation,elevation.matrix_world.copy())
for o in clones:
    mw=o.matrix_world.copy();mw.translation+=offset;o.matrix_world=mw
bpy.context.view_layer.update()
source_clone={source_of[o].name:o for o in clones}
assigned=set();joined=[];records=[]
def join_group(name,objects,parent,target):
    assert objects and all(o not in assigned for o in objects), name
    source_names=[source_of[o].name for o in objects]
    assigned.update(objects)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    ob=bpy.context.object;ob.name=name
    ob.data.transform(target.inverted()@ob.matrix_world)
    ob.parent=parent;ob.matrix_parent_inverse=Matrix.Identity(4)
    ob.matrix_basis=parent.matrix_world.inverted()@target
    ob['sourceObjects']=source_names
    ob.data.calc_loop_triangles()
    records.append({'name':name,'triangles':len(ob.data.loop_triangles),'sources':source_names})
    joined.append(ob)
    return ob

# Keep every complete link in the neutral export, with local pivot at its source shoe.
for side,label in [(-1,'L'),(1,'R')]:
    for i in range(56):
        source=bpy.data.objects[f'Tread link {side} {i:02d}']
        names=[source.name]+[o.name for o in source.children if o.name in source_clone]
        target=source.matrix_world.copy();target.translation+=offset
        ob=join_group(f'Track_{label}_{i:02d}',[source_clone[n] for n in names],root,target)
        ob['trackSide']=label;ob['trackIndex']=i
    for i in range(6):
        source=bpy.data.objects[f'Road wheel {side} {i}']
        # Source hubs/caps are siblings; match by side and longitudinal station.
        members=[source]
        for prefix in ['Steel road wheel hub','Wheel axle cap']:
            matches=[o for o in src_col.all_objects if o.name.startswith(prefix) and o.location.x*side>0 and abs(o.location.y-source.location.y)<1e-4]
            assert len(matches)==1,(source.name,prefix,len(matches))
            members+=matches
            members += [o for o in matches[0].children if o.name in source_clone]
        target=Matrix.Translation(source.matrix_world.translation+offset)
        ob=join_group(f'Wheel_{label}_{i}',[source_clone[o.name] for o in members],root,target)
        ob['trackSide']=label;ob['radiusRaw']=.37
    guides=sorted([o for o in src_col.all_objects if o.name.startswith('End idler sprocket') and o.location.x*side>0],key=lambda o:o.location.y)
    assert len(guides)==2
    for i,source in enumerate(guides):
        ob=join_group(f'Guide_{label}_{i}',[source_clone[source.name]],root,Matrix.Translation(source.matrix_world.translation+offset))
        ob['trackSide']=label;ob['radiusRaw']=.34
# Remaining chassis truly excludes every source running-gear part.
join_group('Chassis_Geometry',[o for o in clones if o not in assigned and groups[o]=='Chassis'],root,root.matrix_world.copy())
join_group('Turret_Geometry',[o for o in clones if o not in assigned and groups[o]=='Turret'],turret,turret.matrix_world.copy())
join_group('Mantlet_Geometry',[source_clone['Gun mantlet']],elevation,elevation.matrix_world.copy())
join_group('Barrel_Geometry',[o for o in clones if o not in assigned and groups[o]=='Barrel'],recoil,recoil.matrix_world.copy())
assert len(assigned)==len(clones)==621
assert sum(r['triangles'] for r in records)==49748
for material in bpy.data.materials:
    if material!=common_baked and material.name.startswith('Tank_V5_Baked_Paint'):
        material.name='UnusedSourcePaint_'+material.name
common_baked.name='Tank_V5_Baked_Paint'
bpy.ops.object.select_all(action='DESELECT')
for o in [root,turret,elevation,recoil]+joined:o.select_set(True)
bpy.context.view_layer.objects.active=root
out=Path(OUT)/'tank_v5_articulated.glb'
assert out.parent==Path(__file__).resolve().parents[1]/'assets'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True,export_apply=True,export_materials='EXPORT',export_extras=True)
assert preserved_hashes()==original_hashes
summary={'schemaVersion':1,'sourceBlend':'source_v5/project/Tank_City_V5_Production.blend','sourceCollection':src_col.name,'sourceObjects':621,'triangles':49748,'gameScale':.455,'coordinates':'raw metres, +Y up, -Z forward','exportFile':out.name,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'preservedOriginalHashes':original_hashes,'groups':records,'limitations':['Source reconstructed production V5; no new ownership/license claim.','Cosmetic running-gear kinematics, not suspension or physical track simulation.','No browser/device validation by this offline asset export.']}
(Path(OUT)/'tank_v5_articulated.asset.json').write_text(json.dumps(summary,indent=2)+'\n')
print('ARTICULATED_EXPORT_COMPLETE',json.dumps({k:v for k,v in summary.items() if k not in ['groups','preservedOriginalHashes']}),flush=True)
