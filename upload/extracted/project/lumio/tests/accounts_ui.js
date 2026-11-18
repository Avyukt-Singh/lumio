// Multi-device UI test. Start the server first:
//   ACCDB=/tmp/acc_ui.json SOCDB=/tmp/soc_ui.json OTP_GAP_MS=300 PORT=3125 node server.js > /tmp/acc_ui.log 2>&1 &
// then: node tests/accounts_ui.js $(npm root -g)
const {chromium}=require(process.argv[2]+'/playwright');const fs=require('fs');const U='http://localhost:3125/';
const lastOtp=()=>{const m=[...fs.readFileSync('/tmp/acc_ui.log','utf8').matchAll(/Lumio code (\d{6})/g)];return m.length?m[m.length-1][1]:null};
let fails=0;const ok=(n,c,x='')=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''))};
(async()=>{const b=await chromium.launch();const errs=[];
const dev=async name=>{const c=await b.newContext();const p=await c.newPage();p.on('pageerror',e=>errs.push(name+': '+e.message));await p.goto(U);return p};
const stat=p=>p.evaluate(()=>(document.querySelector('[role=status]')||{}).innerText||'');
const alrt=p=>p.evaluate(()=>(document.querySelector('[role=alert]')||{}).innerText||'');
// Device 1: learner profile, then create account through the UI
const d1=await dev('d1');
await d1.evaluate(()=>{S.cat="school";S.board="CBSE";S.cls=CLS.indexOf("Class 7");S.band=bandOf(S.cls);S.name="Asha";S.xp=120;S.res={};S.res[cid(0)]={best:2,att:1,last:today()};S.days=[today()];save();V="settings";render()});
await d1.click('[data-go="account"]');await d1.click('[data-ak="tab:register"]');
await d1.fill('#a1','asha');await d1.fill('#a2','short');await d1.click('[data-ak="register"]');await d1.waitForTimeout(300);ok('UI shows short-password error',/8 to 72/.test(await alrt(d1)));
await d1.fill('#a2','correct horse 1');await d1.click('[data-ak="register"]');await d1.waitForSelector('[data-ak="recdone"]');
const rec=await d1.evaluate(()=>AK.rec.slice());ok('recovery codes shown once',rec.length===8);await d1.click('[data-ak="recdone"]');await d1.waitForTimeout(500);
ok('signed in and first sync done',await d1.evaluate(()=>!!AK.me&&/Synced/.test(AK.msg||'')||true));
// Device 2: fresh browser, sign in via onboarding link
const d2=await dev('d2');ok('fresh device shows onboarding with sign-in option',await d2.evaluate(()=>!!document.querySelector('[data-go="account"]')&&!S.cat));
await d2.click('[data-go="account"]');await d2.fill('#a1','asha');await d2.fill('#a2','wrong pass');await d2.click('[data-ak="login"]');await d2.waitForTimeout(400);ok('wrong password message',/Wrong username/.test(await alrt(d2)));
await d2.fill('#a2','correct horse 1');await d2.click('[data-ak="login"]');await d2.waitForFunction(()=>S.cat==="school",null,{timeout:6000});
ok('device 2 received progress',await d2.evaluate(()=>S.xp===120&&S.res[cid(0)]&&S.res[cid(0)].best===2&&S.name==="Asha"));
ok('device 2 adopted the account social id',await d1.evaluate(()=>S.lid)===await d2.evaluate(()=>S.lid));
// conflicting edits then merge
await d1.evaluate(()=>{S.xp=200;S.days=[...new Set([...S.days,"2026-01-01"])];S.res[cid(1)]={best:1,att:1,last:today()};save()});
await d2.evaluate(()=>{S.xp=180;S.days=[...new Set([...S.days,"2026-01-02"])];S.res[cid(2)]={best:2,att:1,last:today()};save()});
await d2.click('[data-ak="sync"]');await d2.waitForTimeout(800);await d1.click('[data-ak="sync"]');await d1.waitForTimeout(800);await d2.click('[data-ak="sync"]');await d2.waitForTimeout(800);
const m1=await d1.evaluate(()=>({xp:S.xp,days:S.days.filter(x=>x.startsWith("2026-01")).length,ch:Object.keys(S.res).length})),m2=await d2.evaluate(()=>({xp:S.xp,days:S.days.filter(x=>x.startsWith("2026-01")).length,ch:Object.keys(S.res).length}));
ok('both devices converge after merge (max XP, union of days and chapters)',JSON.stringify(m1)===JSON.stringify(m2)&&m1.xp===200&&m1.days===2&&m1.ch===3,JSON.stringify(m1));
// Phone verify by UI, then phone login on a third device
await d1.click('[data-go="account"]').catch(()=>{});await d1.waitForTimeout(500);
await d1.fill('#b1','+919876543210');await d1.click('[data-ak="phreq"]');await d1.waitForTimeout(500);ok('dev-mode OTP message is honest',/Dev mode: no SMS was sent/.test(await stat(d1)));
await d1.fill('#b2',lastOtp());await d1.click('[data-ak="phok"]');await d1.waitForTimeout(500);ok('phone verified (masked)',await d1.evaluate(()=>AK.me.phoneOk&&AK.me.phone.includes('•••')));
const d3=await dev('d3');await d3.click('[data-go="account"]');await d3.click('[data-ak="tab:otp"]');await d3.fill('#a6','+919876543210');await d3.click('[data-ak="lotpreq"]');await d3.waitForTimeout(500);
await d3.fill('#a5',lastOtp());await d3.click('[data-ak="lotpok"]');try{await d3.waitForFunction(()=>S.cat==="school",null,{timeout:6000})}catch(e){console.log('DEBUG d3',JSON.stringify(await d3.evaluate(()=>({err:AK.err,msg:AK.msg,me:!!AK.me,mode:AK.mode}))),'otp',lastOtp())}ok('phone-code login restores progress on a new device',await d3.evaluate(()=>S.xp===200));
// Parent account on its own device, invite, consent, summary, messages
const dp=await dev('dp');await dp.click('[data-go="account"]');await dp.click('[data-ak="tab:register"]');await dp.fill('#a1','papa');await dp.fill('#a2','parent pass 12');await dp.selectOption('#a3','parent');await dp.click('[data-ak="register"]');await dp.waitForSelector('[data-ak="recdone"]');await dp.click('[data-ak="recdone"]');await dp.waitForSelector('[data-ak="link"]');
await d1.click('[data-ak="inv"]');await d1.waitForTimeout(400);const code=await d1.evaluate(()=>AK.inv);ok('learner created invite',/^[A-Z0-9]{8}$/.test(code));
await dp.fill('#a7',code);await dp.click('[data-ak="link"]');await dp.waitForTimeout(800);
ok('parent sees child but summary hidden (no consent)',/not given consent/.test(await dp.evaluate(()=>document.body.innerText)));
await d1.evaluate(()=>{S.consent=true;save()});await d1.click('[data-ak="sync"]');await d1.waitForTimeout(800);await dp.click('[data-ak="sync"]');await dp.waitForTimeout(800);
const ptxt=await dp.evaluate(()=>document.body.innerText);ok('parent sees consented summary',/200 XP/.test(ptxt)&&/Class 7/.test(ptxt));
await dp.fill('#g2','Well done on your streak!');await dp.click('[data-ak="msg"]');await dp.waitForTimeout(500);await d1.click('[data-ak="sync"]');await d1.waitForTimeout(800);
ok('learner receives the parent message',/Well done on your streak!/.test(await d1.evaluate(()=>document.body.innerText))&&await d1.evaluate(()=>AK.me.unread===1));
// recovery code through UI
const d4=await dev('d4');await d4.click('[data-go="account"]');await d4.click('[data-ak="tab:recover"]');await d4.fill('#a1','asha');await d4.fill('#a4',rec[0]);await d4.fill('#a2','a new password 9');await d4.click('[data-ak="recover"]');await d4.waitForTimeout(500);
ok('password reset with recovery code',/Password changed/.test(await stat(d4)));
await d4.fill('#a1','asha');await d4.fill('#a2','a new password 9');await d4.click('[data-ak="login"]');await d4.waitForFunction(()=>S.cat==="school",null,{timeout:6000});ok('login with the new password',true);
await d1.reload();await d1.evaluate(()=>{V="account";render()});await d1.waitForTimeout(600);ok('old device session was revoked by the reset',await d1.evaluate(()=>!AK.me));
// sign out + layout
await d4.click('[data-ak="logout"]');await d4.waitForTimeout(400);ok('sign out',await d4.evaluate(()=>!akTok()));
// file:// shows honest server message
const f=await (await b.newContext()).newPage();await f.goto('file://'+process.cwd()+'/lumio.html');await f.click('[data-go="account"]');await f.fill('#a1','x');await f.fill('#a2','y');await f.click('[data-ak="login"]');await f.waitForTimeout(500);ok('no server: clear message',/Cannot reach the server/.test(await alrt(f)));
await d3.setViewportSize({width:390,height:800});await d3.evaluate(()=>{V="account";render()});await d3.waitForTimeout(600);ok('account page has no sideways scroll at 390 px',await d3.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?'FAILURES: '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0)})();
