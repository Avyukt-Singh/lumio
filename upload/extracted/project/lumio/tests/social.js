const {chromium}=require(process.argv[2]+'/playwright');
const U='http://localhost:3123/';
(async()=>{const b=await chromium.launch();const errs=[];
const mk=async(name,cls,xp)=>{const c=await b.newContext();const p=await c.newPage();p.on('pageerror',e=>errs.push(name+': '+e.message));await p.goto(U);
 await p.evaluate(([n,cl,x])=>{S.cat="school";S.board="CBSE";S.cls=CLS.indexOf(cl);S.band=bandOf(S.cls);S.name=n;S.dn=n;S.xp=x;S.res={};S.mis={};
  const d=[];for(let k=6;k>=0;k--){const t=new Date();t.setDate(t.getDate()-k);d.push(t.toLocaleDateString("en-CA"))}S.days=d;save();V="board";render()},[name,cls,xp]);return p};
const go=async p=>{await p.click('[data-go="social"]');await p.waitForSelector('main h1:has-text("Friends")');await p.waitForFunction(()=>SC.st||SC.err,null,{timeout:5000})};
const text=p=>p.evaluate(()=>document.querySelector('main').innerText);
const A=await mk('Asha','Class 7',100),B2=await mk('Ben','Class 7',50),C=await mk('Chen','Class 10',10);
await go(A);await go(B2);await go(C);
const codeA=await A.evaluate(()=>SC.st.me.code),codeB=await B2.evaluate(()=>SC.st.me.code);
console.log('codes:',codeA,codeB,'| league size A (alone before B? both synced):',await A.evaluate(()=>SC.st.league.length));
// errors
const tryAdd=async(p,code)=>{await p.fill('#fc',code);await p.click('[data-soc="add"]');await p.waitForTimeout(400);return p.evaluate(()=>SC.err||SC.msg)};
console.log('bad code  ->',await tryAdd(A,'ZZZZZZ'));console.log('own code  ->',await tryAdd(A,codeA));
console.log('A adds B  ->',await tryAdd(A,codeB));console.log('dup       ->',await tryAdd(A,codeB));
await B2.click('[data-soc="refresh"]');await B2.waitForTimeout(500);console.log('B sees incoming:',await B2.evaluate(()=>SC.st.incoming.map(x=>x.name)));
await B2.click('[data-soc^="accept:"]');await B2.waitForTimeout(500);
await A.click('[data-soc="refresh"]');await A.waitForTimeout(500);
console.log('A friends:',await A.evaluate(()=>JSON.stringify(SC.st.friends.map(f=>({n:f.name,shared:f.shared,streak:f.streak})))),'| B friends:',await B2.evaluate(()=>SC.st.friends.map(f=>f.name)));
console.log('C sees none of them (not friends):',await C.evaluate(()=>SC.st.friends.length===0));
// quest: both earn XP this week, resync
await A.evaluate(()=>{S.xp+=200;save()});await B2.evaluate(()=>{S.xp+=150;save()});
await A.click('[data-soc="refresh"]');await B2.click('[data-soc="refresh"]');await A.waitForTimeout(600);await A.click('[data-soc="refresh"]');await A.waitForTimeout(600);
console.log('quest A:',await A.evaluate(()=>JSON.stringify(SC.st.quests)));console.log('quest text:',(await text(A)).includes('Quest complete'));
// feed: A unlocks achievement then syncs
await A.evaluate(()=>{S.res[cid(0)]={best:1,att:1,last:today()};save()});await A.click('[data-soc="refresh"]');await A.waitForTimeout(500);await B2.click('[data-soc="refresh"]');await B2.waitForTimeout(500);
console.log('B feed:',await B2.evaluate(()=>JSON.stringify(SC.st.feed.map(e=>e.name+' '+e.text))));
console.log('C feed empty:',await C.evaluate(()=>SC.st.feed.length));
// league
console.log('league A:',await A.evaluate(()=>JSON.stringify(SC.st.league)),'| league C:',await C.evaluate(()=>JSON.stringify(SC.st.league)));
// focus room
await A.click('[data-soc="rc"]');await A.waitForTimeout(500);const room=await A.evaluate(()=>SC.room.code);
await B2.fill('#rjc',room);await B2.click('[data-soc="rj"]');await B2.waitForTimeout(500);
await A.click('[data-soc="rs"]');await A.waitForTimeout(500);await B2.waitForTimeout(3500);
console.log('B room view:',await B2.evaluate(()=>({members:SC.room.members.map(m=>m.name+':'+m.focusing),left:rLeft(),timer:document.querySelector('#rt')?.innerText})));
console.log('B cannot start (no button):',await B2.evaluate(()=>!document.querySelector('[data-soc="rs"]')));
await B2.click('[data-soc="rl"]');await B2.waitForTimeout(300);console.log('B left, room cleared:',await B2.evaluate(()=>SC.room===null));
await C.fill('#rjc','QQQQQQ');await C.click('[data-soc="rj"]');await C.waitForTimeout(400);console.log('bad room ->',await C.evaluate(()=>SC.err));
// remove friend
await A.click('[data-soc^="remove:"]');await A.waitForTimeout(600);console.log('A friends after remove:',await A.evaluate(()=>SC.st.friends.length));
// opt-out and file:// behaviour
await C.evaluate(()=>{S.lbOut=true;save();SC.st=null;V="social";render()});await C.click('[data-soc="refresh"]');await C.waitForTimeout(400);console.log('opt-out ->',await C.evaluate(()=>SC.err));
const f=await (await b.newContext()).newPage();await f.goto('file://'+process.cwd()+'/lumio.html');await f.evaluate(()=>{S.cat="school";S.band="middle";S.dn="X";V="social";render()});await f.click('[data-soc="refresh"]');await f.waitForTimeout(800);console.log('file:// ->',await f.evaluate(()=>SC.err));
await A.setViewportSize({width:390,height:800});await A.evaluate(()=>{V="social";render()});console.log('sideways@390:',await A.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
console.log('errors:',errs.length?errs:'none');await b.close()})();
