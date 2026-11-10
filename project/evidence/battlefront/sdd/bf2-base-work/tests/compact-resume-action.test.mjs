/** CSS source contracts + miniDOM actions only; NOT measured browser rectangles/font shaping. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createUI} from '../src/campaign-ui.js';
import {createGame} from '../src/campaign-simulation.js';
import {createRuinedDepotFront} from '../src/ruined-depot-front.js';
import {makeDOM} from './input-dom.mjs';
import {boot,action} from './main-entry-harness.mjs';
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
// Balanced blocks avoid treating a later unrelated selector as part of the media.
function blocks(source){source=source.replace(/\/\*[\s\S]*?\*\//g,'');const out=[];for(let i=0;i<source.length;i++){if(source[i]!=='{')continue;let n=1,j=i+1;for(;j<source.length&&n;j++){if(source[j]==='{')n++;if(source[j]==='}')n--;}assert.equal(n,0);const start=Math.max(source.lastIndexOf('}',i-1),source.lastIndexOf(';',i-1))+1;out.push({header:source.slice(start,i).replace(/\/\*[\s\S]*?\*\//g,'').trim(),body:source.slice(i+1,j-1)});i=j-1;}return out;}

test('CSS source contract: compact paused primary owns a full-width nonshrinking row with normal text',()=>{
 const media=blocks(css).find(b=>b.header==='@media (max-width: 600px)'&&blocks(b.body).some(r=>r.header==='.campaign-dialog[data-mode="paused"] .campaign-dialog__actions > .campaign-button--primary'));
 assert.ok(media,'compact paused-only action media rule must exist');
 const rules=blocks(media.body);assert.equal(rules.length,1,'no extra phase or global wrapping changes');
 const rule=rules[0];assert.equal(rule.header,'.campaign-dialog[data-mode="paused"] .campaign-dialog__actions > .campaign-button--primary');
 for(const declaration of [/flex-basis:\s*100%\s*;/,/flex-shrink:\s*0\s*;/,/min-inline-size:\s*0\s*;/,/max-inline-size:\s*100%\s*;/])assert.match(rule.body,declaration);
 assert.doesNotMatch(rule.body,/font|overflow|white-space|word-break|transform|height|display|visibility/,'do not hide, clip, shrink text, or override target height');
});

test('CSS source contracts retain secondary wrapping, 44px buttons and vertical dialog overflow',()=>{
 assert.match(css,/\.campaign-dialog__actions\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*gap:\s*8px/s);
 assert.match(css,/\.campaign-button\s*\{[^}]*min-height:\s*44px;[^}]*font-size:\s*13px/s);
 assert.match(css,/\.campaign-dialog\s*\{[^}]*max-height:\s*100%;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain/s);
});

test('miniDOM contract: actual ruined paused footer has resume/restart/selector/sound and primary focus',()=>{
 const dom=makeDOM(),calls=[];let muted=true;
 const ui=createUI({...dom,missions:[],resume:()=>calls.push('resume'),retry:()=>calls.push('retry'),soundMuted:()=>muted,toggleSound:()=>{muted=!muted;calls.push('sound');}});
 const {spec}=createRuinedDepotFront(),state=createGame(spec);state.phase='paused';
 try{
  ui.render(state,spec,{});const dialog=dom.mount.querySelector('.campaign-dialog'),footer=dom.mount.querySelector('.campaign-dialog__actions');
  assert.equal(dialog.getAttribute('data-mode'),'paused');assert.equal(dialog.hidden,false);
  const resume=action(dom,'resume');assert.equal(resume.parentElement,footer);assert.ok(resume.className.split(' ').includes('campaign-button--primary'));
  assert.equal(resume.textContent,'继续行动');assert.equal(dom.document.activeElement,resume);assert.equal(resume.disabled,false);
  assert.deepEqual(footer.children.map(n=>n.getAttribute('data-action')),['resume','retry','open-missions','paused-sound']);
  resume.dispatch('click');action(dom,'paused-sound').dispatch('click');action(dom,'retry').dispatch('click');assert.deepEqual(calls,['resume','sound','retry']);
  const focused=dom.document.activeElement;dom.window.dispatch('keydown',{code:'Tab',shiftKey:true,target:focused});assert.equal(dom.document.activeElement.closest('.campaign-dialog'),dialog);
  action(dom,'open-missions').dispatch('click');assert.equal(dialog.getAttribute('data-mode'),'missions');
 }finally{ui.dispose();}
});

test('miniDOM actual-main command contract retains pause/resume input reset, primary focus and clean retry',async()=>{
 const app=await boot();try{
  action(app,'start').dispatch('click');assert.equal(app.latest.state.phase,'playing');
  app.window.dispatch('keydown',{code:'KeyW'});const before=app.metrics.inputResets;
  app.window.dispatch('keydown',{code:'Escape'});assert.equal(app.latest.state.phase,'paused');assert.equal(app.metrics.inputEnabled,false);assert.ok(app.metrics.inputResets>before);
  const resume=action(app,'resume');assert.equal(app.document.activeElement,resume);const paused=app.metrics.inputResets;
  resume.dispatch('click');assert.equal(app.latest.state.phase,'playing');assert.equal(app.metrics.inputEnabled,true);assert.ok(app.metrics.inputResets>paused);
  app.frame();assert.equal(app.metrics.lastControls.throttle,0,'held throttle cleared by command reset');
  app.window.dispatch('keydown',{code:'Escape'});action(app,'retry').dispatch('click');assert.equal(app.latest.state.phase,'briefing');assert.equal(app.metrics.inputEnabled,false);assert.equal(app.document.activeElement,action(app,'start'));
 }finally{app.dispose();}
});
