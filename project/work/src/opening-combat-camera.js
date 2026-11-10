/** Presentation only. The ordinary smoothed player/aim target remains untouched,
 * including its shadow-light anchor. No new scene objects or frame allocations.
 * Narrow/touch layouts retain their exact original camera: shifting east there
 * can clip the player or put combat behind the controls. */
export function applyFollowCamera(camera,target,focus,spec,width,height){
 const combatDesktop=spec?.eightNpcReconstruction===true&&width>=960&&height>560&&camera.aspect>=1.7;
 focus.copy(target);
 if(combatDesktop){
  focus.x+=12;focus.z-=2;
  camera.position.set(focus.x+10,focus.y+25,focus.z+24);
 }else{
  const portrait=camera.aspect<.85;
  camera.position.set(target.x+(portrait?8:10),target.y+(portrait?23:19),target.z+(portrait?22:18));
 }
 camera.lookAt(focus);
}
