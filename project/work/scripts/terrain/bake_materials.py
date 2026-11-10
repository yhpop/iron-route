#!/usr/bin/env python3
"""Original deterministic metre-scaled PBR maps. No third-party imagery. Python + Pillow/numpy only."""
from pathlib import Path
import json, hashlib, base64
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/terrain'; OUT.mkdir(parents=True,exist_ok=True)
N=512; TILE=4.; rng=np.random.default_rng(27641)
def noise(grid,seed):
 r=np.random.default_rng(seed); a=r.random((grid,grid)).astype('float32')
 # Tileable interpolation by wrapping a border, then taking one period.
 im=Image.fromarray(np.pad(a,((0,1),(0,1)),mode='wrap'),'F').resize((N+N//grid,N+N//grid),Image.Resampling.BICUBIC)
 return np.asarray(im)[:N,:N]
def normalized(a):return (a-a.mean())/(a.std()+1e-8)
def wrapped_lines(seed,count,width):
 r=np.random.default_rng(seed); im=Image.new('L',(N,N)); d=ImageDraw.Draw(im)
 for _ in range(count):
  x,y=r.uniform(0,N,2); pts=[(x,y)]; angle=r.uniform(0,6.28)
  for j in range(r.integers(6,14)):
   angle+=r.normal(0,.45);x+=np.cos(angle)*r.uniform(7,20);y+=np.sin(angle)*r.uniform(7,20);pts.append((x,y))
  for dx in [-N,0,N]:
   for dy in [-N,0,N]: d.line([(x+dx,y+dy)for x,y in pts],fill=255,width=width)
 return np.asarray(im,dtype=float)/255
materials={}
for idx,(name,base) in enumerate([('asphalt',(66,66,62)),('concrete',(133,130,120)),('earth',(117,109,89))]):
 macro=normalized(noise(4,idx+8)); medium=normalized(noise(32,idx+31)); grain=normalized(noise(256,idx+91));fine=normalized(rng.random((N,N)))
 mineral=np.maximum(0,grain-1.10);pores=np.maximum(0,-grain-1.25)
 if name=='asphalt':
  cracks=wrapped_lines(61,2,1);height=.0015*grain+.0004*fine-.004*cracks
  lum=macro*1.6+medium*2.1+grain*4.2+fine*1.5+mineral*7-pores*4-cracks*14
  rough=.91+medium*.015-mineral*.05+pores*.015
 elif name=='concrete':
  cracks=wrapped_lines(22,1,1)
  # 4m cast slabs; narrow saw-cut joints have physical-scale dark cores, no giant noise blobs.
  yy,xx=np.mgrid[:N,:N]; dist=np.minimum(np.minimum(xx,N-1-xx),np.minimum(yy,N-1-yy)); joint=(dist<1.1).astype(float)
  edge=np.clip((3-dist)/3,0,1)
  height=.0006*grain-.0028*joint-.001*cracks
  lum=macro*2.4+medium*1.4+grain*2.0+fine*.8-pores*2.8-joint*18+edge*2-cracks*7
  rough=.84+medium*.025+pores*.025-joint*.04
 else:
  height=.0035*medium+.0015*grain+.0005*fine
  lum=macro*2+medium*3.4+grain*3.7+fine*1.3+mineral*8-pores*3
  rough=.97+medium*.012
 color=np.clip(np.array(base)[None,None,:]+lum[:,:,None],0,255).astype('uint8')
 # Tangent basis matches UV u=x, v=-z and an upward plane normal.
 dx=(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))/(2*TILE/N);dy=(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))/(2*TILE/N)
 normal=np.dstack((-dx,dy,np.ones((N,N))));normal/=np.linalg.norm(normal,axis=2)[:,:,None]
 normal=np.clip((normal*.5+.5)*255,0,255).astype('uint8')
 orm=np.dstack((np.ones((N,N))*255,np.clip(rough,0,1)*255,np.zeros((N,N)))).astype('uint8')
 Image.fromarray(color).save(OUT/f'{name}-basecolor.webp',quality=91,method=6)
 Image.fromarray(normal).save(OUT/f'{name}-normal.png',optimize=True)
 Image.fromarray(orm).save(OUT/f'{name}-orm.png',optimize=True)
 materials[name]={'baseColor':f'{name}-basecolor.webp','normal':f'{name}-normal.png','orm':f'{name}-orm.png','resolution':N,'tileSizeMetres':TILE,'originalProcedural':True,'maxHeightReliefMetres':float(np.max(height)-np.min(height))}
(OUT/'material-manifest.json').write_text(json.dumps({'generator':'scripts/terrain/bake_materials.py','seed':27641,'materials':materials,'provenance':'Original procedural synthesis; no downloaded photographs or texture sources.','textureRuntime':'local WebP/PNG, no external decoder'},indent=2)+'\n')
print(json.dumps({p.name:p.stat().st_size for p in OUT.iterdir()},indent=2))

# Embed original maps so standalone/offline builds make zero texture/decoder requests.
urls={}
for name in materials:
 urls[name]={}
 for key,suffix,mime in [('baseColor','basecolor.webp','image/webp'),('normal','normal.png','image/png'),('orm','orm.png','image/png')]:
  urls[name][key]='data:'+mime+';base64,'+base64.b64encode((OUT/f'{name}-{suffix}').read_bytes()).decode()
(OUT/'runtime-textures.js').write_text('// Generated original local maps; no external runtime texture requests.\nexport const TERRAIN_TEXTURE_URLS = '+json.dumps(urls,separators=(',',':'))+';\n')
