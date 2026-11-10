"""Controlled original-material vs fresh-GLB proof, identical world/light/cameras."""
import bpy,ast,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[3];OUT=ROOT/'evidence/ruined-depot/asset';ASSET=ROOT/'work/assets/ruined-depot';IDS={'workshop':'polySurface1011','broken-corner':'polySurface773','window-wall':'polySurface806'}
# Reuse only our own explicit stage/camera functions, never source embedded code.
tree=ast.parse((OUT/'author_ruins.py').read_text());defs=ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name in ['stage','arrange','render']],type_ignores=[]);exec(compile(defs,str(OUT/'author_ruins.py'),'exec'))
placements={'workshop':(0,3,0),'broken-corner':(14,2,0),'window-wall':(-13,0,0)}
records={}
for variant in ['baseline','revised']:
 if variant=='baseline':
  bpy.ops.wm.open_mainfile(filepath=str(ROOT/'originals/ruined-depot/evidence/lfa-recovered-two-uv-audit.blend'),use_scripts=False);objects=[bpy.data.objects[name]for name in IDS.values()]
  for o in list(bpy.data.objects):
   if o not in objects:bpy.data.objects.remove(o,do_unlink=True)
  for id,o in zip(IDS,objects):
   points=[o.matrix_world@v.co for v in o.data.vertices];lo=Vector([min(p[k]for p in points)for k in range(3)]);hi=Vector([max(p[k]for p in points)for k in range(3)]);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
   for v,p in zip(o.data.vertices,points):v.co=(p-center)*.8
   o.matrix_world.identity();o.name=id
 else:
  bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ASSET/'ruins.glb'));objects=[bpy.data.objects[id]for id in IDS]
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.view_settings.view_transform='AgX';scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';ground,light,camera=stage();arrange();records[variant]={}
 for close in [False,True]:
  name=variant+('-closeup'if close else'-gameplay');render(name,close);records[variant]['closeup'if close else'gameplay']={'camera':list(camera.location),'rotation':list(camera.rotation_euler),'orthoScale':camera.data.ortho_scale,'resolution':[scene.render.resolution_x,scene.render.resolution_y],'lightLocation':list(light.location),'lightEnergy':light.data.energy,'lightSize':light.data.size,'worldColor':list(scene.world.node_tree.nodes['Background'].inputs['Color'].default_value),'worldStrength':scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value,'samples':24,'denoising':False,'look':scene.view_settings.look,'exposure':scene.view_settings.exposure,'gamma':scene.view_settings.gamma}
 if variant=='revised':bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ruins-reimport-proof.blend'))
assert records['baseline']==records['revised'];(OUT/'matched-render-settings.json').write_text(json.dumps(records,indent=2))
