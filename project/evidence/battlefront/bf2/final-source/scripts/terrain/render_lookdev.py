#!/usr/bin/env python3
"""Blender real-mesh / authored PBR look-development. Not a browser/game capture."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'assets/terrain';DATA=json.loads((OUT/'lookdev-geometry.json').read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=False
scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.23,.26,.28);scene.view_settings.view_transform='AgX'
scene.render.use_stamp=True
for prop in ['date','time','render_time','frame','frame_range','camera','lens','scene','marker','filename','sequencer_strip']:
 if hasattr(scene.render,'use_stamp_'+prop):setattr(scene.render,'use_stamp_'+prop,False)
scene.render.use_stamp_note=True;scene.render.stamp_note_text='BLENDER TERRAIN MATERIAL / GEOMETRY LOOKDEV — NOT A GAMEPLAY SCREENSHOT';scene.render.stamp_font_size=16;scene.render.stamp_background=(.02,.03,.035,.9);scene.render.stamp_foreground=(.9,.92,.9,1)
# Map renderer X,Y,Z => Blender X,-Z,Y for consistent +Y-up runtime assets.
def xyz(p):return (p[0],-p[2],p[1])
materials={}
for data in DATA['meshes']:
 name=data['material'] or data['name'];name=name if name.startswith('terrain:') else data['name']
 if name in materials:continue
 mat=bpy.data.materials.new(name);mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=data['roughness'];bsdf.inputs['Metallic'].default_value=data['metalness'];srgb=lambda v: v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4;rgb=tuple(srgb(((data['baseColor']>>shift)&255)/255) for shift in (16,8,0));bsdf.inputs['Base Color'].default_value=(*rgb,1)
 if name.startswith('terrain:'):
  stem=name.split(':')[1]
  for filename,slot,color in [(f'{stem}-basecolor.webp','Base Color',True),(f'{stem}-orm.png','Roughness',False),(f'{stem}-normal.png','Normal',False)]:
   im=bpy.data.images.load(str(OUT/filename));im.colorspace_settings.name='sRGB' if color else 'Non-Color';tex=nodes.new('ShaderNodeTexImage');tex.image=im;tex.extension='REPEAT'
   if slot=='Normal':
    normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.55;links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs[slot])
   elif slot=='Roughness':
    separate=nodes.new('ShaderNodeSeparateColor');links.new(tex.outputs['Color'],separate.inputs['Color']);links.new(separate.outputs['Green'],bsdf.inputs[slot])
   else:
    attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='road-use';multiply=nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1;links.new(tex.outputs['Color'],multiply.inputs[1]);links.new(attr.outputs['Color'],multiply.inputs[2]);links.new(multiply.outputs['Color'],bsdf.inputs[slot])
 materials[name]=mat
for data in DATA['meshes']:
 raw=data['positions'];pts=[xyz(raw[i:i+3])for i in range(0,len(raw),3)];idx=data['index'] if data['index'] is not None else list(range(len(pts)));faces=[idx[i:i+3]for i in range(0,len(idx),3)];mesh=bpy.data.meshes.new(data['name']);mesh.from_pydata(pts,[],faces);mesh.update();o=bpy.data.objects.new(data['name'],mesh);bpy.context.collection.objects.link(o)
 # Source only has translation for terrain plate; curbs use full transforms when needed.
 o.location=(data['matrix'][12],-data['matrix'][14],data['matrix'][13]);name=data['material'] if data['material'].startswith('terrain:') else data['name'];mesh.materials.append(materials[name])
 if data.get('colors'):
  layer=mesh.color_attributes.new(name='road-use',type='FLOAT_COLOR',domain='POINT');colors=data['colors']
  for i in range(len(pts)):layer.data[i].color=(*colors[i*3:i*3+3],1)
 else:
  layer=mesh.color_attributes.new(name='road-use',type='FLOAT_COLOR',domain='POINT')
  for vertex in layer.data:vertex.color=(1,1,1,1)
 if data['uv']:
  layer=mesh.uv_layers.new(name='metres-4m');uv=data['uv']
  for face in mesh.polygons:
   for li in face.loop_indices:
    vi=mesh.loops[li].vertex_index;layer.data[li].uv=(uv[vi*2],uv[vi*2+1])
def area_light(name,location,power,size,color):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color;o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=location;o.rotation_euler=((Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler())
area_light('soft-overcast-key',(-15,-8,35),23000,30,(1,.91,.79));area_light('cool-sky-fill',(18,8,24),16000,24,(.72,.84,1))
sun=bpy.data.lights.new('late-morning','SUN');sun.energy=1.8;sun.angle=.13;o=bpy.data.objects.new('late-morning',sun);bpy.context.collection.objects.link(o);o.rotation_euler=(.5,-.4,-.6)
cam=bpy.data.cameras.new('Asset inspection camera');camera=bpy.data.objects.new('Asset inspection camera',cam);bpy.context.collection.objects.link(camera);scene.camera=camera

def camera_at(pos,target,scale):
 camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=scale
camera_at((45,-52,63),(0,0,0),65);scene.render.filepath=str(OUT/'terrain-lookdev-overview.png');bpy.ops.render.render(write_still=True)
camera_at((9,-15,12),(-4,3,0),18);scene.render.filepath=str(OUT/'terrain-lookdev-closeup.png');bpy.ops.render.render(write_still=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'terrain-lookdev.blend'))
print('Rendered original terrain materials and actual runtime road geometry; not a game-browser capture.')
