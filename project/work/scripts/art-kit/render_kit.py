"""Blender offline look-development of round-tripped SHIPPING GLBs. Not browser evidence."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/art-kit';R=OUT/'renders'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
S=bpy.context.scene;S.render.engine='CYCLES';S.cycles.device='CPU';S.cycles.samples=24;S.cycles.use_denoising=False;S.render.threads_mode='FIXED';S.render.threads=4
S.render.resolution_x=1440;S.render.resolution_y=900;S.render.resolution_percentage=100
S.world.use_nodes=True;bg=S.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.4,.46,.5,1);bg.inputs[1].default_value=.65
S.view_settings.view_transform='AgX';S.view_settings.look='AgX - Medium High Contrast'

def load(key,loc=(0,0,0),rot=0):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(OUT/(key+'.glb')));new=set(bpy.data.objects)-before;roots=[o for o in new if not o.parent]
 group=bpy.data.objects.new(key+'_INSPECTION',None);S.collection.objects.link(group)
 for o in roots:o.parent=group
 group.location=loc;group.rotation_euler.z=rot;return group

def hidden(g,v):
 for o in [g]+list(g.children_recursive):o.hide_render=v

def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));plane=bpy.context.object;plane.name='Offline inspection ground'
m=bpy.data.materials.new('Studio ground');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.19,.215,.205,1);p.inputs['Roughness'].default_value=.87;plane.data.materials.append(m)
bpy.ops.object.light_add(type='SUN',location=(-10,5,15));sun=bpy.context.object;sun.data.energy=2.2;sun.data.angle=.16;aim(sun,(0,0,0))
bpy.ops.object.light_add(type='AREA',location=(7,4,12));light=bpy.context.object;light.data.energy=1800;light.data.shape='DISK';light.data.size=10;aim(light,(0,0,1))
bpy.ops.object.camera_add(location=(22,30,24));cam=bpy.context.object;cam.data.type='ORTHO';S.camera=cam
labelmat=bpy.data.materials.new('Inspection annotation');labelmat.use_nodes=True;nt=labelmat.node_tree;nt.nodes.clear();em=nt.nodes.new('ShaderNodeEmission');em.inputs[0].default_value=(.85,.9,.86,1);out=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(em.outputs[0],out.inputs[0])
def label(body,scale):
 old=bpy.data.objects.get('Offline-render-label')
 if old:bpy.data.objects.remove(old,do_unlink=True)
 c=bpy.data.curves.new('Inspection annotation','FONT');c.body=body;c.size=scale*.016;c.space_line=1.3;c.materials.append(labelmat);o=bpy.data.objects.new('Offline-render-label',c);S.collection.objects.link(o);o.parent=cam;o.location=(-scale*.47,scale*.275,-10)
def render(name,body,location,target,scale):
 cam.location=location;aim(cam,target);cam.data.ortho_scale=scale;label(body,(2*10*math.tan(cam.data.angle_x/2)) if cam.data.type=='PERSP' else scale);S.render.filepath=str(R/name);bpy.ops.render.render(write_still=True);print('RENDERED',name,flush=True)
warehouse=load('warehouse-sawtooth',(-9,-2,0));pump=load('pump-station',(0,-2,0));workshop=load('service-workshop',(9,-2,0));truck=load('cargo-truck',(-3,6,0),-.2);turret=load('sentry-turret',(2,6,0),.25)
render('01-industrial-kit.png','OFFLINE BLENDER LOOK DEVELOPMENT  /  EXPORTED GLBs\nCANAL DISTRICT  |  3 reusable buildings + cargo vehicle + sentry', (23,32,27),(0,0,1.4),34)
bpy.data.objects['Offline-render-label'].hide_render=True;S.render.filepath=str(R/'00-clean-kit-preview.png');bpy.ops.render.render(write_still=True);bpy.data.objects['Offline-render-label'].hide_render=False;print('RENDERED 00-clean-kit-preview.png',flush=True)
for o in [warehouse,pump,workshop]:hidden(o,True)
truck.location=(-1.7,0,0);truck.rotation_euler.z=-.12;turret.location=(1.7,.1,0);turret.rotation_euler.z=.15
render('02-vehicle-and-sentry.png','OFFLINE BLENDER  /  SHIPPING GLB DETAIL\nFormed cab, tied cargo cover, running gear / articulated sentry',(7,10,6.7),(0,0,1),8.3)
# Same yaw and camera elevation ratio as the campaign camera, at its actual scene scale.
truck.location=(2.6,0,0);turret.location=(5,4,0)
hidden(warehouse,False);warehouse.location=(-5,7,0)
# Existing tank is imported without modification, solely as a metre-scale reference.
tankroots=[];tank_reference=ROOT/'assets/tank_v5_articulated.glb'
if tank_reference.is_file():
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(tank_reference));tankroots=[o for o in set(bpy.data.objects)-before if not o.parent]
 for o in tankroots:o.scale=(.455,.455,.455);o.location=(-2.2,-2.4,0)
cam.data.type='PERSP';cam.data.sensor_fit='VERTICAL';cam.data.sensor_height=24;cam.data.lens=24/(2*math.tan(math.radians(21)))
render('03-game-camera-scale.png','OFFLINE BLENDER  /  CAMPAIGN-CAMERA SCALE\nExported art assets, not gameplay or browser evidence',(10,-17,19.5),(0,1,.5),24)
for o in tankroots:hidden(o,True)
# Individual building closeups keep facade details reviewable.
hidden(truck,True);hidden(turret,True);hidden(warehouse,True);cam.data.type='ORTHO'
for key,g in [('warehouse-sawtooth',warehouse),('pump-station',pump),('service-workshop',workshop)]:
 hidden(g,False);g.location=(0,0,0)
 render('building-'+key+'.png','OFFLINE BLENDER  /  '+key.upper()+'\n8 x 8 x 4 m nominal / inset architectural details',(11,14,10),(0,0,1.9),12.8)
 hidden(g,True)
print('ART_KIT_RENDERING_COMPLETE',flush=True)
