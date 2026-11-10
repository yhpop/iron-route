"""Independent binary GLB QA: neutral geometry, atlas bytes and source UV identity.
No Blender, browser or network. Run from any directory with Python + existing NumPy.
"""
from pathlib import Path
from collections import defaultdict
import json,struct,hashlib,math
import numpy as np
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]

def read_glb(file):
    data=file.read_bytes();assert struct.unpack_from('<III',data)==(0x46546c67,2,len(data))
    n=struct.unpack_from('<I',data,12)[0];j=json.loads(data[20:20+n]);blob=data[28+n:]
    def accessor(i):
        a=j['accessors'][i];v=j['bufferViews'][a['bufferView']]
        kind={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
        c={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
        offset=v.get('byteOffset',0)+a.get('byteOffset',0);dtype=np.dtype(kind)
        return np.ndarray((a['count'],c),dtype=dtype,buffer=blob,offset=offset,strides=(v.get('byteStride',dtype.itemsize*c),dtype.itemsize)).copy()
    def matrix(n):
        if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
        x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4)
        m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]))
        m[:3,3]=n.get('translation',[0,0,0]);return m
    world={}
    def visit(i,parent):
        world[i]=parent@matrix(j['nodes'][i])
        for child in j['nodes'][i].get('children',[]):visit(child,world[i])
    for i in j['scenes'][j.get('scene',0)]['nodes']:visit(i,np.eye(4))
    primitives=[]
    for i,node in enumerate(j['nodes']):
        if 'mesh' not in node:continue
        for p in j['meshes'][node['mesh']]['primitives']:
            pos=accessor(p['attributes']['POSITION']).astype(float)
            pos=(np.c_[pos,np.ones(len(pos))]@world[i].T)[:,:3]
            indices=accessor(p['indices']).reshape(-1) if 'indices'in p else np.arange(len(pos))
            uv=accessor(p['attributes']['TEXCOORD_0']) if 'TEXCOORD_0'in p['attributes'] else np.zeros((len(pos),2))
            name=j['materials'][p['material']]['name'].split('.00')[0]
            primitives.append({'name':node['name'],'material':name,'corners':np.c_[pos[indices],uv[indices]],'localCorners':accessor(p['attributes']['POSITION'])[indices]})
    images=[]
    for img in j.get('images',[]):
        v=j['bufferViews'][img['bufferView']];data=blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
        images.append(hashlib.sha256(data).hexdigest())
    return j,primitives,images

def compare_corners(a,b,textured=False):
    # UV indexes establish correspondence without relying on glTF vertex-split order.
    # Nonpainted geometry uses a 1 mm spatial bucket with adjacent-bucket search.
    grid=defaultdict(list)
    for point in b:
        key=tuple(np.round(point[3:]*1e7).astype(int)) if textured else tuple(np.floor(point[:3]*1000).astype(int))
        grid[key].append(point)
    maximum=0
    for point in a:
        key=tuple(np.round(point[3:]*1e7).astype(int)) if textured else tuple(np.floor(point[:3]*1000).astype(int))
        keys=[key] if textured else [(key[0]+x,key[1]+y,key[2]+z) for x in [-1,0,1] for y in [-1,0,1] for z in [-1,0,1]]
        best=None
        for k in keys:
            for index,q in enumerate(grid.get(k,[])):
                error=float(np.max(np.abs(q[:3]-point[:3])))
                if best is None or error<best[0]:best=(error,k,index)
                if error<1e-9:break
        assert best is not None,('Missing correspondence',point,key)
        assert best[0]<1e-5,('Changed neutral vertex',point,best[0])
        maximum=max(maximum,best[0]);grid[best[1]].pop(best[2])
    assert not any(grid.values()),'Unmatched derivative corners'
    return maximum

def validate():
    original,op,oi=read_glb(ROOT/'assets/tank_v5.glb')
    derivative,dp,di=read_glb(ROOT/'campaign/assets/tank_v5_articulated.glb')
    assert sorted(oi)==sorted(di),'Embedded atlas bytes changed'
    mats=sorted({p['material'] for p in op});errors={}
    for mat in mats:
        a=np.concatenate([p['corners'] for p in op if p['material']==mat]);b=np.concatenate([p['corners'] for p in dp if p['material']==mat])
        assert a.shape==b.shape,(mat,a.shape,b.shape)
        errors[mat]=compare_corners(a,b,textured=mat=='Tank_V5_Baked_Paint')
    # Runtime's two track batches share canonical complete link geometry.
    canonical=[p for p in dp if p['name']=='Track_L_00']
    template_errors={}
    for p in dp:
        if not p['name'].startswith('Track_'):continue
        template=next(c for c in canonical if c['material']==p['material'])
        a=np.c_[template['localCorners'],np.zeros((len(template['localCorners']),2))]
        b=np.c_[p['localCorners'],np.zeros((len(p['localCorners']),2))]
        template_errors[p['name']+'/'+p['material']]=compare_corners(a,b)
    wheel_errors={}
    for p in dp:
        if p['name'].startswith('Wheel_'):
            template_name='_'.join(p['name'].split('_')[:2])+'_0'
        elif p['name'].startswith('Guide_'):
            template_name='Guide_L_0'
        else:continue
        template=next(c for c in dp if c['name']==template_name and c['material']==p['material'])
        a=np.c_[template['localCorners'],np.zeros((len(template['localCorners']),2))]
        b=np.c_[p['localCorners'],np.zeros((len(p['localCorners']),2))]
        wheel_errors[p['name']+'/'+p['material']]=compare_corners(a,b)
    allpos=np.concatenate([p['corners'][:,:3] for p in dp])
    report={'passed':True,'assetSha256':hashlib.sha256((ROOT/'campaign/assets/tank_v5_articulated.glb').read_bytes()).hexdigest(),'triangles':len(allpos)//3,'embeddedAtlasHashes':di,'originalPaintUvIdentity':True,'maxNeutralVertexErrorRawByMaterial':errors,'maxCanonicalTrackErrorRaw':max(template_errors.values()),'maxCanonicalWheelGuideErrorRaw':max(wheel_errors.values()),'neutralBoundsRaw':[allpos.min(axis=0).tolist(),allpos.max(axis=0).tolist()],'limitations':['CPU binary geometry and texture identity checks only; no browser, GPU or device test.']}
    (ROOT/'campaign/assets/geometry-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':validate()
