import path from 'node:path';

/** Only the real main's ruined adapter import is accelerated. Other worlds and
 * importers retain original modules; onLoad/localization still sees old main. */
export function createSweepAccelerationPlugin({root}) {
 const main=path.resolve(root,'src/main.js');
 const accelerated=path.resolve(root,'src/ruined-depot-world-accelerated.js');
 return {name:'ruined-main-sweep-acceleration',setup(build){
  build.onResolve({filter:/^\.\/ruined-depot-world\.js$/,namespace:'file'},args=>{
   if(args.importer!==main)return;
   return {path:accelerated};
  });
 }};
}
