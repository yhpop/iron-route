import bpy,json
from pathlib import Path
s=bpy.context.scene
out={'objects':len(s.objects),'frame':s.frame_current,'cameras':{},'lights':{},'render':{'engine':s.render.engine,'samples':s.eevee.taa_render_samples,'use_raytracing':s.eevee.use_raytracing},'cycles_available':hasattr(s,'cycles')}
for o in s.objects:
 if o.type=='CAMERA':out['cameras'][o.name]={'lens':o.data.lens,'clip':o.data.clip_end,'dof':o.data.dof.use_dof}
 if o.type=='LIGHT':out['lights'][o.name]={'type':o.data.type,'energy':o.data.energy,'location':list(o.location)}
out['eevee_properties']=[p.identifier for p in s.eevee.bl_rna.properties if 'shadow' in p.identifier or 'ray' in p.identifier or 'volum' in p.identifier]
Path('/workspace/scratch/08f39b8da479/tank_quality_v5_20261004/scene_inspection.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
