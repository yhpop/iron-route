/** Native production UI in miniDOM: structure/state contracts, NOT browser paint proof. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {fixture} from './fielddesk-test-support.mjs';
test('garage visibility 20261103: all five choices precede and remain outside the scrolling dossier',t=>{
 const f=fixture(t),dialog=f.get('.campaign-dialog'),roster=f.get('.fielddesk-roster'),reading=f.get('.fielddesk-reading');
 assert.ok(roster,'roster must have its own non-scrolling shelf');assert.equal(roster.parentElement,dialog);
 assert.equal(f.get('.scorched-garage__grid').parentElement,roster);assert.equal(roster.querySelectorAll('[data-vehicle-id]').length,5);
 assert.equal(f.get('.scorched-garage__grid').closest('.fielddesk-reading'),null);
 assert.equal(f.get('.fielddesk-dossier').closest('.fielddesk-reading'),reading);
 assert.deepEqual(dialog.children.map(n=>n.className),['fielddesk-operation','fielddesk-roster','fielddesk-reading','campaign-dialog__actions']);
});
test('garage shelf selection preserves native mission, reading and focused real vehicle button',t=>{
 const f=fixture(t),mission=f.state.missionId;f.get('.fielddesk-reading').scrollTop=145;f.get('.fielddesk-instructions').open=true;
 for(const vehicle of f.roster){
  f.get(`[data-vehicle-id="${vehicle.id}"]`).dispatch('click');const button=f.get(`[data-vehicle-id="${vehicle.id}"]`);
  assert.equal(f.state.missionId,mission);assert.equal(f.state.tick,0);assert.equal(f.state.phase,'briefing');assert.equal(f.state.mission.playerVehicle.id,vehicle.id);
  assert.equal(f.document.activeElement,button);assert.equal(button.getAttribute('aria-pressed'),'true');
  assert.equal(f.get('.fielddesk-reading').scrollTop,145);assert.equal(f.get('.fielddesk-instructions').open,true);
  assert.equal(f.mount.querySelectorAll('.fielddesk-roster').length,1);
 }
});
test('garage shelf does not bypass loading/error gates and is removed for mission selection',t=>{
 const f=fixture(t);for(const viewStatus of ['loading','failed']){f.setStatus({viewStatus,viewError:'fixture'});assert.ok(f.get('.fielddesk-roster'));for(const n of f.get('.fielddesk-roster').querySelectorAll('button')){assert.equal(n.disabled,true);n.dispatch('click');}}
 assert.deepEqual(f.calls,[]);f.setStatus({viewStatus:'ready'});f.get('[data-action="open-missions"]').dispatch('click');assert.equal(f.get('.fielddesk-roster'),null);
});
test('garage shelf CSS reserves a fixed selector and start band without adding live battlefield chrome',()=>{
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(css,/\.fielddesk-roster\s*\{[^}]*flex-shrink:\s*0/);
 assert.match(css,/\.fielddesk-roster \.scorched-garage__grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,/);
 assert.match(css,/\.fielddesk-roster \.scorched-garage__grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,/);
 assert.match(css,/\.fielddesk-operation\s*\{[^}]*flex-shrink:\s*0/);
 assert.match(css,/\.fielddesk-reading\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/);
});
test('garage failed state at short viewport keeps one visible recovery action instead of two fixed rows',t=>{
 const f=fixture(t);f.window.innerWidth=568;f.window.innerHeight=320;f.setStatus({viewStatus:'failed',viewError:'fixture failure'});
 const start=f.get('[data-action="start"]'),retry=f.get('[data-action="retry"]');assert.equal(start.disabled,true);assert.equal(start.hidden,true);assert.equal(retry.hidden,false);assert.equal(retry.disabled,false);
 assert.deepEqual(f.get('.campaign-dialog__actions').children.filter(n=>!n.hidden).map(n=>n.getAttribute('data-action')),['retry']);
 start.dispatch('click');assert.deepEqual(f.calls,[]);retry.dispatch('click');assert.deepEqual(f.calls,['retry']);
});
test('garage has a very-short-height outer scrolling escape hatch rather than inaccessible clipped controls',()=>{
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');assert.match(css,/@media \(max-height: 280px\)[\s\S]*\.fielddesk-dialog\s*\{[^}]*overflow-y:\s*auto/);
});
