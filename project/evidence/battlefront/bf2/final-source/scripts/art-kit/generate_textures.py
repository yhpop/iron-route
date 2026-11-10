"""Original seeded raster PBR surface authoring. No downloaded imagery or fonts."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
OUT=Path(__file__).resolve().parents[2]/'assets/art-kit/textures'
OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(20261028)
N=512

def noise(scale):
    a=Image.fromarray(rng.integers(0,256,(scale,scale),dtype=np.uint8))
    return np.asarray(a.resize((N,N),Image.Resampling.BICUBIC)).astype(float)/255-.5
fine=noise(512); broad=noise(12); med=noise(64)
def save(name,base,var,rough=.8,kind='plain'):
    a=np.zeros((N,N,3),float)+np.array(base)
    a+=(fine*var+med*var*.7+broad*var*1.2)[...,None]
    if kind=='brick':
        # Irregular warm fired-clay masonry. Mortar is physically scaled by UVs.
        row=64; col=128
        for y in range(0,N,row):
            offset=64 if (y//row)%2 else 0
            for x in range(-offset,N,col):
                xa=max(0,x+4); xb=min(N,x+col-3)
                ya=y+4;yb=min(N,y+row-4)
                a[ya:yb,xa:xb]+=rng.uniform(-14,13)
        yy,xx=np.mgrid[0:N,0:N]
        mortar=(yy%row<6)|((xx+((yy//row)%2)*64)%col<6)
        a[mortar]=np.array([113,107,91])+fine[mortar,None]*8
        for i in range(90):
            x,y=rng.integers(0,N,2);a[max(0,y-1):y+2,max(0,x-4):x+4]-=rng.uniform(6,25)
    elif kind=='paint':
        mask=(noise(128)>.33)&(noise(16)>.05)
        a[mask]=np.array(base)*.48+np.array([29,24,16])
        for i in range(45):
            x,y=rng.integers(0,N,2);length=int(rng.integers(2,24))
            a[y:y+1,x:min(N,x+length)]*=.68
    elif kind=='roof':
        xx=np.arange(N);ridge=((xx%64)<4)
        a[:,ridge]*=.65
        a+=np.sin(xx/64*np.pi*2)[None,:,None]*4
    elif kind=='asphalt':
        mask=rng.random((N,N))>.985;a[mask]+=24
    a=np.clip(a,0,255).astype(np.uint8)
    Image.fromarray(a).save(OUT/f'{name}_base.png',optimize=True)
    r=np.clip(rough*255+fine*16+med*7,0,255).astype(np.uint8)
    # glTF roughness uses G, metallic B, AO R; deliberately no baked scene lighting.
    orm=np.zeros((N,N,3),dtype=np.uint8);orm[:,:,0]=255;orm[:,:,1]=r;orm[:,:,2]=0
    Image.fromarray(orm).save(OUT/f'{name}_orm.png',optimize=True)
save('clay_brick',[148,99,73],20,.87,'brick')
save('warm_concrete',[165,158,139],15,.87)
save('paint_sage',[98,115,105],15,.68,'paint')
save('paint_ochre',[176,132,62],18,.71,'paint')
save('roof_zinc',[83,93,93],14,.76,'roof')
save('canvas',[157,153,126],15,.92)
save('asphalt',[54,60,58],21,.93,'asphalt')
print('Authored',len(list(OUT.glob('*.png'))),'512px PBR maps')
