import bpy,glob,os,math
from mathutils import Vector
for p in glob.glob('evidence/armor/newc-*.blend'):
 bpy.ops.wm.open_mainfile(filepath=os.path.abspath(p));s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=False;s.render.resolution_x=1000;s.render.resolution_y=750;s.render.resolution_percentage=100
 s.world=bpy.data.worlds.new('Studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.13,.15,.18,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
 bpy.ops.mesh.primitive_plane_add(size=200);plane=bpy.context.object;plane.location.z=-.015;mat=bpy.data.materials.new('neutral ground');mat.diffuse_color=(.075,.068,.058,1);plane.data.materials.append(mat)
 for loc,power,size in [((3,4,7),1500,5),((-4,0,4),900,4)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(4.5,6,3.4));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=5.6;s.camera=cam
 s.render.filepath=os.path.abspath(p.replace('.blend','.png'));bpy.ops.render.render(write_still=True)
