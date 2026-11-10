"""Read-only Blender source inspection; writes an audit, never saves/re-exports assets."""
import bpy,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'assets/art-kit';source=OUT/'industrial-canal-kit.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
assert not bpy.data.libraries,'Source contains an external linked blend library'
images=[]
for im in bpy.data.images:
 if im.source not in ['FILE','TILED']:continue
 packed=im.packed_file
 assert packed and packed.size>0,('Unpacked source texture',im.name,im.filepath)
 images.append({'name':im.name,'storedFilename':Path(im.filepath).name,'packedBytes':packed.size,'dimensions':list(im.size),'hasData':im.has_data})
assert images,'Expected embedded procedural PBR textures'
audit={'scope':'Read-only inspection of the portable campaign-local source blend','sourceFile':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'packedImages':images,'externalImageDependencies':[],'externalBlendLibraries':[],'portable':True,'glbReexported':False,'notes':'Stored image paths may record the authoring workspace, but every image payload is packed in the blend and no external image is required.'}
(OUT/'source-portability.json').write_text(json.dumps(audit,indent=2)+'\n')
print('SOURCE_PORTABILITY_PASS',len(images),'packed texture images; zero external dependencies')
