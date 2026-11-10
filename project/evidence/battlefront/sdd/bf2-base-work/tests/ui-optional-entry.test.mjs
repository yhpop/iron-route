import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createUI} from '../src/campaign-ui.js';
import {createGame} from '../src/campaign-simulation.js';
import {getMission,listMissions} from '../src/content/index.js';
import {getOptionalMission} from '../src/content/optional-records.js';
import {makeDOM} from './input-dom.mjs';
const optionalMissions=['warehouse-fork','breach-cover'].map(slug=>({slug,spec:getOptionalMission(slug)}));
const progress={schema:1,selectedMissionId:'mission-001',unlockedIds:['mission-001','mission-002'],bestResults:{}};
function setup(){const dom=makeDOM(),calls=[];const ui=createUI({...dom,missions:listMissions(),optionalMissions,selectOptionalMission:slug=>calls.push(['optional',slug]),selectMission:id=>calls.push(['normal',id]),retry:()=>calls.push(['retry'])});return {...dom,ui,calls};}
function action(app,name){const node=app.mount.querySelector(`[data-action="${name}"]`);assert.ok(node,name);return node;}
test('existing selector separately labels both optional cards outside normal pagination and chapter filters',()=>{
 const app=setup(),spec=getMission('mission-001');app.ui.render(createGame(spec),spec,progress);action(app,'open-missions').dispatch('click');
 const section=app.mount.querySelector('.campaign-optional-section');assert.ok(section);assert.equal(section.querySelector('h2').textContent,'战术支线');assert.match(section.querySelector('p').textContent,/不影响战役进度/);
 const dialog=app.mount.querySelector('.campaign-dialog'),ordinaryGrid=app.mount.querySelector('[data-mission-id]').parentElement;
 assert.ok(dialog.children.indexOf(section)<dialog.children.indexOf(ordinaryGrid),'discoverable optional section precedes the ordinary paginated grid');
 assert.ok(dialog.children.indexOf(section)<dialog.children.indexOf(app.mount.querySelector('select').parentElement),'optional section precedes ordinary chapter filtering');
 assert.equal(app.mount.querySelectorAll('[data-mission-id]').length,12);assert.equal(app.mount.querySelector('.campaign-page-label').textContent,'1 / 26');
 for(const {slug,spec} of optionalMissions){const card=section.querySelector(`[data-optional-slug="${slug}"]`);assert.equal(card.textContent,spec.title);assert.equal(card.disabled,false);assert.ok(card.className.includes('campaign-mission-card'));assert.ok(card.className.includes('campaign-button'));assert.equal(card.getAttribute('data-mission-id'),undefined);}
 const filter=app.mount.querySelector('select');assert.deepEqual(filter.children.map(option=>option.value),['all','1','2','3','4','5','6']);filter.value='6';filter.dispatch('change');assert.equal(app.mount.querySelectorAll('[data-optional-slug]').length,2);assert.equal(app.mount.querySelectorAll('[data-mission-id]').length,12);
 app.mount.querySelector('[data-optional-slug="breach-cover"]').dispatch('click');assert.deepEqual(app.calls,[['optional','breach-cover']]);
 app.ui.dispose();
});
test('optional selection and normal selection use distinct callbacks; close and retry never imply selection',()=>{
 const app=setup(),spec=getOptionalMission('warehouse-fork'),state=createGame(spec);app.ui.render(state,spec,progress);action(app,'open-missions').dispatch('click');
 assert.equal(app.mount.querySelector('[data-optional-slug="warehouse-fork"]').getAttribute('aria-current'),'true');action(app,'close-missions').dispatch('click');assert.deepEqual(app.calls,[]);assert.equal(app.mount.querySelector('.campaign-dialog__title').textContent,spec.title);
 app.ui.render({...state,phase:'paused'},spec,progress);action(app,'retry').dispatch('click');assert.deepEqual(app.calls,[['retry']]);
 action(app,'open-missions').dispatch('click');app.mount.querySelector('[data-optional-slug="breach-cover"]').dispatch('click');assert.deepEqual(app.calls.at(-1),['optional','breach-cover']);
 app.ui.render(state,spec,progress);action(app,'open-missions').dispatch('click');app.mount.querySelector('[data-mission-id="mission-002"]').dispatch('click');assert.deepEqual(app.calls.at(-1),['normal','mission-002']);app.ui.dispose();
});
test('entry warning invalidates phase and selector caches, is nonfatal and distinct from storage failure',()=>{
 const app=setup(),spec=getMission('mission-001'),state=createGame(spec);app.ui.render(state,spec,progress,{entryWarning:false});assert.equal(app.mount.querySelector('.campaign-entry-warning'),null);
 app.ui.render(state,spec,progress,{entryWarning:true});let warning=app.mount.querySelector('.campaign-entry-warning');assert.ok(warning);assert.equal(warning.getAttribute('role'),'status');assert.match(warning.textContent,/刷新.*原|刷新.*之前/);assert.doesNotMatch(warning.textContent,/进度.*保存/);assert.ok(action(app,'start'));
 action(app,'open-missions').dispatch('click');assert.ok(app.mount.querySelector('.campaign-entry-warning'));app.ui.render(state,spec,progress,{entryWarning:false});assert.equal(app.mount.querySelector('.campaign-entry-warning'),null);assert.equal(app.mount.querySelector('.campaign-dialog').getAttribute('data-mode'),'missions');app.ui.dispose();
});
test('optional cards inherit at least 44px targets and remain in existing scrollable dialog',async()=>{
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');const button=css.match(/\.campaign-button\s*\{([^}]+)\}/)?.[1],dialog=css.match(/\.campaign-dialog\s*\{([^}]+)\}/)?.[1];assert.match(button,/min-height:\s*44px/);assert.match(dialog,/overflow-y:\s*auto/);for(const [,height] of css.matchAll(/\.campaign-mission-card\s*\{[^}]*min-height:\s*(\d+)px/g))assert.ok(Number(height)>=44);
});
