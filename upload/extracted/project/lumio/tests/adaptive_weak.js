const {chromium}=require(process.argv[2]+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/lumio.html');
await p.evaluate(()=>{S.cat="school";S.board="CBSE";S.cls=CLS.indexOf("Class 8");S.band=bandOf(S.cls);S.name="T";S.res={};S.wrong={};S.qs={};S.fc={};S.mis={};S.xp=0;save();V="study";render()});
console.log('empty hub:',await p.evaluate(()=>document.querySelector('main').innerText.includes('Complete a chapter quiz first')));
await p.evaluate(()=>{const ch=B().ch;S.res[cid(0)]={best:ch[0][3].length,att:1,last:today()};S.res[cid(1)]={best:1,att:1,last:today()};S.res[cid(2)]={best:0,att:1,last:today()};S.wrong[cid(1)+ch[1][3][0].t]=1;save();render()});
console.log('ranking (chapter idx:weight):',await p.evaluate(()=>JSON.stringify(weakRank().map(x=>x.i+':'+x.w+' '+x.why.join('/')))));
await p.click('[data-wk="weak"]');
const lv=[];let n=0;
while(await p.evaluate(()=>AP&&!AP.done)){
 const want=n%3!==2; // right,right,wrong pattern
 const k=await p.evaluate(w=>{const m=AP.cur.m;return w?m.a:(m.a+1)%m.o.length},want);
 await p.click('[data-ap="p'+k+'"]');lv.push(await p.evaluate(()=>+AP.lv.toFixed(2)));await p.click('[data-ap="next"]');n++;if(n>12)break}
const r=await p.evaluate(()=>({hist:AP.hist.length,uniq:new Set(AP.hist.map(h=>h.t)).size,lv0:AP.lv0,lv:+AP.lv.toFixed(2),xp:AP.xp,total:S.xp,qs:Object.keys(S.qs).length,wrong:Object.keys(S.wrong).length}));
console.log('levels after each answer:',lv.join(' '));console.log('result:',JSON.stringify(r));
await p.click('[data-ap="again"]');while(await p.evaluate(()=>AP&&!AP.done)){await p.click('[data-ap="p0"]');await p.click('[data-ap="next"]')}
console.log('2nd run xp (should be 0):',await p.evaluate(()=>AP.xp),'| S.xp',await p.evaluate(()=>S.xp));
await p.reload();console.log('S.qs persisted:',await p.evaluate(()=>Object.keys(S.qs).length));
await p.setViewportSize({width:390,height:800});await p.evaluate(()=>{V="study";render()});console.log('sideways@390:',await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'| errors',errs.length?errs:'none');
await b.close()})();
