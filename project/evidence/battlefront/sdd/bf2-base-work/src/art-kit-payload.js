/** Copy-only restoration of the original GLB. No image/geometry decoder or I/O.
 * Validate the whole recipe before allocation; pool offsets honor typed-array views.
 * The existing GLTFLoader/art library remains responsible for parsing and disposal. */
export function restoreArtGlb(pool, recipe) {
 const invalid=()=>{throw new Error('Invalid embedded art payload recipe');};
 if(!(pool instanceof Uint8Array)||!recipe||!Number.isSafeInteger(recipe.byteLength)||recipe.byteLength<=0||recipe.byteLength>0x7fffffff||!Array.isArray(recipe.spans))invalid();
 let length=0;
 for(const span of recipe.spans){
  if(!Array.isArray(span)||span.length!==2)invalid();
  const [offset,size]=span;
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(size)||offset<0||size<=0||offset>pool.byteLength-size)invalid();
  length+=size;if(length>recipe.byteLength)invalid();
 }
 if(length!==recipe.byteLength)invalid();
 const bytes=new Uint8Array(length);let target=0;
 for(const [offset,size]of recipe.spans){bytes.set(pool.subarray(offset,offset+size),target);target+=size;}
 return bytes;
}
