const {chromium}=require(process.argv[2]+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/lumio.html');
await p.evaluate(()=>{S.cat="school";S.board="CBSE";S.cls=CLS.indexOf("Class 8");S.band=bandOf(S.cls);S.name="T";S.res={};save();V="study";render()});
console.log('no cards yet:',await p.evaluate(()=>document.querySelector('main').innerText.includes('Complete a chapter quiz first')));
await p.evaluate(()=>{const n=B().ch[0][3].length;S.res[cid(0)]={best:n,att:1,last:today()};S.res[cid(1)]={best:1,att:1,last:today()};save();render()});
const info=await p.evaluate(()=>({all:fcAll().length,due:fcDue().length}));console.log('cards/due:',JSON.stringify(info));
await p.click('[data-fc="start"]');
let steps=0;const log=[];
while(await p.evaluate(()=>FS&&!FS.done)){
 await p.click('[data-fc="show"]');
 const first=await p.evaluate(()=>FS.i===0);
 await p.click(first?'[data-fc="n"]':'[data-fc="k"]');steps++;if(steps>40)break}
const fin=await p.evaluate(()=>({k:FS.k,n:FS.n,xp:FS.xp,total:S.xp,fc:Object.values(S.fc).map(r=>r.b+'@'+r.d)}));
console.log('session:',JSON.stringify(fin),'| steps',steps);
console.log('today',await p.evaluate(()=>today()),'| +1',await p.evaluate(()=>addDays(1)));
console.log('due after:',await p.evaluate(()=>fcDue().length),'(missed card re-queued once then known => 0 expected if retried ok)');
await p.reload();console.log('persisted after reload:',await p.evaluate(()=>Object.keys(S.fc).length));
// second session same day should not give XP again, and intervals advance
await p.evaluate(()=>{for(const k in S.fc)S.fc[k].d=today();save();V="study";render()});
await p.click('[data-fc="start"]');while(await p.evaluate(()=>FS&&!FS.done)){await p.click('[data-fc="show"]');await p.click('[data-fc="k"]')}
console.log('2nd session xp:',await p.evaluate(()=>FS.xp),'| boxes:',await p.evaluate(()=>JSON.stringify(Object.values(S.fc).map(r=>r.b+'@'+r.d))));
await p.evaluate(()=>{V="home";render()});console.log('home card:',await p.evaluate(()=>/Flashcards due/.test(document.querySelector('main').innerText)));
await p.setViewportSize({width:390,height:800});await p.evaluate(()=>{V="study";render()});console.log('sideways@390:',await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'| errors',errs.length?errs:'none');
await b.close()})();
