import {test} from "vitest";
import assert from 'node:assert/strict';
import {installPageTouchZoom} from "../src/input/pageTouchZoom.ts";
function createFixture(){
 const runtime=globalThis as unknown as Record<string,unknown>;
 const originals={window:runtime.window,document:runtime.document,Element:runtime.Element};
 const classes=()=>{const s=new Set<string>();return{toggle:(k:string,v:boolean)=>v?s.add(k):s.delete(k),contains:(k:string)=>s.has(k)};};
 const viewport=Object.assign(new EventTarget(),{scale:1});const surface=Object.assign(new EventTarget(),{visualViewport:viewport});
 const page=Object.assign(new EventTarget(),{hidden:false,documentElement:{classList:classes()},body:{classList:classes()}});
 class Target{ownerDocument=page;native=false;constructor(native=false){this.native=native;}closest(selector:string){return this.native&&selector.includes('input')?this:null;}}
 runtime.window=surface;runtime.document=page;runtime.Element=Target;
 let active=true,pauses=0;let adapter!:ReturnType<typeof installPageTouchZoom>;
 adapter=installPageTouchZoom({isActivelyPlaying:()=>active,pauseGame:()=>{active=false;pauses++;adapter.sync();}});
 const target=new Target(),touch=(id=1,t=target)=>({identifier:id,target:t,clientX:10,clientY:10});
 type Touch=ReturnType<typeof touch>;
 const send=(type:string,changed:Touch[]=[],touches:Touch[]=[])=>{const e=new Event(type,{cancelable:true});Object.assign(e,{changedTouches:changed,touches});surface.dispatchEvent(e);return e.defaultPrevented;};
 const f={adapter,page,viewport,target,touch,send,native:new Target(true),pause:()=>{active=false;adapter.sync();},active:()=>active,pauses:()=>pauses};
 return {...f,dispose(){adapter.dispose();for(const[k,v]of Object.entries(originals)){if(v===undefined)delete runtime[k];else runtime[k]=v;}}};
}
function fixture(run:(f:ReturnType<typeof createFixture>)=>void){const f=createFixture();try{run(f);}finally{f.dispose();}}
test('page ownership spans menu/Reset pause transitions until the actual finger lifts',()=>fixture(f=>{
 const a=f.touch();f.send('touchstart',[a],[a]);f.pause();assert.equal(f.send('gesturechange'),true);
 f.send('touchend',[a],[]);assert.equal(f.send('gesturechange'),false);
}));
test('an enlarged viewport pauses once even when its transition hook calls sync',()=>fixture(f=>{
 f.viewport.scale=1.8;f.viewport.dispatchEvent(new Event('resize'));assert.equal(f.pauses(),1);assert.equal(f.active(),false);assert.equal(f.page.documentElement.classList.contains('page-zoomed'),true);
 const a=f.touch(),b=f.touch(2);assert.equal(f.send('touchstart',[a,b],[a,b]),false);assert.equal(f.send('gesturechange'),false);
}));
test('scale-one recovery relatches page protection while keeping gameplay paused',()=>fixture(f=>{
 f.viewport.scale=1.8;f.viewport.dispatchEvent(new Event('resize'));f.viewport.scale=1;f.viewport.dispatchEvent(new Event('resize'));
 assert.equal(f.active(),false);assert.equal(f.page.body.classList.contains('game-playing'),false);assert.equal(f.page.documentElement.classList.contains('page-zoomed'),false);
 const a=f.touch(),b=f.touch(2);f.send('touchstart',[a],[a]);assert.equal(f.send('touchstart',[b],[a,b]),true);
}));
test('inert menu taps get legacy fallback while native form taps and unowned desktop gestures stay native',()=>fixture(f=>{
 assert.equal(f.send('gesturestart'),false);const a=f.touch();f.send('touchstart',[a],[a]);f.send('touchend',[a],[]);
 const b=f.touch(2);f.send('touchstart',[b],[b]);assert.equal(f.send('touchend',[b],[]),true);
 for(const id of[3,4]){const n=f.touch(id,f.native);f.send('touchstart',[n],[n]);assert.equal(f.send('touchend',[n],[]),false);}
}));

test('a hidden page releases old browser owners without clearing them on ordinary pause',()=>fixture(f=>{
 const a=f.touch();f.send('touchstart',[a],[a]);f.pause();assert.equal(f.send('gesturechange'),true);
 f.page.hidden=true;f.page.dispatchEvent(new Event('visibilitychange'));f.page.hidden=false;
 assert.equal(f.send('gesturechange'),false);
}));
