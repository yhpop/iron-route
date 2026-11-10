import bpy,math,json
from pathlib import Path
A=Path(__file__).resolve().parent
objects=[bpy.data.objects[id]for id in ['workshop','broken-corner','window-wall']];bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True);o.data.uv_layers.active_index=2;o.data.uv_layers.active.active_render=True
bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(30),island_margin=.012,area_weight=0,correct_aspect=True,scale_to_bounds=True);bpy.ops.object.mode_set(mode='OBJECT')
atlasTriangles=[]
for o in objects:
 o.data.calc_loop_triangles();uv=o.data.uv_layers['DepotAtlas']
 for tri in o.data.loop_triangles:atlasTriangles.append([(float(uv.data[k].uv.x),float(uv.data[k].uv.y))for k in tri.loops])
s=(A/'audit_geometry.py').read_text();part=s[s.index('def cross'):s.index("result['totalAtlasCoverage']")];result={};exec(compile(part,'uv-overlap-check','exec'));(A/'uv-layout-30-degree-check.json').write_text(json.dumps(result,indent=2));print(result)
