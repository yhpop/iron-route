// Diagnostic-only monotonic time and independently scheduled RAF adapter. Original harness unchanged.
/**
 * Node VM / fake DOM, not browser or device acceptance.
 * Real: complete main module body, UI, input, catalogs, URL helper, launch/session,
 * world, game creation and simulation commands (with disposal/input metrics wrappers).
 * Mocked: WebGL renderer, GLB/tank/targeting/campaign views, audio, RAF scheduling,
 * DOM/window/location/history/storage. Synthetic terminal classification is opt-in.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as Three from 'three';
import {makeDOM} from './input-dom.mjs';
import {getActiveTargets} from '../src/campaign-view.js';
import * as session from '../src/session.js';
export const fixture={schema:1,selectedMissionId:'crafted20-002',unlockedIds:['crafted20-001','crafted20-002'],bestResults:{}};
export const legacyStorageBytes='  '+JSON.stringify({schema:1,selectedMissionId:'mission-207',unlockedIds:['mission-001','mission-002','mission-207'],bestResults:{'mission-002':{ticks:321,hp:87}}},null,2)+'\n';
export const CURRENT_PROGRESS_KEY='iron-route:crafted20:v1';
export const storageBytes='  '+JSON.stringify(fixture,null,2)+'\n';
export function makeStorage(){
 const values=new Map([[session.PROGRESS_KEY,legacyStorageBytes],[CURRENT_PROGRESS_KEY,storageBytes],['legacy-unrelated',' exact legacy bytes \n']]),writes=[],reads=[];
 return {values,writes,reads,getItem(key){reads.push(key);return values.get(key)??null;},setItem(key,value){writes.push({key,value});values.set(key,String(value));}};
}
export async function boot(search='',storage=makeStorage(),options={}){
 const main=options.mainSource ?? await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const imports=[...main.matchAll(/^import (.+?) from ['"](.+?)['"];\n/gm)];
 const body=main.replace(/^import (.+?) from ['"](.+?)['"];\n/gm,'');
 const dom=makeDOM(),help=dom.document.createElement('section');
 const originalQuery=dom.document.querySelector.bind(dom.document);
 dom.document.querySelector=selector=>selector==='#world'?dom.canvas:selector==='#launch-help'?help:originalQuery(selector);
 if(options.viewport)dom.window.visualViewport=options.viewport;
 const location=new URL(`https://example.invalid/tank/${search}`),historyCalls=[],errors=[];
 const history={state:{keep:'unchanged'},replaceState(state,title,url){historyCalls.push({state,title,url:String(url)});if(options.historyThrows)throw new Error('History denied');this.state=state;location.href=new URL(url,location).href;}};
 if(options.historyUnavailable)delete history.replaceState;
 dom.window.location=location;dom.window.history=history;
 const metrics={worldCreates:0,worldDisposes:0,viewDisposes:0,inputResets:0,inputEnabled:false,audioPaused:true,audioUnlocks:0,networkRequests:0,reloads:0,timers:0};
 location.reload=()=>{metrics.reloads++;};
 const renderer={shadowMap:{},capabilities:{getMaxAnisotropy:()=>4},setPixelRatio(){if(options.rendererSetupError)throw options.rendererSetupError;},setSize(){},render(_scene,camera){metrics.renderCamera=camera;},dispose(){metrics.rendererDisposes=(metrics.rendererDisposes||0)+1;}};
 const view=()=>({update(){},dispose(){metrics.viewDisposes++;}});
 let now=0;let latest,uiActions,scheduled,forceTerminal=false;
 // Only the synthetic terminal test changes a real step result to won; commands and all other simulation calls stay real.
 const bindings={};
 for(const [,clause,path] of imports){
  if(['three','../assets/tank_v5_articulated.glb','./tank-view.js','./targeting-view.js','./campaign-view.js','./tank-audio.js','./art-kit-embedded.js'].includes(path))continue;
  const module=await (options.loadModule ? options.loadModule(path) : import(new URL(path,new URL('../src/main.js',import.meta.url))));
  assert.match(clause,/^\{.*\}$/,'real source imports use named bindings in this harness');
  for(const entry of clause.slice(1,-1).split(',')){const [name,alias=name]=entry.trim().split(/\s+as\s+/);assert.ok(name in module,`missing actual export ${path}:${name}`);bindings[alias]=module[name];}
 }
 const artKit={dispose(){metrics.artDisposes=(metrics.artDisposes||0)+1;}};
 const context=vm.createContext({
  ...bindings,
  THREE:{...Three,WebGLRenderer:class{constructor(){if(options.rendererError)throw options.rendererError;return renderer;}}},tankBytes:new ArrayBuffer(0),
  loadEmbeddedCampaignArt:async()=>{metrics.artLoads=(metrics.artLoads||0)+1;await options.artReady;if(options.artError)throw options.artError;return artKit;},
  createWorld(spec){metrics.worldCreates++;const world=bindings.createWorld(spec);return {...world,dispose(){metrics.worldDisposes++;world.dispose();}};},
  createGame:bindings.createGame,stepGame(state,controls,dt,world){const next=bindings.stepGame(state,controls,dt,world);if(forceTerminal){forceTerminal=false;return {...next,phase:'won',result:{outcome:'won',elapsed:next.elapsed}};}return next;},
  loadTank:async()=>{metrics.tankLoads=(metrics.tankLoads||0)+1;await options.tankReady;if(options.tankError)throw options.tankError;return {...view(),...(options.tankRoot?{root:options.tankRoot}:{})};},createTargetingView:view,createCampaignView(scene,spec,viewOptions){metrics.viewOptions=viewOptions;metrics.viewCreates=(metrics.viewCreates||0)+1;return {...view(),ready:options.viewReady?.(spec)};},getActiveTargets,
  createTankAudio:()=>({setPaused(value){metrics.audioPaused=value;},setMuted(){},unlock:async()=>{metrics.audioUnlocks++;return true;},update(){},dispose(){}}),
  createInput(canvas,options){const input=bindings.createInput(canvas,options);return {...input,setEnabled(value){metrics.inputEnabled=value;input.setEnabled(value);},reset(...args){metrics.inputResets++;input.reset(...args);},sample(){metrics.lastControls=input.sample();return metrics.lastControls;}};},
  createUI(actions){uiActions=actions;const ui=bindings.createUI({...actions,...dom});return {...ui,render(state,spec,progress,status){latest={state,spec,progress,status};return ui.render(state,spec,progress,status);}};},
  document:dom.document,window:dom.window,location,history,localStorage:storage,
  devicePixelRatio:1,innerWidth:1024,innerHeight:768,performance:{now:()=>now},
  fetch(){metrics.networkRequests++;throw new Error('Unexpected startup network request');},
  setTimeout(){metrics.timers++;throw new Error('Unexpected startup timer');},setInterval(){metrics.timers++;throw new Error('Unexpected startup timer');},
  requestAnimationFrame(callback){metrics.framesScheduled=(metrics.framesScheduled||0)+1;scheduled=callback;return 1;},URL,URLSearchParams,
  console:{error:error=>errors.push(String(error?.stack||error)),log(){}}
 });
 new vm.Script(body,{filename:'campaign/src/main.js (imports source-resolved; GLB/WebGL boundaries stubbed)'}).runInContext(context);
 await new Promise(resolve=>setImmediate(resolve));
 if(!options.expectBootFailure){assert.deepEqual(errors,[],'actual main boot body must not hit fail()');assert.ok(latest);assert.equal(help.hidden,true);}
 return {...dom,help,errors,storage,location,history,historyCalls,metrics,options,get latest(){return latest;},get uiActions(){return uiActions;},
  get now(){return now;},elapse(ms){assert.ok(Number.isFinite(ms)&&ms>=0);now+=ms;},frame(ms=1000/60,rafTimestamp){assert.ok(Number.isFinite(ms)&&ms>=0);now+=ms;assert.ok(rafTimestamp===undefined||Number.isFinite(rafTimestamp));scheduled(rafTimestamp??now);},terminalOnNextFrame(){forceTerminal=true;},
  dispose(){dom.window.dispatch('pagehide',{persisted:false});}};
}
export function action(app,name){const node=app.mount.querySelector(`[data-action="${name}"]`);assert.ok(node,`action ${name}`);return node;}
export function selectOptional(app,slug){action(app,'open-missions').dispatch('click');const card=app.mount.querySelector(`[data-optional-slug="${slug}"]`);assert.ok(card,`optional card ${slug} is discoverable`);card.dispatch('click');}
