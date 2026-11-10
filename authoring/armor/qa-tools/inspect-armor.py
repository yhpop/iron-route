import bpy,json,glob,os
from mathutils import Vector
out={}
for p in glob.glob('originals/newc42/fbx/**/*.fbx',recursive=True):
 bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.fbx(filepath=os.path.abspath(p))
 rows=[]
 for o in bpy.context.scene.objects:
  if o.type=='MESH':
   v=[o.matrix_world@Vector(c) for c in o.bound_box]
   rows.append(dict(name=o.name,parent=o.parent.name if o.parent else None,location=list(o.matrix_world.translation),bounds=[[min(c[i] for c in v) for i in range(3)],[max(c[i] for c in v) for i in range(3)]],verts=len(o.data.vertices)))
 out[p]=rows
json.dump(out,open('evidence/armor/source-inspection.json','w'),indent=2)
