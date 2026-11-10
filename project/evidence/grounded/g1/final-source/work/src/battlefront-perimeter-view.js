import * as THREE from 'three';

/** Static optical backdrop only. Never sample or extend the authoritative field.
 * One joined strip per original boundary edge, falling to y=0 at the exterior.
 * 576 m encloses the production finite frustum over aspect .25..8; see G1 proof.
 */
export function createBattlefrontPerimeterGeometry(field){
 const {columns,rows,bounds:b,dx,dz,heights}=field,margin=576;
 const outerBounds={minX:b.minX-margin,maxX:b.maxX+margin,minZ:b.minZ-margin,maxZ:b.maxZ+margin};
 const boundary=[];
 for(let i=0;i<columns;i++)boundary.push([i,0]);
 for(let j=0;j<rows;j++)boundary.push([columns,j]);
 for(let i=columns;i>0;i--)boundary.push([i,rows]);
 for(let j=rows;j>0;j--)boundary.push([0,j]);
 const positions=[],uv=[],indices=[];
 for(const [i,j] of boundary){
  const x=b.minX+i*dx,z=b.minZ+j*dz;
  // Corresponding rectangular parameters make adjacent strips share corners.
  const ox=outerBounds.minX+i/columns*(outerBounds.maxX-outerBounds.minX),oz=outerBounds.minZ+j/rows*(outerBounds.maxZ-outerBounds.minZ);
  positions.push(x,heights[j*(columns+1)+i],z,ox,0,oz);uv.push(x/4,-z/4,ox/4,-oz/4);
 }
 for(let k=0;k<boundary.length;k++){const a=k*2,b=((k+1)%boundary.length)*2;indices.push(a,b,a+1,b,b+1,a+1);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return {geometry,diagnostics:{perimeterEdges:boundary.length,triangles:indices.length/3,drawCalls:1,outerBounds,margin,viewOnly:true,additionalTextureBytes:0}};
}
