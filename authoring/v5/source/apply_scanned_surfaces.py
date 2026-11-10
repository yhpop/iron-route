"""Verified CC0 Poly Haven scans layered onto stable physical-scale UVs.
No downloads or third-party state changes occur here. Original JPEGs are packed.
"""
from pathlib import Path
from mathutils import Vector

ASSETS={'road':('worn_asphalt',2.0),'concrete':('damaged_concrete_floor',4.5)}

def apply_scanned_surfaces(bpy):
 root=Path(__file__).resolve().parent.parent;folder=root/'textures';images={}
 for asset,_ in ASSETS.values():
  for kind in ['diff','rough','nor_gl']:
   path=folder/f'{asset}_{kind}_2k.jpg'
   if not path.is_file():raise RuntimeError('Missing licensed texture: '+str(path))
   im=bpy.data.images.load(str(path),check_existing=True);im.colorspace_settings.name='sRGB' if kind=='diff' else 'Non-Color';im.pack();images[asset,kind]=im
 selected={}
 for m in bpy.data.materials:
  if m.name=='FINAL / rain-wet cracked asphalt':selected[m]='road'
  elif m.name=='FINAL / broken aggregate concrete' or m.name.startswith(('Road rubble family ','CONCRETE / ')) or m.name=='Exposed old brick':selected[m]='concrete'
 # The scene has many separate planar islands with no UVs. Dominant-normal
 # projection gives tangent-space scan normals a valid metre-scale UV basis.
 done=set();uv_objects=0;uv_faces=0
 for ob in bpy.context.scene.objects:
  if ob.type!='MESH' or ob.data in done:continue
  me=ob.data
  if not any(m in selected for m in me.materials):continue
  done.add(me);uv=me.uv_layers.get('V5_Physical_Scan_UV') or me.uv_layers.new(name='V5_Physical_Scan_UV');me.uv_layers.active_index=me.uv_layers.find('V5_Physical_Scan_UV');uv.active_render=True
  for face in me.polygons:
   if face.material_index>=len(me.materials):continue
   mat=me.materials[face.material_index]
   if mat not in selected:continue
   tile=ASSETS[selected[mat]][1];n=face.normal;axis=max(range(3),key=lambda i:abs(n[i]));sign=1 if n[axis]>=0 else -1
   for li in face.loop_indices:
    v=ob.matrix_world@me.vertices[me.loops[li].vertex_index].co
    if axis==2:u,w=v.x*sign,v.y
    elif axis==0:u,w=v.y*sign,v.z
    else:u,w=-v.x*sign,v.z
    uv.data[li].uv=(u/tile,w/tile)
   uv_faces+=1
  uv_objects+=1
 for m,kind in selected.items():
  asset,tile=ASSETS[kind];nodes=m.node_tree.nodes;links=m.node_tree.links;p=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
  coord=nodes.new('ShaderNodeUVMap');coord.uv_map='V5_Physical_Scan_UV';coord.name='V5 / physically scaled scan coordinates'
  tex={}
  for channel in ['diff','rough','nor_gl']:
   n=nodes.new('ShaderNodeTexImage');n.name='V5 / CC0 scan '+channel;n.image=images[asset,channel];n.interpolation='Linear';n.extension='REPEAT';links.new(coord.outputs['UV'],n.inputs['Vector']);tex[channel]=n
  old_color=p.inputs['Base Color'].links[0].from_socket if p.inputs['Base Color'].is_linked else None
  sat=nodes.new('ShaderNodeHueSaturation');sat.inputs['Saturation'].default_value=.10 if kind=='road' else .16;links.new(tex['diff'].outputs['Color'],sat.inputs['Color'])
  mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[0].default_value=.78 if kind=='road' else .38
  if old_color:links.new(old_color,mix.inputs[1])
  else:mix.inputs[1].default_value=p.inputs['Base Color'].default_value
  links.new(sat.outputs['Color'],mix.inputs[2]);links.new(mix.outputs['Color'],p.inputs['Base Color'])
  rough=nodes.new('ShaderNodeMapRange');rough.inputs['From Min'].default_value=0;rough.inputs['From Max'].default_value=1;rough.inputs['To Min'].default_value=.61 if kind=='road' else .74;rough.inputs['To Max'].default_value=.91 if kind=='road' else .96;links.new(tex['rough'].outputs['Color'],rough.inputs['Value']);links.new(rough.outputs['Result'],p.inputs['Roughness'])
  nm=nodes.new('ShaderNodeNormalMap');nm.space='TANGENT';nm.uv_map='V5_Physical_Scan_UV';nm.inputs['Strength'].default_value=.45 if kind=='road' else .38;links.new(tex['nor_gl'].outputs['Color'],nm.inputs['Color'])
  # Keep a trace of procedural relief below the scan to avoid perfectly repeated
  # scan silhouettes without increasing the macro relief or moving textures.
  bump=next((n for n in nodes if n.type=='BUMP'),None)
  if bump:
   bump.inputs['Strength'].default_value=.10;bump.inputs['Distance'].default_value=.0015;links.new(nm.outputs['Normal'],bump.inputs['Normal']);links.new(bump.outputs['Normal'],p.inputs['Normal'])
  else:links.new(nm.outputs['Normal'],p.inputs['Normal'])
  m['surface_scan_source']='https://polyhaven.com/a/'+asset;m['surface_scan_license']='CC0 1.0 Universal';m['surface_scan_tile_m']=tile
 return {'source':'Poly Haven','license':'CC0 1.0 Universal','image_files':6,'images_packed':True,'materials':len(selected),'uv_meshes':uv_objects,'uv_faces':uv_faces,'asphalt_tile_m':2.0,'concrete_tile_m':4.5}
