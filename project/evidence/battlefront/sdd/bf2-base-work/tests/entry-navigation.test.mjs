import test from 'node:test';
import assert from 'node:assert/strict';
import * as records from '../src/content/optional-records.js';
import {listMissions} from '../src/content/index.js';
import {syncEntryUrl as sync} from '../src/entry-navigation.js';
function setup(href='https://example.invalid/tank/?x=1#stay'){
 const location=new URL(href),calls=[],state={keep:['same object']};
 const history={state,replaceState(value,title,url){calls.push({value,title,url});location.href=new URL(url,location).href;}};
 return {location,history,calls,state};
}
test('optional catalog is immutable, contains exactly both existing providers and never expands ordinary registry',()=>{
 assert.equal(typeof records.listOptionalMissions,'function');const list=records.listOptionalMissions();
 assert.ok(Object.isFrozen(list));assert.deepEqual(list.map(entry=>entry.slug).sort(),['breach-cover','warehouse-fork']);
 for(const entry of list){assert.ok(Object.isFrozen(entry));assert.ok(Object.isFrozen(entry.spec));assert.equal(entry.spec,records.getOptionalMission(entry.slug));assert.deepEqual(Object.keys(entry).sort(),['slug','spec']);assert.equal(listMissions().includes(entry.spec),false);}
 assert.equal(listMissions().length,303);
});
for(const slug of ['breach-cover','warehouse-fork'])test(`helper selects ${slug}, preserves path/origin/hash/state, replaces exactly once`,()=>{
 const app=setup('https://example.invalid:8443/tank/a%2Fb/?x=a%20b&x=%2f#r%20s');assert.equal(sync(app.location,app.history,slug),true);
 assert.equal(app.location.href,`https://example.invalid:8443/tank/a%2Fb/?x=a%20b&x=%2f&sortie=${slug}#r%20s`);assert.equal(app.calls.length,1);assert.equal(app.calls[0].value,app.state);assert.equal(app.calls[0].title,'');
 assert.equal(sync(app.location,app.history,slug),true);assert.equal(app.calls.length,1,'already correct is a successful no-op');
});
test('helper removes all duplicate and encoded sortie keys without reserializing unrelated raw segments',()=>{
 const app=setup('https://example.invalid/tank/?a=%20&sortie=bad&&%73ortie=breach-cover&b=one+two&sort%69e=warehouse-fork&%2573ortie=untouched&flag&bad%=v%#same');
 assert.equal(sync(app.location,app.history,'warehouse-fork'),true);
 assert.equal(app.location.search,'?a=%20&&b=one+two&%2573ortie=untouched&flag&bad%=v%&sortie=warehouse-fork');
 assert.equal(sync(app.location,app.history,null),true);assert.equal(app.location.search,'?a=%20&&b=one+two&%2573ortie=untouched&flag&bad%=v%');assert.equal(app.location.hash,'#same');assert.equal(app.calls.length,2);
});
test('normal removes the sole sortie and preserves a trailing empty non-sortie segment',()=>{
 const app=setup('https://example.invalid/tank/?sortie=breach-cover#stay');assert.equal(sync(app.location,app.history,null),true);assert.equal(app.location.href,'https://example.invalid/tank/#stay');
 const extra=setup('https://example.invalid/tank/?sortie=breach-cover&x=1&#stay');assert.equal(sync(extra.location,extra.history,null),true);assert.equal(extra.location.search,'?x=1&');
});
test('normal already-correct URL needs no History API',()=>{const app=setup();assert.equal(sync(app.location,undefined,null),true);assert.equal(app.calls.length,0);});
test('unknown/nonstring optional slug is rejected without URL/history changes',()=>{
 for(const slug of ['missing','__proto__','constructor','',undefined,{},42]){const app=setup();assert.equal(sync(app.location,app.history,slug),false);assert.equal(app.calls.length,0);assert.equal(app.location.search,'?x=1');}
});
test('History API absent, inaccessible or throwing returns false without navigation fallback',()=>{
 for(const history of [undefined,{}, {get replaceState(){throw new Error('denied');}}, {get state(){throw new Error('denied');},replaceState(){assert.fail('must not run');}}, {replaceState(){throw new Error('denied');}}]){
  const location=new URL('https://example.invalid/tank/?sortie=breach-cover#stay'),before=location.href;assert.equal(sync(location,history,null),false);assert.equal(location.href,before);
 }
});
test('unavailable, inaccessible or malformed location returns false',()=>{
 for(const location of [undefined,{}, {get href(){throw new Error('denied');}},{href:'not a URL'}]){let writes=0;assert.equal(sync(location,{replaceState(){writes++;}},null),false);assert.equal(writes,0);}
});
test('file URL keeps absolute local path, unrelated query bytes and hash',()=>{
 const app=setup('file:///tmp/tank%20copy/index.html?local=%2f#view');assert.equal(sync(app.location,app.history,'breach-cover'),true);assert.equal(app.location.href,'file:///tmp/tank%20copy/index.html?local=%2f&sortie=breach-cover#view');
});
test('double-slash local pathname must never become a cross-origin history URL',()=>{
 const app=setup('https://example.invalid//other.example/path?sortie=breach-cover#view');assert.equal(sync(app.location,app.history,null),true);assert.equal(app.location.href,'https://example.invalid//other.example/path#view');
});
test('empty hash delimiter remains byte-exact when changing entry',()=>{
 const app=setup('https://example.invalid/tank/?sortie=breach-cover#');assert.equal(sync(app.location,app.history,null),true);assert.equal(app.location.href,'https://example.invalid/tank/#');
});
test('already-normal bare query is a successful no-op without History API',()=>{
 const app=setup('https://example.invalid/tank/?#');assert.equal(sync(app.location,undefined,null),true);assert.equal(app.location.href,'https://example.invalid/tank/?#');
});

for(const rawKey of ['?sortie','?%73ortie'])for(const position of ['first','later'])for(const slug of [null,'breach-cover','warehouse-fork']){
 test(`literal question-mark key ${rawKey} in ${position} position survives ${slug??'normal'} selection byte-exactly`,()=>{
  const unrelated=`${rawKey}=unrelated%2f+value`;
  const retained=position==='first'?`${unrelated}&keep=%20`:`keep=%20&${unrelated}`;
  const app=setup(`https://example.invalid/tank/?${retained}&sortie=breach-cover&%73ortie=warehouse-fork#stay`);
  assert.equal(sync(app.location,app.history,slug),true);
  const expected=`https://example.invalid/tank/?${retained}${slug===null?'':`&sortie=${slug}`}#stay`;
  assert.equal(app.location.href,expected,'only actual decoded sortie keys may be removed');assert.equal(app.calls.length,1);assert.equal(app.calls[0].value,app.state);
 });
}
test('caller resolver can authorize featured sorties without expanding legacy catalog',()=>{const app=setup('https://example.invalid/a?keep=%20&keep=one+two&sortie=old#stay'),resolve=s=>s==='vertical-slice'?{id:'mission-9030'}:null;assert.equal(sync(app.location,app.history,'vertical-slice',resolve),true);assert.equal(app.location.href,'https://example.invalid/a?keep=%20&keep=one+two&sortie=vertical-slice#stay');assert.equal(sync(app.location,app.history,'unknown',resolve),false);assert.equal(sync(app.location,app.history,'vertical-slice',()=>{throw Error('bad registry');}),false);});
