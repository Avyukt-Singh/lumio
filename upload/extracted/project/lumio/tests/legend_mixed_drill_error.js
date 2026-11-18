const {chromium}=require(process.argv[2]+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/lumio.html');
const setup=cls=>p.evaluate(c=>{S.cat="school";S.board="CBSE";S.cls=CLS.indexOf(c);S.band=bandOf(S.cls);S.name="T";S.res={};S.wrong={};S.qs={};S.fc={};S.mis={};S.xp=0;S.flag={};save();V="study";render()},cls);
await setup("Class 8");
await p.evaluate(()=>{for(let i=0;i<3;i++)S.res[cid(i)]={best:B().ch[i][3].length,att:1,last:today()};save();render()});
const txt=await p.evaluate(()=>document.querySelector('main').innerText);
console.log('legend unlocked button:',await p.evaluate(()=>!!document.querySelector('[data-wk="legend"]')),'| mixed button:',await p.evaluate(()=>!!document.querySelector('[data-wk="all"]')),'| tools cards:',txt.includes('Timed mock drills')&&txt.includes('Error-analysis lab'));
// legendary FAIL: answer wrong twice
await p.click('[data-wk="legend"]');let k=0;
while(await p.evaluate(()=>AP&&!AP.done)){const w=await p.evaluate(()=>(AP.cur.m.a+1)%AP.cur.m.o.length);await p.click('[data-ap="p'+w+'"]');await p.click('[data-ap="next"]');if(++k>8)break}
console.log('legend fail ->',await p.evaluate(()=>({win:AP.win,lives:AP.lives,answered:AP.hist.length,xp:S.xp,h1:document.querySelector('main h1').innerText})));
// legendary WIN
await p.click('[data-ap="again"]');k=0;
while(await p.evaluate(()=>AP&&!AP.done)){const a=await p.evaluate(()=>AP.cur.m.a);await p.click('[data-ap="p'+a+'"]');await p.click('[data-ap="next"]');if(++k>8)break}
console.log('legend win ->',await p.evaluate(()=>({win:AP.win,lives:AP.lives,answered:AP.hist.length,n:AP.n,xp:AP.xp,total:S.xp,ach:unlocked().includes('Legend')})));
// second win gives no XP
await p.click('[data-ap="again"]');while(await p.evaluate(()=>AP&&!AP.done)){const a=await p.evaluate(()=>AP.cur.m.a);await p.click('[data-ap="p'+a+'"]');await p.click('[data-ap="next"]')}
console.log('2nd legend win xp (0 expected):',await p.evaluate(()=>AP.xp));
// mixed: check no two consecutive same chapter when possible
await p.evaluate(()=>{V="study";render()});await p.click('[data-wk="all"]');const seq=[];
while(await p.evaluate(()=>AP&&!AP.done)){seq.push(await p.evaluate(()=>AP.cur.ci));const a=await p.evaluate(()=>AP.cur.m.a);await p.click('[data-ap="p'+a+'"]');await p.click('[data-ap="next"]')}
console.log('mixed chapter sequence:',seq.join(','));
// drills + error lab ported
await p.evaluate(()=>{V="drill";DR.st="idle";render()});await p.click('[data-dr="go"]');
for(let i=0;i<6;i++){const a=await p.evaluate(()=>DR.q[DR.i].a);await p.click('[data-dr="a'+a+'"]')}
await p.evaluate(()=>{drEnd();render()});console.log('drill:',await p.evaluate(()=>document.querySelector('main .card h2').innerText),'| back link goes to Study:',await p.evaluate(()=>!!document.querySelector('[data-go="study"]')));
await p.evaluate(()=>{V="err";ER.o=null;render()});
for(let r=0;r<5;r++){const [st,ty]=await p.evaluate(()=>{const it=ERI[ER.o[ER.i]];return[it[2],it[3]]});await p.click('[data-er="s'+st+'"]');await p.click('[data-er="t'+ty+'"]');await p.click('[data-er="chk"]');await p.click('[data-er="nxt"]')}
console.log('error lab:',await p.evaluate(()=>document.querySelector('main .card h2').innerText));
await p.setViewportSize({width:390,height:800});await p.evaluate(()=>{V="study";render()});console.log('sideways@390:',await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'| errors',errs.length?errs:'none');
await b.close()})();
