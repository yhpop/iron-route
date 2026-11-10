/** Build-time notices only. No network access or runtime code is added. */
import {readFile} from 'node:fs/promises';
import path from 'node:path';

export async function readThirdPartyNotices(root){
 const three=await readFile(path.join(root,'licenses/THREE_LICENSE.txt'),'utf8');
 const terrain=await readFile(path.join(root,'src/terrain-candidate/vendor/three-terrain/LICENSE.txt'),'utf8');
 const noise=await readFile(path.join(root,'src/terrain-candidate/vendor/three-terrain/noise.js'),'utf8');
 const noiseNotice=noise.match(/^\/\*\*[\s\S]*?\*\/(?:\r?\n)?/)?.[0];
 if(!noiseNotice)throw new Error('The vendored noise source must retain its original notice');
 // Keep every source notice verbatim, including its copyright and disclaimer.
 return 'Third-party software notices\n============================\n\nThree.js\n--------\n\n'+three+
  '\n\nTHREE.Terrain\n-------------\n\n'+terrain+'\n\nnoisejs (vendored noise.js)\n--------------------------\n\n'+noiseNotice;
}

export function addThirdPartyNotices(html,notices,{download=false}={}){
 const escaped=notices.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 const section='<details id="third-party-notices"><summary>Third-party software notices</summary>'+
  (download?'<p><a href="./THIRD_PARTY_NOTICES.txt" download>Download full software notices</a></p>':'')+
  '<pre style="white-space:pre-wrap;font:inherit">'+escaped+'</pre></details>';
 const credits=/<details id="asset-credits"[^>]*>[\s\S]*?<\/details>/g;
 const matches=html.match(credits);
 if(matches?.length!==1)throw new Error('Expected exactly one existing asset-credits section');
 // A callback preserves literal replacement tokens such as $& in notice text.
 return html.replace(credits,match=>match.slice(0,-'</details>'.length)+section+'</details>');
}
