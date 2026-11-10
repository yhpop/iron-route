"""Re-export the saved baked scene without rebaking. Avoid invalidating UV-layer references."""
import bpy,json,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[3];A=R/'evidence/ruined-depot/asset';P=R/'work/assets/ruined-depot';IDS=['workshop','broken-corner','window-wall'];objects=[bpy.data.objects[id]for id in IDS]
bpy.ops.object.select_all(action='DESELECT')
for o in objects:
 o.location=(0,0,0);o.hide_render=False;o.data=o.data.copy()
 for name in [u.name for u in o.data.uv_layers if u.name!='DepotAtlas']:o.data.uv_layers.remove(o.data.uv_layers[name])
 assert len(o.data.uv_layers)==1 and o.data.uv_layers[0].name=='DepotAtlas';o.data.uv_layers.active_index=0;o.data.uv_layers.active.active_render=True;o.select_set(True)
bpy.context.view_layer.objects.active=objects[0];bpy.ops.export_scene.gltf(filepath=str(P/'ruins.glb'),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO',export_extras=True)
s=json.loads((A/'source-checkpoint.json').read_text());s['exportSha256']=hashlib.sha256((P/'ruins.glb').read_bytes()).hexdigest();s['exportUVLayers']=['DepotAtlas'];(A/'source-checkpoint.json').write_text(json.dumps(s,indent=2))
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(P/'ruins.glb'));audit={}
for id in IDS:
 o=bpy.data.objects[id];o.data.calc_loop_triangles();points=[o.matrix_world@v.co for v in o.data.vertices];audit[id]={'triangles':len(o.data.loop_triangles),'bounds':[[min(v[k]for v in points)for k in range(3)],[max(v[k]for v in points)for k in range(3)]],'uvLayers':[x.name for x in o.data.uv_layers],'materials':[m.name for m in o.data.materials]}
audit['images']=[{'name':i.name,'size':list(i.size),'colorspace':i.colorspace_settings.name,'packed':i.packed_file is not None}for i in bpy.data.images];(A/'reimport-audit.json').write_text(json.dumps(audit,indent=2))
