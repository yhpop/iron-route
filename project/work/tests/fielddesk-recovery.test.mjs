import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

import {fixture} from './fielddesk-test-support.mjs';
const hashes={vanguard:'fddc8ec0120b4f5ce7bafb7a6bd77d3af6f3caa7fb9918b8b1f9ad2c177e067e',pz3:'ec89e497fe930d56db7a92329769c79af2135037ced874819da25f5c6a8be534','newc-leichttraktor':'7423196221d4874fae6816cf78f77bb0a122ca984b755b460cfeb3a38f8a5fd5','newc-tiger':'1b29d6b22d122276095f322e37928dbe7f26b253262cda3f0309224d42bdfece',sandfalcon:'8e81db53ce48021399d3fb3c8a5c9742ca83d704b712d88c4ea5015745ba13e0'};

test('Fielddesk source recovery renders actual five-vehicle dossier and verified plate bytes',t=>{
  const f=fixture(t);assert.ok(f.get('.fielddesk-dossier'),'native Fielddesk dossier is present');
  assert.equal(f.get('.scorched-garage__grid').querySelectorAll('button').length,5);
  for(const vehicle of f.roster){
    f.get(`[data-vehicle-id="${vehicle.id}"]`).dispatch('click');
    assert.equal(f.state.mission.playerVehicle.id,vehicle.id);assert.equal(f.state.missionId,'mission-9090');assert.equal(f.state.tick,0);
    assert.equal(f.get('.fielddesk-vehicle-title').textContent,vehicle.title);
    assert.equal(f.get('.fielddesk-tradeoff').textContent,vehicle.tradeoff);
    assert.deepEqual(f.get('.fielddesk-metrics').querySelectorAll('dd').map(n=>n.textContent),[vehicle.hp+' HP',vehicle.weapon.damage+' HP',vehicle.weapon.reload+' s',vehicle.controller.governorCaps.travel+' m/s']);
    const bytes=Buffer.from(f.get('.fielddesk-plate').getAttribute('src').split(',')[1],'base64');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hashes[vehicle.id]);
    assert.equal(f.get(`[data-vehicle-id="${vehicle.id}"]`).getAttribute('aria-pressed'),'true');
  }
});
test('Fielddesk keeps native Loading Extraction goals and owner-owned start state',t=>{
  const f=fixture(t),before=JSON.stringify(f.state);f.render();assert.equal(JSON.stringify(f.state),before);
  assert.equal(f.get('.campaign-dialog__title').textContent,f.raw.title);
  assert.equal(f.state.mission.objectives[0].type,'defend');assert.equal(f.state.mission.objectives[0].duration,18);
  assert.ok(f.get('.fielddesk-reading'));
  assert.equal(f.get('[data-action="start"]').parentElement.parentElement,f.get('.campaign-dialog'));
  assert.equal(f.credits.parentElement,f.get('.fielddesk-reading'));
  f.get('[data-action="start"]').dispatch('click');assert.equal(f.state.phase,'playing');assert.equal(f.state.tick,0);
  assert.equal(f.get('.campaign-modal-layer').hidden,true);assert.deepEqual(f.calls,['start']);
});
test('Fielddesk preserves scroll and disclosure through same-mission selection/loading',t=>{
  const f=fixture(t);assert.ok(f.get('.fielddesk-reading'));
  f.get('.fielddesk-reading').scrollTop=123;f.get('.fielddesk-instructions').open=true;
  f.get('[data-vehicle-id="pz3"]').dispatch('click');
  assert.equal(f.get('.fielddesk-reading').scrollTop,123);assert.equal(f.get('.fielddesk-instructions').open,true);
  f.setStatus({viewStatus:'loading'});assert.equal(f.get('.fielddesk-reading').scrollTop,123);
  f.setStatus({viewStatus:'ready'});assert.equal(f.get('.fielddesk-instructions').open,true);
});
test('Fielddesk rejects detached vehicle callbacks even after resource loading returns ready',t=>{
  const f=fixture(t),stale=f.get('[data-vehicle-id="vanguard"]');
  f.get('[data-vehicle-id="pz3"]').dispatch('click');f.setStatus({viewStatus:'loading'});f.setStatus({viewStatus:'ready'});
  stale.dispatch('click');assert.deepEqual(f.calls,['pz3']);
});
test('Fielddesk loading and failed states never start or select; failed retains retry',t=>{
  const f=fixture(t);for(const viewStatus of ['loading','failed']){
    f.setStatus({viewStatus,viewError:'test asset unavailable'});
    for(const node of f.mount.querySelectorAll('[data-vehicle-id]')){assert.equal(node.disabled,true);node.dispatch('click');}
    assert.equal(f.get('[data-action="start"]').disabled,true);f.get('[data-action="start"]').dispatch('click');
  }assert.deepEqual(f.calls,[]);f.get('[data-action="retry"]').dispatch('click');assert.deepEqual(f.calls,['retry']);
});
test('Fielddesk disclosure summaries and open attribution links enter modal tab order',t=>{
  const f=fixture(t),instructions=f.get('.fielddesk-instructions');assert.ok(instructions);
  const instructionSummary=instructions.querySelector('summary');instructionSummary.focus();
  f.window.dispatch('keydown',{code:'Tab',target:instructionSummary});assert.equal(f.document.activeElement,f.credits.querySelector('summary'));
  f.credits.open=false;f.credits.querySelector('summary').focus();f.window.dispatch('keydown',{code:'Tab'});assert.notEqual(f.document.activeElement,f.link);
  f.credits.open=true;f.credits.querySelector('summary').focus();f.window.dispatch('keydown',{code:'Tab'});assert.equal(f.document.activeElement,f.link);
  f.link.style.display='none';f.credits.querySelector('summary').focus();f.window.dispatch('keydown',{code:'Tab'});assert.notEqual(f.document.activeElement,f.link);
});
test('Fielddesk resource completion preserves an eligible focused attribution link',t=>{
  const f=fixture(t);f.setStatus({viewStatus:'loading'});f.credits.open=true;f.link.focus();
  f.setStatus({viewStatus:'ready'});assert.equal(f.document.activeElement === f.link,true,'focused attribution link should survive resource redraw');
  f.credits.open=false;f.setStatus({viewStatus:'failed'});assert.equal(f.document.activeElement === f.link,false,'closed details link must not remain focus target');
});
test('Fielddesk mission transition and retry reset reading state without replacing mission',t=>{
  const f=fixture(t);assert.ok(f.get('.fielddesk-reading'));f.get('.fielddesk-reading').scrollTop=177;f.get('.fielddesk-instructions').open=true;
  f.setStatus({viewStatus:'failed'});f.get('[data-action="retry"]').dispatch('click');f.setStatus({viewStatus:'ready'});
  assert.equal(f.get('.fielddesk-reading').scrollTop,0);assert.equal(Boolean(f.get('.fielddesk-instructions').open),false);
  f.get('.fielddesk-reading').scrollTop=92;f.setSpec({...f.spec,id:'mission-recovery-transition'});
  assert.equal(f.get('.fielddesk-reading').scrollTop,0);assert.equal(f.state.missionId,'mission-recovery-transition');
});
test('Fielddesk image decode failure keeps exact model identity and visible fallback',t=>{
  const f=fixture(t),img=f.get('.fielddesk-plate');assert.ok(img);img.dispatch('error');
  assert.equal(img.hidden,true);assert.equal(f.get('.fielddesk-plate-unavailable').hidden,false);
  assert.equal(f.get('.fielddesk-vehicle-title').textContent,f.spec.playerVehicle.title);
});
test('Fielddesk instruments are bounded real-state accents, not extra HUD rows',t=>{
  const f=fixture(t);assert.equal(f.mount.querySelectorAll('.fielddesk-instrument').length,2);
  const hp=f.get('[data-instrument="hp"]'),readiness=f.get('[data-instrument="readiness"]');
  f.setState({...f.state,phase:'playing',tankCombat:{...f.state.tankCombat,hp:50,maxHp:100,reload:0}});
  assert.equal(hp.style['--fielddesk-fill'],'0.5');assert.equal(readiness.style['--fielddesk-fill'],'1');
  f.setState({...f.state,tankCombat:{...f.state.tankCombat,hp:-1,maxHp:100,reload:2}});
  assert.equal(hp.style['--fielddesk-fill'],'0');assert.equal(readiness.style['--fielddesk-fill'],'0');
});
test('Fielddesk CSS keeps later battlefield safeguards intact and has a separate scrolling reader',()=>{
  const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
  assert.match(css,/\.fielddesk-reading\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(css,/\.fielddesk-dialog > \.campaign-dialog__actions\s*\{[^}]*flex-shrink:\s*0/);
  assert.match(css,/@media \(max-height: 420px\)/);
});
