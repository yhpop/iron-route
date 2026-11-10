import {makeDOM} from './input-dom.mjs';
import {createUI} from '../src/campaign-ui.js';
import {createGame,stepGame} from '../src/campaign-simulation.js';
import {createLoadingExtraction} from '../src/loading-extraction-front.js';
import {listPlayerVehicles,withPlayerVehicle} from '../src/player-vehicles-v3.js';
// Node/miniDOM only: no claims about paint, browser layout, focus behavior or WebGL.
export function fixture(t, constructor=createUI) {
  const dom=makeDOM(), create=dom.document.createElement;
  dom.document.createElement=tag=>{const node=create(tag);node.scrollTop=0;node.scrollIntoView=()=>{};
    node.append=(...children)=>{for(const child of children){child.remove();child.parentElement=node;node.children.push(child);}};return node;};
  dom.window.getComputedStyle=node=>({display:node.style.display||'block',visibility:node.style.visibility||'visible'});
  const credits=dom.document.createElement('details'),summary=dom.document.createElement('summary'),link=dom.document.createElement('a');
  credits.id='asset-credits';summary.textContent='Credits';link.textContent='Attribution';link.setAttribute('href','https://example.invalid/attribution');credits.append(summary,link);
  dom.document.querySelector=s=>s==='#asset-credits'?credits:dom.document.body.querySelector(s);
  const roster=listPlayerVehicles(),raw=createLoadingExtraction().spec;
  let spec=withPlayerVehicle(raw,'sandfalcon'),state=createGame(spec),status={viewStatus:'ready'},ui;
  const calls=[],render=()=>ui.render(state,spec,{unlockedIds:[spec.id],bestResults:{}},status);
  ui=constructor({...dom,missions:[spec],playerVehicles:roster,
    selectPlayerVehicle:id=>{calls.push(id);spec=withPlayerVehicle(spec,id);state=createGame(spec);render();},
    start:()=>{calls.push('start');state=stepGame(state,{start:true});render();},
    retry:()=>{calls.push('retry');state=createGame(spec);render();},
    pause:()=>{state=stepGame(state,{pause:true});render();},resume:()=>{state=stepGame(state,{resume:true});render();}});
  render();t.after(()=>ui.dispose());
  return {...dom,ui,roster,raw,credits,link,calls,render,get:s=>dom.mount.querySelector(s),
    get state(){return state;},get spec(){return spec;},setStatus(value){status=value;render();},
    setState(value){state=value;render();},setSpec(value){spec=value;state=createGame(spec);render();}};
}
