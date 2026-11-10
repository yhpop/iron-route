"""Offline Blender derivative inspection, NOT gameplay/browser/device evidence.
blender -b --factory-startup --python campaign/scripts/render_asset_inspection.py
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector,Quaternion
HERE=Path(__file__).resolve().parent
ASSETS=HERE.parent/'assets'
sys.path.insert(0,str(HERE.parents[3]/'source_v5/project/source'))
from improve_running_gear import belt_path,LENGTH,PITCH
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ASSETS/'tank_v5_articulated.glb'))
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24
scene.cycles.use_denoising=False # Installed Blender has no OpenImageDenoise support
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world.color=(.25,.25,.25)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.49,.54,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.view_settings.view_transform='AgX'
# Plain inspection ground, not new gameplay art.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.01))
ground=bpy.context.object;ground.name='InspectionGround'
mat=bpy.data.materials.new('InspectionGroundMaterial');mat.diffuse_color=(.13,.15,.17,1);ground.data.materials.append(mat)
bpy.ops.object.light_add(type='AREA',location=(2,6,10));key=bpy.context.object;key.data.energy=1800;key.data.shape='DISK';key.data.size=8
key.rotation_euler=(Vector((0,0,1))-key.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='SUN',location=(-4,0,7));sun=bpy.context.object;sun.data.energy=1.7;sun.data.angle=.35;sun.rotation_euler=(.4,-.6,-.3)
bpy.ops.object.camera_add(location=(11,13,8));camera=bpy.context.object
camera.rotation_euler=(Vector((0,1.4,1.35))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=12.9;scene.camera=camera
# Label is an explicit scene overlay attached to the inspection camera.
def label(text):
    existing=bpy.data.objects.get('InspectionLabel')
    if existing:bpy.data.objects.remove(existing,do_unlink=True)
    curve=bpy.data.curves.new('InspectionLabelCurve','FONT');curve.body=text;curve.size=.22;curve.align_x='LEFT';curve.space_line=1.25
    obj=bpy.data.objects.new('InspectionLabel',curve);scene.collection.objects.link(obj);obj.parent=camera;obj.location=(-6.15,4.18,-10)
    m=bpy.data.materials.get('InspectionLabelMaterial') or bpy.data.materials.new('InspectionLabelMaterial');m.use_nodes=True
    nt=m.node_tree;nt.nodes.clear();em=nt.nodes.new('ShaderNodeEmission');em.inputs[0].default_value=(.8,.91,1,1);em.inputs[1].default_value=1
    out=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(em.outputs[0],out.inputs[0]);curve.materials.append(m)
label('OFFLINE ASSET INSPECTION | NEUTRAL RIG\nOriginal V5 geometry / no browser or gameplay validation')
scene.render.filepath=str(ASSETS/'inspection-neutral.png');bpy.ops.render.render(write_still=True)
# Counter-moving belts, independent elevated turret, rearward-only barrel recoil.
travel={'L':.38/.455,'R':-.38/.455}
for side in ['L','R']:
    for i in range(56):
        n=bpy.data.objects[f'Track_{side}_{i:02d}'];y,z,a=belt_path(i*PITCH-travel[side]);n.location=((-1 if side=='L' else 1)*1.68,y,z-.0775);n.rotation_mode='QUATERNION';n.rotation_quaternion=Quaternion((1,0,0),a)
    for i in range(6):bpy.data.objects[f'Wheel_{side}_{i}'].rotation_quaternion=Quaternion((1,0,0),-travel[side]/.37)
    for i in range(2):bpy.data.objects[f'Guide_{side}_{i}'].rotation_quaternion=Quaternion((1,0,0),-travel[side]/.34)
bpy.data.objects['TurretPivot'].rotation_quaternion=Quaternion((0,0,1),.52)
bpy.data.objects['GunElevationPivot'].rotation_quaternion=Quaternion((1,0,0),.22)
bpy.data.objects['RecoilPivot'].location.y=-.08/.455
label('OFFLINE ASSET INSPECTION | ARTICULATED RIG\nL +0.38 m / R -0.38 m | yaw 30 deg / elevation 13 deg / recoil 8 cm')
scene.render.filepath=str(ASSETS/'inspection-articulated.png');bpy.ops.render.render(write_still=True)
print('OFFLINE_INSPECTION_COMPLETE')
