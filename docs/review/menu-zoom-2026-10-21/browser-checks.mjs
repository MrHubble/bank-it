// Native viewport/input acceptance, with synthetic legacy policy probes labelled separately.
// Result scenes use real game simulation with an accelerated browser clock; no timing claims.
import {mkdirSync,writeFileSync,readFileSync,existsSync,statSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {createServer} from 'node:http';
const {chromium,webkit}=await import('/Users/mark/sites/watch-out-below/node_modules/playwright/index.mjs');
const [game,engine='chromium',url]=process.argv.slice(2);
if(!['send-it','dad-drain','pickup-sneak','bank-it'].includes(game))throw Error('game engine [url] required');
const root=resolve(process.cwd(),'dist');
let server,base=url;
if(!base){server=createServer((req,res)=>{let p=join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));if(existsSync(p)&&statSync(p).isDirectory())p=join(p,'index.html');if(!existsSync(p)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(p)]||'application/octet-stream'));res.end(readFileSync(p));});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}/`;}
const output=join(process.cwd(),'docs/review/menu-zoom-2026-10-21',process.env.RUN_LABEL||'local');mkdirSync(output,{recursive:true});
const results=[],observations=[],errors=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const check=(ok,label,detail)=>{results.push({ok:!!ok,label,...(detail!==undefined?{detail}:{})});console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)throw Error(label);};
const browser=await(engine==='webkit'?webkit.launch({headless:true}):chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--ignore-gpu-blocklist']}));
try{
 for(const viewport of [{width:390,height:844},{width:820,height:1180}]){
  const label=`${game}/${engine}/${viewport.width}`,context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:1,ignoreHTTPSErrors:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(`${label}: ${e.message}`));
  await page.addInitScript(()=>{window.__zoomTools={};Object.defineProperty(document,'modelContext',{value:{registerTool:t=>window.__zoomTools[t.name]=t},configurable:true});window.__touchTrace=[];for(const type of ['touchstart','touchmove','touchend','touchcancel'])document.addEventListener(type,e=>window.__touchTrace.push({type,ids:[...e.touches].map(t=>t.identifier)}),true);});
  await page.clock.install();await page.goto(base);
  const state=()=>page.evaluate(g=>g==='bank-it'?window.bankIt.state():window.__zoomTools[g==='send-it'?'read_jump_line':g==='dad-drain'?'read_dad_drain':'read_pickup_game'].execute({}),game);
  const tap=async selector=>{await page.locator(selector).first().scrollIntoViewIfNeeded();const b=await page.locator(selector).first().boundingBox();if(!b)throw Error(`Hidden ${selector}`);await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);await sleep(80);};
  const view=()=>page.evaluate(()=>({scale:visualViewport.scale,touchAction:getComputedStyle(document.body).touchAction,active:document.body.classList.contains('game-playing'),enlarged:document.documentElement.classList.contains('page-zoomed'),width:innerWidth,height:innerHeight}));
  const cdp=engine==='chromium'?await context.newCDPSession(page):null;
  const pinch=async phase=>{if(!cdp)return;const v=await page.evaluate(()=>({w:visualViewport.width,h:visualViewport.height}));await cdp.send('Input.synthesizePinchGesture',{x:v.w*.5,y:v.h*.45,scaleFactor:1.8,relativeSpeed:100,gestureSourceType:'touch'});await sleep(120);check(Math.abs((await view()).scale-1)<.001,`${label}: native ${phase} pinch keeps page scale 1`,await view());};
  if(game==='send-it')await page.waitForFunction(()=>window.__zoomTools.read_jump_line);
  if(game==='dad-drain')await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  if(game==='pickup-sneak')await page.waitForFunction(()=>document.querySelector('#loading').hidden);
  if(game==='bank-it')await page.waitForFunction(()=>window.bankIt);
  if(game==='send-it'){
   const input=page.locator('#height');const before=await input.inputValue();await input.focus();await page.keyboard.press('ArrowRight');check((await input.inputValue())!==before,`${label}: native editor range still accepts keyboard input`);
  }
  if(game==='bank-it'){
   await tap('[data-action=challenges]');
   if(cdp&&viewport.width===390){
    const pane=await page.locator('.ch-list').boundingBox();const before=await page.locator('.ch-list').evaluate(e=>e.scrollTop);
    await cdp.send('Input.synthesizeScrollGesture',{x:pane.x+pane.width*.5,y:pane.y+pane.height*.7,yDistance:-280,gestureSourceType:'touch'});await sleep(160);
    const after=await page.locator('.ch-list').evaluate(e=>e.scrollTop);check(after>before&&(await state()).overlay==='challenges',`${label}: native challenge-menu swipe scrolls without selecting a row`,{before,after});
   }
   await tap('[data-action=back]');
  }
  if(game!=='pickup-sneak'){check((await view()).touchAction==='pan-y',`${label}: initial menu keeps vertical scroll policy`);await pinch('intro/build');}
  if(game==='dad-drain'&&cdp){
   const a={id:31,x:15,y:100},r=await page.locator('#start').boundingBox(),b={id:32,x:r.x+r.width/2,y:r.y+r.height/2};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a,b]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[b]});
   await page.waitForFunction(()=>document.body.classList.contains('game-playing'));
   const owned=await page.evaluate(()=>{const e=new Event('gesturechange',{cancelable:true,bubbles:true});document.body.dispatchEvent(e);return e.defaultPrevented&&window.__touchTrace.at(-1).ids.length===1;});
   check(owned,`${label}: held first finger survives actual Start reset`);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  const enter=async()=>{if(game==='send-it')await tap('#ride-mode');if(game==='dad-drain'&&!(await view()).active)await tap('#start');if(game==='bank-it'){await tap('[data-action=freestyle]');await tap('[data-action=play-layout][data-id=bin-there]');}await page.waitForFunction(()=>document.body.classList.contains('game-playing'));};
  await enter();check((await view()).touchAction==='none',`${label}: active play protects page gestures`);await pinch('active-play');
  const policy=await page.evaluate(()=>{const target=document.querySelector('canvas'),a={identifier:100,target,clientX:40,clientY:100},b={identifier:101,target,clientX:120,clientY:100};const send=(type,c=[],t=[])=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{changedTouches:{value:c},touches:{value:t}});target.dispatchEvent(e);return e.defaultPrevented;};send('touchstart',[a],[a]);const second=send('touchstart',[b],[a,b]);const move=send('touchmove',[a,b],[a,b]);const owned=send('gesturechange');send('touchcancel');const desktop=send('gesturestart');const wheel=new WheelEvent('wheel',{bubbles:true,cancelable:true,ctrlKey:true});window.dispatchEvent(wheel);return{second,move,owned,desktop,wheel:wheel.defaultPrevented};});
  check(policy.second&&policy.move&&policy.owned&&!policy.desktop&&!policy.wheel,`${label}: separate synthetic legacy ownership policy`,policy);
  const menu=game==='send-it'?'#build-mode':game==='bank-it'?'#btn-menu':'#pause';
  const resume=game==='send-it'?'#ride-mode':game==='bank-it'?'[data-action=close]':'#resume';
  if(cdp){
   const send=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
   const point=async(sel,id)=>{const r=await page.locator(sel).first().boundingBox();return{id,x:r.x+r.width/2,y:r.y+r.height/2};};
   const first=await point(game==='send-it'?'[data-control=pedal]':game==='dad-drain'?'[data-action=why]':game==='pickup-sneak'?'#joystick-zone':'canvas',11);
   await send('touchStart',[first]);
   if(game!=='dad-drain'){
    const reset=await point(game==='send-it'?'#reset':game==='pickup-sneak'?'#retry':'#btn-retry',14);
    await send('touchStart',[first,reset]);await send('touchEnd',[reset]);
    const kept=await page.evaluate(()=>{const e=new Event('gesturechange',{cancelable:true,bubbles:true});document.body.dispatchEvent(e);return e.defaultPrevented&&window.__touchTrace.at(-1).ids.length===1;});
    check(kept,`${label}: actual Reset retains held-finger browser ownership`);
   }
   const pause=await point(menu,12);await send('touchStart',[first,pause]);await send('touchEnd',[pause]);
   await page.waitForFunction(()=>!document.body.classList.contains('game-playing'));
   const trace=await page.evaluate(()=>window.__touchTrace.at(-1));check(trace.type==='touchend'&&trace.ids.length===1,`${label}: actual first touch remains held through menu transition`,trace);
   const retained=await page.evaluate(()=>{const e=new Event('gesturechange',{bubbles:true,cancelable:true});document.body.dispatchEvent(e);return e.defaultPrevented;});check(retained,`${label}: menu transition retains browser gesture ownership`);
   check((await view()).touchAction==='pan-y',`${label}: paused/build menu has vertical scroll policy`);
   // Release only the newly listed button, retaining the first finger through Resume too.
   const back=await point(resume,13);await send('touchStart',[first,back]);await send('touchEnd',[back]);await page.waitForFunction(()=>document.body.classList.contains('game-playing'));await send('touchMove',[{...first,x:first.x+1}]);const current=await page.evaluate(()=>window.__touchTrace.at(-1));check(current.type==='touchmove'&&current.ids.length===1,`${label}: current post-Resume move contains only the held first finger`,current);await send('touchEnd');
   check((await view()).active,`${label}: second-finger Resume/ride remains pointer-safe`);
  }else{await tap(menu);check(!(await view()).active&&(await view()).touchAction==='pan-y',`${label}: trusted native Pause/build tap works`);await tap(resume);}
  const retry=game==='send-it'?'#reset':game==='dad-drain'?'[data-action=why]':game==='pickup-sneak'?'#retry':'#btn-retry';
  for(let i=0;i<6;i++){await tap(retry);await sleep(30);}check((await view()).scale===1,`${label}: trusted rapid controls do not zoom`);
  // Test recovery from genuinely enlarged UA state; inverse is a real native pinch.
  if(cdp){
   await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1.8});await page.waitForFunction(()=>document.documentElement.classList.contains('page-zoomed'));
   await sleep(100);const stopped=await state();
   const isPaused=s=>game==='send-it'?s.run.paused:game==='dad-drain'?s.paused:game==='pickup-sneak'?s.status==='paused':s.overlay==='pause';
   check(isPaused(stopped),`${label}: enlarged page latches simulation pause`,stopped);
   check(['manipulation','pan-x pan-y pinch-zoom'].includes((await view()).touchAction),`${label}: enlarged recovery admits native pinch on descendants`);
   const recoveryResume=game==='send-it'?'#page-zoom-resume':resume;
   await page.locator(recoveryResume).first().focus();await page.keyboard.press('Enter');check(isPaused(await state()),`${label}: enlarged Resume cannot restart play`);
   const v=await page.evaluate(()=>({w:visualViewport.width,h:visualViewport.height}));await cdp.send('Input.synthesizePinchGesture',{x:v.w*.5,y:v.h*.5,scaleFactor:.5,relativeSpeed:100,gestureSourceType:'touch'});await page.waitForFunction(()=>visualViewport.scale<=1.001);
   check(isPaused(await state())&&!(await view()).enlarged,`${label}: native inverse pinch recovers scale 1 and stays paused`);
   await tap(recoveryResume);await page.waitForFunction(()=>document.body.classList.contains('game-playing'));await pinch('recovered play');
  }
  await tap(menu);await pinch('paused/build menu');check(!(await view()).active,`${label}: ${cdp?'attempted native menu pinch cannot activate Resume':'paused menu waits for explicit Resume'}`);await tap(resume);
  // Drive a real simulation to its existing result; controlled clock is functional evidence only.
  if(game==='send-it'){await tap('#build-mode');await tap('#send');for(let i=0;i<45&&(await state()).run.status==='riding';i++)await page.clock.runFor(1000);check((await state()).mode==='cpu'&&(await state()).run.status!=='riding',`${label}: CPU physics reaches actual result`,await state());}
  if(game==='dad-drain'){for(let i=0;i<55&&(await state()).status!=='ended';i++)await page.clock.runFor(1000);check((await state()).status==='ended',`${label}: full round reaches actual result`,await state());}
  if(game==='pickup-sneak'){await tap('#retry');await page.keyboard.down('w');await page.keyboard.down('d');await page.clock.runFor(1700);await page.keyboard.up('d');await page.clock.runFor(6000);await page.keyboard.up('w');check(['caught','won'].includes((await state()).status),`${label}: actual keyboard path reaches ending`,await state());}
  if(game==='bank-it'){await tap('#btn-menu');await tap('[data-action=challenges]');await tap('[data-action=play-challenge][data-id=straight-in]');await page.evaluate(()=>{const c=window.bankIt.challenges().find(c=>c.id==='straight-in');window.bankIt.setAim(c.solution.aim);});await tap('#btn-shoot');for(let i=0;i<15&&(await state()).overlay!=='complete';i++)await page.clock.runFor(1000);check((await state()).overlay==='complete',`${label}: authored-aim fixture and actual Shoot reach physics result`,await state());}
  await page.clock.runFor(120);
  check(!(await view()).active&&(await view()).touchAction==='pan-y',`${label}: actual result restores vertical menu policy`,{view:await view(),state:await state()});
  await page.clock.resume();await pinch('actual result');
  const resultPolicy=await page.evaluate(()=>{const target=document.body,a={identifier:910,target,clientX:30,clientY:110},b={identifier:911,target,clientX:160,clientY:110};function send(type,c,t){const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{changedTouches:{value:c},touches:{value:t}});target.dispatchEvent(e);return e.defaultPrevented;}send('touchstart',[a],[a]);const blocked=send('touchstart',[b],[a,b]);send('touchcancel',[],[]);return blocked;});check(resultPolicy,`${label}: result retains separate legacy pinch policy`);
  observations.push({label,viewport,final:await view(),state:await state(),trustedTouchTrace:await page.evaluate(()=>window.__touchTrace),physicalDevice:false});
  await context.close();
 }
 // A separate desktop context proves menu actions and keyboard game input remain available.
 const ctx=await browser.newContext({viewport:{width:1280,height:900}}),p=await ctx.newPage();await p.addInitScript(()=>{window.__zoomTools={};Object.defineProperty(document,'modelContext',{value:{registerTool:t=>window.__zoomTools[t.name]=t},configurable:true});});await p.goto(base);
 if(game==='send-it'){await p.waitForFunction(()=>window.__zoomTools.read_jump_line);await p.locator('#ride-mode').click();await p.keyboard.down('w');await sleep(180);check(await p.locator('[data-control=pedal]').evaluate(e=>e.classList.contains('held')),`${game}/${engine}: desktop keyboard pedal works`);await p.keyboard.up('w');await p.locator('#build-mode').click();}
 if(game==='dad-drain'){await p.locator('#start').click();await p.locator('#pause').click();check(await p.locator('#pause-panel').isVisible(),`${game}/${engine}: desktop Pause works`);await p.locator('#resume').focus();await p.keyboard.press('Enter');}
 if(game==='pickup-sneak'){await p.waitForFunction(()=>document.querySelector('#loading').hidden);await p.keyboard.press('p');check(await p.locator('#pause-panel').isVisible(),`${game}/${engine}: desktop keyboard Pause works`);await p.locator('#resume').click();}
 if(game==='bank-it'){await p.waitForFunction(()=>window.bankIt);await p.locator('[data-action=freestyle]').click();await p.locator('[data-action=play-layout][data-id=bin-there]').focus();await p.keyboard.press('Enter');await p.locator('#btn-menu').click();check(await p.locator('[data-action=close]').isVisible(),`${game}/${engine}: desktop mouse/keyboard menus work`);}
 check(await p.evaluate(()=>visualViewport.scale===1),`${game}/${engine}: desktop scale remains 1`);await ctx.close();check(errors.length===0,`${game}/${engine}: no page exceptions`,errors);
}catch(e){results.push({ok:false,label:'acceptance completes',detail:String(e.stack||e)});console.error(e);process.exitCode=1;}
finally{writeFileSync(join(output,`${engine}-results.json`),JSON.stringify({date:new Date().toISOString(),game,engine,browser:browser.version(),base,method:'Installed Chrome native CDP touch/pinch; Playwright WebKit trusted taps plus separate synthetic legacy policy; controlled browser clock for real result simulation; DPR 1 emulation; no physical iPad or performance claim',results,observations,errors},null,2)+'\n');await browser.close();if(server)await new Promise(r=>server.close(r));}
console.log(`${results.filter(r=>r.ok).length}/${results.length} passed`);
