"""Deterministic local-only LFA/Fleurman reauthor; run Blender --disable-autoexec."""
import bpy, math, json, hashlib, struct
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'evidence/ruined-depot/asset'; ASSET=ROOT/'work/assets/ruined-depot'; SOURCE=ROOT/'originals/ruined-depot'
IDS={'workshop':'polySurface1011','broken-corner':'polySurface773','window-wall':'polySurface806'}
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def mesh_hash(o):return hashlib.sha256(json.dumps({'vertices':[list(v.co)for v in o.data.vertices],'polygons':[list(p.vertices)for p in o.data.polygons],'uv':{l.name:[list(v.uv)for v in l.data]for l in o.data.uv_layers}},sort_keys=True).encode()).hexdigest()
checkpoint={'inputFiles':{str(p.relative_to(SOURCE)):sha(p)for p in [SOURCE/'evidence/lfa-recovered-two-uv-audit.blend',SOURCE/'evidence/Ciment_brisé.png',SOURCE/'sources/destroyedwalls_by_lfa/destroyedWalls_UV1.obj',SOURCE/'sources/destroyedwalls_by_lfa/destroyedWalls_UV2.obj',SOURCE/'sources/destroyedwalls_by_lfa/detail.bmp',SOURCE/'sources/destroyedwalls_by_lfa/wall.bmp']},'sourceObjects':{}}
objects=[]
for id,name in IDS.items():
 o=bpy.data.objects[name];checkpoint['sourceObjects'][name]={'meshAndUVSha256':mesh_hash(o),'vertices':len(o.data.vertices),'polygons':len(o.data.polygons),'originalUV':[u.name for u in o.data.uv_layers]};objects.append(o)
for o in list(bpy.data.objects):
 if o not in objects:bpy.data.objects.remove(o,do_unlink=True)
