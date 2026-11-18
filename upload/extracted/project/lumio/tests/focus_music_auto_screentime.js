const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const url='file:///home/claude/lumio/lumio.html';
const boot=async(b,opts={})=>{const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);p._errs=[];p.on('pageerror',e=>p._errs.push(e.message));
 if(opts.mock)await p.addInitScript(()=>{window.__n=[];window.__audio={buf:0,osc:0,stop:0};window.Notification=function(t,o){window.__n.push(t)};Notification.permission='granted';Notification.requestPermission=async()=> 'granted';
  window.AudioContext=function(){this.sampleRate=8000;this.state='running';this.destination={};this.resume=()=>{};const node=()=>({connect(){},disconnect(){},start(){},stop(){window.__audio.stop++},gain:{value:0},frequency:{value:0}});this.createGain=()=>node();this.createBufferSource=()=>{window.__audio.buf++;return Object.assign(node(),{})};this.createBiquadFilter=()=>node();this.createOscillator=()=>{window.__audio.osc++;return node()};this.createBuffer=(c,l)=>({getChannelData:()=>new Float32Array(l)})}});
 await p.clock.install({time:new Date(2026,9,30,10,0,0)});await p.goto(url);await p.clock.runFor(300);
 await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.clock.runFor(300);return p};
const T=async p=>(await p.locator('#root').innerText()).replace(/\n+/g,' | ');
const st=(p,e)=>p.evaluate(e);
(async()=>{const b=await chromium.launch();
let p=await boot(b,{mock:1});
await p.locator('#fpill').click();await p.clock.runFor(100);
await p.locator('#fo-note').check();await p.locator('#fo-music').selectOption('brown');await p.clock.runFor(100);
await p.locator('[data-fo="start"]').click();await p.clock.runFor(1200);
console.log('A music started (buffer sources):',await st(p,"window.__audio.buf"),'| volume saved',await st(p,"FO().vol"));
await p.clock.fastForward('25:05');await p.clock.runFor(1500);
console.log('B notification on completion:',await st(p,"window.__n.join(',')"),'| music stopped:',(await st(p,"window.__audio.stop"))>0);
await p.locator('[data-act="closec"]').click().catch(()=>{});
await p.clock.fastForward('05:05');await p.clock.runFor(1500);
console.log('C break over -> idle:',await st(p,"FO().run===null"),'| msg:',(await T(p)).match(/Break over[^|]*/)?.[0],'| notifications:',await st(p,"window.__n.join(',')"));
await p.locator('#fo-music').selectOption('tones');await p.locator('[data-fo="start"]').click();await p.clock.runFor(1200);console.log('D tones oscillators:',await st(p,"window.__audio.osc"));
await p.locator('[data-fo="end"]').click();await p.clock.runFor(200);
console.log('E 7 xp blocks cap: simulate 5 blocks -> xp gains',await (async()=>{await st(p,"FO().log[today()].xpb=4;S.xp=100");await p.locator('[data-fo="start"]').click();await p.clock.fastForward('25:05');await p.clock.runFor(1500);return st(p,"S.xp")})(),'(expect 100, capped)');
console.log('errs',p._errs);await p.close();
// visibility away
p=await boot(b,{mock:1});await p.locator('#fpill').click();await p.clock.runFor(100);await p.locator('[data-fo="start"]').click();await p.clock.runFor(1200);
await p.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'))");
await p.clock.runFor(40000);
await p.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'))");await p.clock.runFor(300);
console.log('F away detected:',(await T(p)).match(/You were away[^|]*/)?.[0],'| left count',await st(p,"FO().run.left"));
await p.close();
// auto focus at timetable slot
p=await boot(b,{mock:1});
await p.evaluate("S.plan.st='10:02';S.plan.len=30;S.plan.n=2;FO().auto=true;save();render()");
await p.clock.runFor(60000);console.log('G before slot: run',await st(p,"FO().run"));
await p.clock.runFor(70000);console.log('H at slot start: run',await st(p,"JSON.stringify(FO().run&&{k:FO().run.kind,src:FO().run.src,mins:FO().run.mins})"));
await p.close();
// auto focus must not start when opened late
p=await boot(b,{mock:1});
await p.evaluate("S.plan.st='09:00';S.plan.len=30;S.plan.n=2;FO().auto=true;save();render()");await p.clock.runFor(5000);console.log('I opened late (no auto start):',await st(p,"FO().run===null"));
await p.close();
// screen time + cap
p=await boot(b,{mock:1});await p.evaluate("FO().cap=1;save()");await p.clock.runFor(65000);
console.log('J screen time seconds today:',await st(p,"FO().st[today()]"),'| rest modal:',/Time for a rest/.test(await T(p)));
await p.locator('[data-act="closec"]').click().catch(()=>{});await p.clock.runFor(5000);console.log('K modal not repeated:',!/Time for a rest/.test(await T(p)));
await p.locator('#fpill').click();await p.clock.runFor(100);console.log('L analytics card:',/Today: \d+ min in Lumio/.test(await T(p)),'| bars svg:',await p.locator('svg[aria-label*="last 7 days"] rect').count());
console.log('errs',p._errs);await p.close();
await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n').slice(0,3).join(' / ')));
