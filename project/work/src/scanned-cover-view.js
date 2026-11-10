import {SCANNED_COVER_IDS} from './scanned-cover-front.js';
/** Synchronous artwork-only swap preserves authored solid roots and transforms.
 * Old wall children remain owned by campaign view. Dispose this decorator before
 * campaign view; shared scan geometry/materials belong only to the art library. */
export function applyScannedCoverView(scene,spec,library){
 if(!library?.clone)throw new Error('Scanned cover requires loaded art');
 const records=[];
 for(const id of SCANNED_COVER_IDS){const c=spec.geometry.find(c=>c.id===id),root=scene.getObjectByName(`solid:${id}`);if(!c||!root?.parent)throw new Error(`Missing scanned cover collider/view ${id}`);records.push({root,children:[...root.children]});}
 // Prepare all borrowers before mutation so clone failure leaves walls unchanged.
 for(const r of records)r.object=library.clone();
 for(const r of records){r.root.clear();r.root.add(r.object);}
 let disposed=false;return {diagnostics:{instances:3,borrowedResources:true},dispose(){if(disposed)return;disposed=true;for(const r of records){r.object.removeFromParent();for(const child of r.children)r.root.add(child);}}};
}