for id,o in zip(IDS,objects):
 coords=[o.matrix_world@v.co for v in o.data.vertices];lo=Vector([min(v[k]for v in coords)for k in range(3)]);hi=Vector([max(v[k]for v in coords)for k in range(3)]);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 for v,p in zip(o.data.vertices,coords):v.co=(p-center)*.8
 o.matrix_world.identity();o.name=id;o.data.name=id+'-source-topology';o['source_module']=IDS[id];o['applied_metres_per_source_unit']=.8
 o.data.calc_loop_triangles();checkpoint['sourceObjects'][IDS[id]].update({'triangles':len(o.data.loop_triangles),'normalizedBlenderBounds':[list((lo-center)*.8),list((hi-center)*.8)]})
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.cycles.use_denoising=False
scene.world.color=(.25,.25,.25);scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.resolution_percentage=100
# Fixed proof stage: not part of runtime GLB.
def stage():
 scene.world=bpy.data.worlds.new('Controlled proof world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.25,.25,.25,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5;scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.035));ground=bpy.context.object;ground.name='PROOF-ground';m=bpy.data.materials.new('PROOF-ground');m.diffuse_color=(.15,.13,.10,1);ground.data.materials.append(m)
 bpy.ops.object.light_add(type='AREA',location=(2,-10,22));light=bpy.context.object;light.name='PROOF-softbox';light.data.energy=4500;light.data.shape='DISK';light.data.size=14
 bpy.ops.object.camera_add();camera=bpy.context.object;camera.name='PROOF-camera';scene.camera=camera;camera.data.type='ORTHO';return ground,light,camera
ground,light,camera=stage()
placements={'workshop':(0,3,0),'broken-corner':(14,2,0),'window-wall':(-13,0,0)}
def arrange():
 for o in objects:o.location=placements[o.name]
def render(name,close=False):
 for o in objects:o.hide_render=close and o.name!='window-wall'
 if close:
  camera.location=(-9.3,-7,3.5);target=Vector((-11,0,1.6));camera.data.ortho_scale=6.2;scene.render.resolution_x=1200;scene.render.resolution_y=800
 else:
  camera.location=(21,-36,29);target=Vector((0,2,1));camera.data.ortho_scale=44;scene.render.resolution_x=1400;scene.render.resolution_y=900
 camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
arrange();render('baseline-gameplay');render('baseline-closeup',True)
for o in objects:o.hide_render=False;o.location=(0,0,0)
# Preserve both source UVs. Pack a third, shared atlas for baking.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True);o.data.uv_layers.new(name='DepotAtlas');o.data.uv_layers.active_index=2;o.data.uv_layers.active.active_render=True
bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(30),island_margin=.012,area_weight=0,correct_aspect=True,scale_to_bounds=True);bpy.ops.object.mode_set(mode='OBJECT')
material=bpy.data.materials.new('Depot weathered concrete — baked');material.use_nodes=True;nodes=material.node_tree.nodes;nodes.clear();links=material.node_tree.links
output=nodes.new('ShaderNodeOutputMaterial');bsdf=nodes.new('ShaderNodeBsdfPrincipled');bsdf.inputs['Metallic'].default_value=0;links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='SCALE';mapping.inputs[3].default_value=.30;links.new(coord.outputs['Object'],mapping.inputs[0]);color=nodes.new('ShaderNodeTexImage');color.image=bpy.data.images.load(str(SOURCE/'evidence/Ciment_brisé.png'));color.image.pack();color.projection='BOX';color.projection_blend=.18;links.new(mapping.outputs['Vector'],color.inputs['Vector']);links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=26;noise.inputs['Detail'].default_value=3;noise.inputs['Roughness'].default_value=.65;links.new(coord.outputs['Object'],noise.inputs['Vector']);bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.012;links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],bsdf.inputs['Normal']);ramp=nodes.new('ShaderNodeMapRange');ramp.inputs['From Min'].default_value=0;ramp.inputs['From Max'].default_value=1;ramp.inputs['To Min'].default_value=.78;ramp.inputs['To Max'].default_value=.94;links.new(noise.outputs['Fac'],ramp.inputs['Value']);links.new(ramp.outputs['Result'],bsdf.inputs['Roughness'])
# Low-frequency, deterministic per-object weather and uneven base grime. No light/AO bake.
objinfo=nodes.new('ShaderNodeObjectInfo');offset=nodes.new('ShaderNodeMath');offset.operation='MULTIPLY';offset.inputs[1].default_value=17;links.new(objinfo.outputs['Random'],offset.inputs[0]);shift=nodes.new('ShaderNodeVectorMath');shift.operation='ADD';links.new(mapping.outputs['Vector'],shift.inputs[0]);links.new(offset.outputs[0],shift.inputs[1]);links.new(shift.outputs['Vector'],color.inputs['Vector'])
weather=nodes.new('ShaderNodeTexNoise');weather.inputs['Scale'].default_value=.23;weather.inputs['Detail'].default_value=2;weather.inputs['Roughness'].default_value=.6;links.new(shift.outputs['Vector'],weather.inputs['Vector']);weatherRange=nodes.new('ShaderNodeMapRange');weatherRange.inputs['To Min'].default_value=.72;weatherRange.inputs['To Max'].default_value=1;links.new(weather.outputs['Fac'],weatherRange.inputs['Value'])
sep=nodes.new('ShaderNodeSeparateXYZ');links.new(coord.outputs['Object'],sep.inputs[0]);uneven=nodes.new('ShaderNodeMath');uneven.operation='MULTIPLY_ADD';uneven.inputs[1].default_value=.38;uneven.inputs[2].default_value=.08;links.new(weather.outputs['Fac'],uneven.inputs[0]);height=nodes.new('ShaderNodeMath');height.operation='SUBTRACT';links.new(sep.outputs['Z'],height.inputs[0]);links.new(uneven.outputs[0],height.inputs[1]);grime=nodes.new('ShaderNodeMapRange');grime.clamp=True;grime.inputs['From Min'].default_value=-.25;grime.inputs['From Max'].default_value=.65;grime.inputs['To Min'].default_value=.64;grime.inputs['To Max'].default_value=1;links.new(height.outputs[0],grime.inputs['Value']);weatherGrime=nodes.new('ShaderNodeMath');weatherGrime.operation='MULTIPLY';links.new(weatherRange.outputs['Result'],weatherGrime.inputs[0]);links.new(grime.outputs['Result'],weatherGrime.inputs[1]);weatherColour=nodes.new('ShaderNodeMixRGB');weatherColour.blend_type='MULTIPLY';weatherColour.inputs[0].default_value=1;links.new(color.outputs['Color'],weatherColour.inputs[1]);links.new(weatherGrime.outputs[0],weatherColour.inputs[2])
# Upward/sloped original fracture facets get darker, coarse aggregate, never added geometry.
geo=nodes.new('ShaderNodeNewGeometry');up=nodes.new('ShaderNodeVectorMath');up.operation='DOT_PRODUCT';up.inputs[1].default_value=(0,0,1);links.new(geo.outputs['Normal'],up.inputs[0]);fracture=nodes.new('ShaderNodeMath');fracture.operation='GREATER_THAN';fracture.inputs[1].default_value=.23;links.new(up.outputs['Value'],fracture.inputs[0]);aggregate=nodes.new('ShaderNodeTexNoise');aggregate.inputs['Scale'].default_value=11;aggregate.inputs['Detail'].default_value=2;links.new(coord.outputs['Object'],aggregate.inputs['Vector']);aggregateRange=nodes.new('ShaderNodeMapRange');aggregateRange.inputs['To Min'].default_value=.44;aggregateRange.inputs['To Max'].default_value=.76;links.new(aggregate.outputs['Fac'],aggregateRange.inputs['Value']);fractureTint=nodes.new('ShaderNodeMixRGB');fractureTint.blend_type='MULTIPLY';links.new(fracture.outputs[0],fractureTint.inputs[0]);links.new(weatherColour.outputs['Color'],fractureTint.inputs[1]);links.new(aggregateRange.outputs['Result'],fractureTint.inputs[2]);links.new(fractureTint.outputs['Color'],bsdf.inputs['Base Color'])
roughFracture=nodes.new('ShaderNodeMath');roughFracture.operation='MULTIPLY';roughFracture.inputs[1].default_value=.10;links.new(fracture.outputs[0],roughFracture.inputs[0]);roughFinal=nodes.new('ShaderNodeMath');roughFinal.operation='ADD';roughFinal.use_clamp=True;links.new(ramp.outputs['Result'],roughFinal.inputs[0]);links.new(roughFracture.outputs[0],roughFinal.inputs[1]);links.new(roughFinal.outputs[0],bsdf.inputs['Roughness']);aggregateHeight=nodes.new('ShaderNodeMath');aggregateHeight.operation='MULTIPLY';links.new(aggregate.outputs['Fac'],aggregateHeight.inputs[0]);links.new(fracture.outputs[0],aggregateHeight.inputs[1]);aggregateBump=nodes.new('ShaderNodeBump');aggregateBump.inputs['Strength'].default_value=.20;aggregateBump.inputs['Distance'].default_value=.018;links.new(aggregateHeight.outputs[0],aggregateBump.inputs['Height']);links.new(bump.outputs['Normal'],aggregateBump.inputs['Normal']);links.new(aggregateBump.outputs['Normal'],bsdf.inputs['Normal'])
for o in objects:o.data.materials.clear();o.data.materials.append(material)
# Save inspectable authoring graph, untouched source UVs + authored atlas.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ruins-authoring.blend'))
images={};emit=nodes.new('ShaderNodeEmission');target=nodes.new('ShaderNodeTexImage');nodes.active=target
for channel in ['baseColor','roughness','normal']:
 image=bpy.data.images.new('depot-'+channel,2048,2048,alpha=False);image.colorspace_settings.name='sRGB'if channel=='baseColor'else'Non-Color';target.image=image;nodes.active=target;images[channel]=image
 if channel=='normal':links.new(bsdf.outputs['BSDF'],output.inputs['Surface'])
 else:links.new(fractureTint.outputs['Color']if channel=='baseColor'else roughFinal.outputs[0],emit.inputs['Color']);links.new(emit.outputs['Emission'],output.inputs['Surface'])
 for i,o in enumerate(objects):
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;scene.render.bake.use_clear=i==0;scene.render.bake.margin=16;bpy.ops.object.bake(type='NORMAL'if channel=='normal'else'EMIT',normal_space='TANGENT',use_clear=i==0,margin=16)
 image.filepath_raw=str(OUT/(channel+'.png'));image.file_format='PNG';image.save();image.pack()
