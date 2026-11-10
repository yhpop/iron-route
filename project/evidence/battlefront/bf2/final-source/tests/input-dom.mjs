export class FakeElement {
  constructor(tag='div', ownerDocument) { this.tagName=tag.toUpperCase(); this.ownerDocument=ownerDocument; this.children=[]; this.parentElement=null; this.listeners=new Map(); this.attributes={}; this.dataset={}; this.style={setProperty(name,value){this[name]=value;}}; this.className=''; this.textContent=''; this.hidden=false; this.disabled=false; this.rect={left:0,top:0,width:120,height:120}; this.captured=new Set(); }
  append(...children) { for (const child of children) { child.parentElement=this; this.children.push(child); } }
  appendChild(child) { this.append(child); return child; }
  remove() { if (this.parentElement) this.parentElement.children=this.parentElement.children.filter(child=>child!==this); this.parentElement=null; }
  replaceChildren(...children) { this.children.forEach(child=>child.parentElement=null); this.children=[]; this.append(...children); }
  setAttribute(name,value) { this.attributes[name]=String(value); if(name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value); }
  getAttribute(name) { return this.attributes[name]; }
  addEventListener(type,handler) { if(!this.listeners.has(type)) this.listeners.set(type,new Set()); this.listeners.get(type).add(handler); }
  removeEventListener(type,handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type,detail={}) { const event={type,target:this,currentTarget:this,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...detail}; for(const handler of [...(this.listeners.get(type)||[])]) handler(event); return event; }
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); }
  focus() { this.ownerDocument.activeElement=this; }
  querySelectorAll(selector) { return flatten(this).filter(element=>matches(element,selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0]||null; }
  closest(selector) { let current=this; while(current){if(matches(current,selector))return current;current=current.parentElement;} return null; }
}
function flatten(element) { return element.children.flatMap(child=>[child,...flatten(child)]); }
function matches(element,selector) {
  if(selector.includes(',')) return selector.split(',').some(s=>matches(element,s.trim()));
  const data=selector.match(/^\[data-([\w-]+)(?:="([^"]+)")?\]$/); if(data) return element.getAttribute(`data-${data[1]}`)!==undefined && (data[2]===undefined||element.getAttribute(`data-${data[1]}`)===data[2]);
  if(selector.startsWith('.')) return element.className.split(/\s+/).includes(selector.slice(1));
  return element.tagName.toLowerCase()===selector.toLowerCase();
}
export function makeDOM() {
  const document=new FakeElement('document'); document.ownerDocument=document; document.createElement=tag=>new FakeElement(tag,document); document.body=document.createElement('body'); document.documentElement=document.createElement('html'); document.documentElement.append(document.body); document.hidden=false; document.visibilityState='visible'; document.activeElement=document.body;
  const window=new FakeElement('window',document); document.defaultView=window; window.innerWidth=1024; window.innerHeight=768;
  const mount=document.createElement('main'); document.body.append(mount); const canvas=document.createElement('canvas'); canvas.rect={left:0,top:0,width:1024,height:768}; mount.append(canvas);
  return {document,window,mount,canvas};
}
export function byControl(root,name) { const found=root.querySelector(`[data-control="${name}"]`); if(!found) throw new Error(`Missing control ${name}`); return found; }
