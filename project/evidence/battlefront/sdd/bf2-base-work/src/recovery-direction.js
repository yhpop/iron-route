// Presentation only: contact positions suggest a direction, never certify a
// collision-free path. Use confirmed contact IDs; unknown/side/mixed stays open.
export function contactEscapeGuidance(state,contactIds) {
 const p=state.tank?.pose,finite=q=>q&&Number.isFinite(q.x)&&Number.isFinite(q.z);
 let escapeDirection='unknown';
 if(finite(p)&&Number.isFinite(p.yaw)&&contactIds.length){
  const projections=contactIds.map(id=>{const q=state.entities?.[id]?.pose;if(!finite(q))return null;const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);return d>.1?(-Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)/d:null;});
  if(projections.every(n=>n!==null&&n<-.55))escapeDirection='forward';
  else if(projections.every(n=>n!==null&&n>.55))escapeDirection='reverse';
 }
 const full=escapeDirection==='forward'?'先停稳，接触对象在后方，可尝试前进拉开间距，再把炮管转离障碍；若受阻就换方向，勿强挤。':escapeDirection==='reverse'?'先停稳，接触对象在前方，可尝试倒车拉开间距，再把炮管转离障碍；若受阻就换方向，勿强挤。':'先停稳，方向未明，观察接触位置后尝试前进或倒车留侧隙，再把炮管转离障碍；仍可能受阻，勿强挤。';
 const compact=escapeDirection==='forward'?'停稳→试前进→留侧隙，炮管转离；受阻换向':escapeDirection==='reverse'?'停稳→试倒车→留侧隙，炮管转离；受阻换向':'停稳→看接触→试前进或倒车，留侧隙转炮；勿强挤';
 return {escapeDirection,full,compact};
}
