// Browser acceptance: native Chrome multitouch, WebKit taps and separate legacy policy probes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT || '/Users/mark/sites/watch-out-below/node_modules/playwright/index.mjs');
const game = process.argv[2], engine = process.argv[3] || 'chromium', base = process.argv[4];
if(!['send-it','dad-drain','pickup-sneak','bank-it'].includes(game)||!base)throw Error('game engine base are required');
const output = join(process.cwd(),'docs/review/touch-zoom-2026-10-21',process.env.RUN_LABEL||'local');mkdirSync(output,{recursive:true});
const results=[],errors=[],observations=[],network=[];
const check=(ok,label,detail)=>{results.push({ok:!!ok,label,...(detail?{detail}:{})});console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)throw Error(label);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browser=await(engine==='webkit'?webkit.launch({headless:true}):chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--ignore-gpu-blocklist']}));
try{
 for(const viewport of [{width:390,height:844},{width:820,height:1180}]){
  const label=`${game}-${engine}-${viewport.width}x${viewport.height}`;
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:1,ignoreHTTPSErrors:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(`${label}: ${e.message}`));page.on('requestfailed',r=>network.push({url:r.url(),failure:r.failure()?.errorText}));
  await page.addInitScript(()=>{window.__zoomTools={};Object.defineProperty(document,'modelContext',{value:{registerTool:tool=>{window.__zoomTools[tool.name]=tool;}},configurable:true});});
  await page.goto(base);const tap=async selector=>{const r=await page.locator(selector).first().boundingBox();if(!r)throw Error(`Hidden ${selector}`);await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);};
  const state=()=>page.evaluate(game=>game==='bank-it'?window.bankIt.state():window.__zoomTools[game==='send-it'?'read_jump_line':game==='dad-drain'?'read_dad_drain':'read_pickup_game'].execute({}),game);
  if(game==='send-it'){await page.waitForFunction(()=>window.__zoomTools.read_jump_line);await tap('#ride-mode');}
  if(game==='dad-drain'){await page.waitForFunction(()=>!document.querySelector('#start').disabled);await tap('#start');}
  if(game==='pickup-sneak')await page.waitForFunction(()=>document.querySelector('#loading').hidden);
  if(game==='bank-it'){await page.waitForFunction(()=>window.bankIt);await tap('[data-action=freestyle]');await tap('[data-action=play-layout][data-id=bin-there]');}
  await page.waitForFunction(()=>document.body.classList.contains('game-playing'));
  const view=()=>page.evaluate(()=>({scale:visualViewport.scale,width:innerWidth,height:innerHeight,active:document.body.classList.contains('game-playing'),touchAction:getComputedStyle(document.body).touchAction}));
  const start=await view();check(start.scale===1&&start.touchAction==='none',`${label}: active play owns page gestures`,start);
  const policy=await page.evaluate(()=>{
   const target=document.querySelector('canvas');const send=(type,changed=[],touches=[])=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{changedTouches:{value:changed},touches:{value:touches}});target.dispatchEvent(event);return event.defaultPrevented;};
   const a={identifier:101,target,clientX:80,clientY:150},b={identifier:102,target,clientX:220,clientY:150};send('touchstart',[a],[a]);const multi=send('touchstart',[b],[a,b]),move=send('touchmove',[a,b],[a,b]);const gestures=['gesturestart','gesturechange','gestureend'].map(type=>send(type));const focusable=[...document.querySelectorAll('button:not([disabled])')].filter(e=>e.getClientRects().length);focusable[0].focus({preventScroll:true});focusable[1].focus({preventScroll:true});const descendantBlurOwned=send('gesturechange');send('touchcancel');const desktop=send('gesturestart');const wheel=new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true,deltaY:-10});window.dispatchEvent(wheel);return{multi,move,gestures,descendantBlurOwned,desktop,wheel:wheel.defaultPrevented};
  });
  check(policy.multi&&policy.move&&policy.gestures.every(Boolean),`${label}: legacy pinch/gesture policy cancels native zoom`,policy);
  check(policy.descendantBlurOwned,`${label}: HUD focus changes preserve gesture ownership`);
  check(!policy.desktop&&!policy.wheel,`${label}: desktop gestures are outside the page-zoom guard`);
  const repeat=game==='send-it'?'#reset':game==='dad-drain'?'[data-action=why]':game==='pickup-sneak'?'#retry':'#btn-retry';
  for(let i=0;i<8;i++){await tap(repeat);await sleep(65);}
  const rapid=await view();check(rapid.scale===1&&rapid.width===start.width&&rapid.height===start.height,`${label}: native rapid taps preserve viewport dimensions`,rapid);
  if(game==='dad-drain')check((await state()).laughs>0,`${label}: native Why taps reach gameplay`);
  let cdp;
  const menu=game==='send-it'?'#build-mode':game==='bank-it'?'#btn-menu':'#pause';
  if(engine==='chromium'){
   cdp=await context.newCDPSession(page);const send=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
   const point=async(selector,id)=>{const r=await page.locator(selector).first().boundingBox();return{id,x:r.x+r.width/2,y:r.y+r.height/2};};
   const heldSelector=game==='send-it'?'[data-control=pedal]':game==='pickup-sneak'?'#joystick-zone':game==='dad-drain'?'[data-action=why]':'canvas';
   const beforeHeld=await state();let a=await point(heldSelector,1);await send('touchStart',[a]);
   if(game==='pickup-sneak'||game==='bank-it'){a={...a,x:a.x-18,y:a.y+8};await send('touchMove',[a]);}
   if(game==='pickup-sneak'){await sleep(120);const moved=await state();check(await page.locator('#stick').evaluate(e=>e.style.transform!==''),`${label}: held native joystick moves its knob`);check(moved.player.x!==beforeHeld.player.x||moved.player.z!==beforeHeld.player.z,`${label}: held native joystick moves the child`);}
   if(game==='bank-it')check(JSON.stringify((await state()).aim)!==JSON.stringify(beforeHeld.aim),`${label}: held native drag changes aim`);
   if(game==='send-it'){
    const b=await point('[data-control=brake]',2);await send('touchStart',[a,b]);check(await page.locator('[data-control=pedal]').evaluate(e=>e.classList.contains('held'))&&await page.locator('[data-control=brake]').evaluate(e=>e.classList.contains('held')),`${label}: simultaneous pedal/brake holds both controls`);await send('touchEnd',[b]);check(await page.locator('[data-control=pedal]').evaluate(e=>e.classList.contains('held')),`${label}: releasing second finger preserves first control`);
   }
   const pause=await point(menu,3);await send('touchStart',[a,pause]);await send('touchEnd');
   await page.waitForFunction(()=>!document.body.classList.contains('game-playing'));
   check(!(await view()).active,`${label}: second-finger menu/pause works while a game finger is held`);
   if(game==='pickup-sneak')check(await page.locator('#stick').evaluate(e=>e.style.transform===''),`${label}: pause releases joystick`);
   if(game==='send-it')check(await page.locator('[data-control].held').count()===0,`${label}: return to Build clears held controls`);
   if(game==='bank-it')check((await state()).phase==='ready'&&JSON.stringify((await state()).aim)===JSON.stringify(beforeHeld.aim),`${label}: menu cancels drag and restores aim without firing`);
  }else{await tap(menu);await page.waitForFunction(()=>!document.body.classList.contains('game-playing'));check(!(await view()).active,`${label}: native menu/Pause remains usable`);}
  check((await view()).touchAction==='auto',`${label}: menus restore ordinary page gestures`);
  const menuPolicy=await page.evaluate(()=>{const target=document.querySelector('body');const e=new Event('gesturestart',{bubbles:true,cancelable:true});target.dispatchEvent(e);return e.defaultPrevented;});check(!menuPolicy,`${label}: menu legacy gestures are not cancelled`);
  if(game==='send-it'){await tap('#ride-mode');}else if(game==='bank-it'){await tap('[data-action=close]');}else{await tap('#resume');}
  await page.waitForFunction(()=>document.body.classList.contains('game-playing'));
  if(engine==='chromium'){
   const send=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
   const a={id:7,x:viewport.width*.42,y:viewport.height*.45},b={id:8,x:viewport.width*.58,y:viewport.height*.45};
   await send('touchStart',[a]);await send('touchStart',[a,b]);for(let i=1;i<=7;i++){await send('touchMove',[{...a,x:a.x-i*6},{...b,x:b.x+i*6}]);await sleep(15);}await send('touchCancel');
   const pinched=await view();check(pinched.scale===1&&pinched.width===start.width&&pinched.height===start.height,`${label}: real two-finger pinch leaves scale and controls intact`,pinched);
   if(game==='bank-it')check((await state()).phase==='ready',`${label}: touchcancel never fires the drag shot`);
   if(game==='pickup-sneak')check(await page.locator('#stick').evaluate(e=>e.style.transform===''),`${label}: cancellation leaves no held joystick`);
   if(game==='send-it'){const r=await page.locator('[data-control=pedal]').boundingBox();await send('touchStart',[{id:10,x:r.x+r.width/2,y:r.y+r.height/2}]);await send('touchCancel');check(await page.locator('[data-control].held').count()===0,`${label}: native cancellation clears held riding controls`);}
  }
  // One real drag release proves that the zoom guard does not swallow aiming input.
  if(game==='bank-it'&&engine==='chromium'){
   const p=await page.evaluate(()=>{const p=window.bankIt.launch();return window.bankIt.toScreen(p.x,p.y);});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:9,x:p.x,y:p.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:9,x:p.x-50,y:p.y+50}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});check((await state()).phase==='flying',`${label}: real single-finger drag release still shoots`);await tap('#btn-retry');
  }
  const selector=game==='send-it'?'#ride-controls button,#build-mode,#reset':game==='dad-drain'?'[data-action],#pause,#sound':game==='pickup-sneak'?'#joystick-zone,#retry,#pause,#sound,[data-level]':'#hud button';
  const bounds=await page.locator(selector).evaluateAll(elements=>elements.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.dataset.action||e.dataset.control,x:r.x,y:r.y,right:r.right,bottom:r.bottom,reachable:r.width>0&&r.height>0&&r.x>=-1&&r.y>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};}));
  check(bounds.every(e=>e.reachable),`${label}: game controls stay within the viewport`,bounds);
  await page.screenshot({path:join(output,`${engine}-${viewport.width}x${viewport.height}.png`)});
  observations.push({label,viewport,start,final:await view(),state:await state(),bounds,nativeMultitouch:engine==='chromium',physicalDevice:false});
  await context.close();
 }
 check(errors.length===0,`${game}-${engine}: no page exceptions`,errors);
}catch(error){results.push({ok:false,label:'verification completes',detail:String(error.stack||error)});console.log(String(error.stack||error));process.exitCode=1;}
finally{writeFileSync(join(output,`${engine}-results.json`),JSON.stringify({date:new Date().toISOString(),game,engine,browser:browser.version(),base,results,observations,errors,network},null,2)+'\n');await browser.close();}
console.log(`${results.filter(r=>r.ok).length}/${results.length} checks passed`);