# Replace arbitrary authoring graph with supported glTF standard texture nodes.
nodes.clear();output=nodes.new('ShaderNodeOutputMaterial');bsdf=nodes.new('ShaderNodeBsdfPrincipled');bsdf.inputs['Metallic'].default_value=0;links.new(bsdf.outputs['BSDF'],output.inputs['Surface']);uv=nodes.new('ShaderNodeUVMap');uv.uv_map='DepotAtlas'
for channel in images:
 n=nodes.new('ShaderNodeTexImage');n.image=images[channel];links.new(uv.outputs['UV'],n.inputs['Vector'])
 if channel=='normal':normal=nodes.new('ShaderNodeNormalMap');normal.uv_map='DepotAtlas';links.new(n.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
 else:links.new(n.outputs['Color'],bsdf.inputs['Base Color'if channel=='baseColor'else'Roughness'])
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ruins-baked-preserved-uv.blend'))
# Export-only mesh copies omit unused original UV layers. Source .blend preserves them.
for o in objects:
 o.data=o.data.copy()
 for name in [u.name for u in o.data.uv_layers if u.name!='DepotAtlas']:
  o.data.uv_layers.remove(o.data.uv_layers[name])
 o.data.uv_layers.active_index=0;o.data.uv_layers.active.active_render=True
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(ASSET/'ruins.glb'),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO',export_extras=True)
checkpoint['exportSha256']=sha(ASSET/'ruins.glb');checkpoint['authoring']={'colourMapping':'box projection blend .18, .30 repeats per metre / 3.333 metre source-image tile; deterministic ObjectInfo random phase; .23-scale low-frequency weather .72-1.0; uneven base grime .64-1 across lowest .65m; original upward fracture normals dotZ>.23 darkened by .44-.76 aggregate noise','atlasResolution':[2048,2048],'islandMarginUV':.012,'smartProjectionAngleDegrees':30,'bakeMarginPixels':16,'roughness':{'body':[.78,.94],'fractureAdditional':.10,'clamp':[0,1]},'normal':'artist-authored noise26/metre, bump strength .22, distance .012m; upward fracture noise11/metre, strength .20 distance .018m; tangent-space bake; not measured PBR','sourceUVsPreserved':['UV1','UV2'],'outputAxes':'glTF X right Y up Z = -Blender Y','scale':.8}
(OUT/'source-checkpoint.json').write_text(json.dumps(checkpoint,indent=2))
# Fresh file import proves actual exported material, not unsupported source nodes.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(ASSET/'ruins.glb'));objects=[bpy.data.objects[id]for id in IDS];scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.world=bpy.data.worlds.new('Proof world');scene.world.color=(.25,.25,.25);scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.resolution_percentage=100
audit={}
for o in objects:
 o.data.calc_loop_triangles();points=[o.matrix_world@v.co for v in o.data.vertices];audit[o.name]={'triangles':len(o.data.loop_triangles),'bounds':[[min(v[k]for v in points)for k in range(3)],[max(v[k]for v in points)for k in range(3)]],'uvLayers':[x.name for x in o.data.uv_layers],'materials':[m.name for m in o.data.materials]}
audit['images']=[{'name':i.name,'size':list(i.size),'colorspace':i.colorspace_settings.name,'packed':i.packed_file is not None}for i in bpy.data.images];(OUT/'reimport-audit.json').write_text(json.dumps(audit,indent=2));ground,light,camera=stage();arrange();render('revised-gameplay');render('revised-closeup',True);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ruins-reimport-proof.blend'))
