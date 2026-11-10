/** Node native Event/EventTarget + fake element tree/visual viewport. Not WebKit acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDOM,FakeElement} from './input-dom.mjs';
const module=await import('../src/gameplay-gestures.js');
function setup(viewport) {
 assert.equal(typeof module.createGameplayGestureGuard,'function','gesture guard is implemented');
 const dom=makeDOM(),events=new EventTarget(),registrations=[],installed=new Set();
 dom.document.addEventListener=(type,fn,options)=>{registrations.push({type,options});installed.add(type);events.addEventListener(type,fn,options);};
 dom.document.removeEventListener=(...args)=>{installed.delete(args[0]);events.removeEventListener(...args);};
 const controls=dom.document.createElement('div');controls.className='campaign-controls';dom.mount.append(controls);
 const drive=dom.document.createElement('div');drive.setAttribute('data-control','drive');controls.append(drive);
 const governor=dom.document.createElement('button');governor.setAttribute('data-control','travel');controls.append(governor);
 const ui=dom.document.createElement('div');ui.className='campaign-ui';dom.document.body.append(ui);
 const nav=dom.document.createElement('button');ui.append(nav);
 const modal=dom.document.createElement('div');modal.className='campaign-modal-layer';ui.append(modal);
 if(viewport)dom.window.visualViewport=viewport;
 let zooms=0;
 const guard=module.createGameplayGestureGuard(dom.canvas,{...dom,onZoom(){zooms++;guard.setActive(false);}});
 function fire(type,target=dom.canvas,{cancelable=true,count=1,...more}={}) {
  const event=new Event(type,{cancelable});Object.defineProperty(event,'target',{value:target});
  Object.assign(event,{touches:Array.from({length:count},()=>({target})),...more});events.dispatchEvent(event);return event;
 }
 return {...dom,events,registrations,installed,guard,drive,governor,nav,modal,fire,get zooms(){return zooms;}};
}

test('guard cancels native game touches only during play, explicitly non-passive and without stopping delivery',()=>{
 const app=setup();assert.equal(app.fire('touchstart').defaultPrevented,false);app.guard.setActive(true);
 let delivered=0;app.events.addEventListener('touchstart',()=>delivered++);
 for(const type of ['touchstart','touchmove','touchend']) {
  assert.equal(app.fire(type,app.drive,{count:3}).defaultPrevented,true,type);
  assert.equal(app.fire(type,app.canvas).defaultPrevented,true,type);
  assert.equal(app.fire(type,app.canvas,{cancelable:false}).defaultPrevented,false,'noncancelable event is respected');
 }
 assert.equal(delivered,3);
 for(const type of ['touchstart','touchmove','touchend','gesturestart','gesturechange','gestureend','dblclick']) {
  const registration=app.registrations.find(item=>item.type===type);assert.ok(registration,type);
  assert.equal(registration.options.passive,false);assert.equal(registration.options.capture,true);
 }
 assert.equal(app.document.documentElement.getAttribute('data-gameplay-active'),'true');
 app.guard.setActive(false);assert.equal(app.fire('touchstart',app.drive).defaultPrevented,false);
 assert.equal(app.document.documentElement.getAttribute('data-gameplay-active'),'false');app.guard.dispose();
});

test('click controls retain single-tap defaults, while multi-touch/gesture defaults are blocked and menu/editable/outside defaults survive',()=>{
 const app=setup();app.guard.setActive(true);
 for(const node of [app.nav,app.governor]) {
  assert.equal(app.fire('touchstart',node).defaultPrevented,false);
  assert.equal(app.fire('touchend',node,{count:0}).defaultPrevented,false);
  assert.equal(app.fire('touchstart',node,{count:2}).defaultPrevented,false,'pause/governor still click while another finger holds a stick');
  assert.equal(app.fire('touchmove',node,{count:2}).defaultPrevented,true);
  for(const type of ['gesturestart','gesturechange','gestureend','dblclick']) assert.equal(app.fire(type,node).defaultPrevented,true,type);
 }
 const select=app.document.createElement('select');app.nav.append(select);
 const editor=app.document.createElement('div'),child=app.document.createElement('span');editor.isContentEditable=true;editor.append(child);app.nav.append(editor);
 for(const node of [select,child,app.modal,app.document.body]) for(const type of ['touchstart','touchmove','touchend','gesturestart','dblclick']) assert.equal(app.fire(type,node,{count:2}).defaultPrevented,false);
 app.guard.dispose();assert.equal(app.fire('gesturechange',app.canvas).defaultPrevented,false);
});

test('read-only visual viewport scale triggers one pause and releases the guard until manual recovery',()=>{
 const viewport=new FakeElement('visualviewport');let scale=1;Object.assign(viewport,{width:512,height:384,offsetLeft:100,offsetTop:60});
 Object.defineProperty(viewport,'scale',{get:()=>scale});const app=setup(viewport);app.guard.setActive(true);
 scale=2;viewport.dispatch('resize');assert.equal(app.zooms,1);assert.equal(app.fire('touchmove',app.canvas,{count:2}).defaultPrevented,false);
 const note=app.document.body.querySelector('.campaign-zoom-recovery');assert.equal(note.hidden,false);assert.equal(note.style.left,'112px');assert.equal(note.style.top,'72px');
 viewport.offsetLeft=130;viewport.dispatch('scroll');assert.equal(note.style.left,'142px');assert.equal(app.zooms,1);
 scale=1;viewport.dispatch('resize');assert.equal(note.hidden,true);assert.equal(app.fire('touchstart').defaultPrevented,false,'never auto-resumes');
 app.guard.setActive(true);assert.equal(app.fire('touchstart').defaultPrevented,true);app.guard.dispose();app.guard.dispose();
 scale=2;viewport.dispatch('resize');assert.equal(app.zooms,1);assert.equal(app.document.body.querySelector('.campaign-zoom-recovery'),null);
});

test('paused menus have no document scroll-blocking listeners and resuming never duplicates them',()=>{
 const app=setup();assert.equal(app.installed.size,0);app.guard.setActive(true);assert.equal(app.installed.size,7);
 const registered=app.registrations.length;app.guard.setActive(true);assert.equal(app.registrations.length,registered);
 app.guard.setActive(false);assert.equal(app.installed.size,0);app.guard.setActive(true);assert.equal(app.installed.size,7);
 app.guard.dispose();assert.equal(app.installed.size,0);
});
