const {chromium}=require(process.argv[2]+'/playwright');
(async()=>{const b=await chromium.launch();const errs=[];
async function open(cls,view){const p=await b.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+process.cwd()+'/lumio.html');
 await p.evaluate(([c,v])=>{S.cat="school";S.board="CBSE";S.cls=CLS.indexOf(c);S.band=bandOf(S.cls);S.name="T";S.mis={};S.xp=0;save();V="games";render();window.__l=document.querySelector('main').innerText;V=v;render()},[cls,view]);return p}
const status=p=>p.evaluate(()=>document.querySelector('[role=status]').innerText);
const wide=async p=>{await p.setViewportSize({width:390,height:800});return p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)};
let p=await open("Class 7","frac");
console.log('FRAC listed',await p.evaluate(()=>__l.includes('Fraction Puzzles')),'| ECO listed',await p.evaluate(()=>__l.includes('Ecosystem Builder')),'| no "Planned" block',await p.evaluate(()=>!__l.includes('Planned')));
await p.click('[data-fp="c0"]');await p.click('[data-fp="chk"]');console.log(' frac wrong:',await status(p));
for(let r=0;r<5;r++){await p.click('[data-fp="nxt"]').catch(()=>{});const need=await p.evaluate(()=>FP.t[0]*12/FP.t[1]);await p.click('[data-fp="c'+(need-1)+'"]');await p.click('[data-fp="chk"]')}
console.log(' frac after 5:',await status(p),'XP',await p.evaluate(()=>S.xp),'| sideways',await wide(p));
await p.evaluate(()=>{V="eco";EC.o=[];render()});
await p.evaluate(()=>{const c=EC.P*Math.pow(0.1,EC.L-1);window.__w=EC.o.find(v=>Math.abs(v-c)>c*1e-6)});await p.evaluate(()=>document.querySelector('[data-ec="'+__w+'"]').click());console.log(' eco wrong:',await status(p));
for(let r=0;r<5;r++){await p.click('[data-ec="nxt"]').catch(()=>{});await p.evaluate(()=>{const c=EC.P*Math.pow(0.1,EC.L-1);document.querySelector('[data-ec="'+EC.o.find(v=>Math.abs(v-c)<c*1e-6)+'"]').click()})}
console.log(' eco after 5:',await status(p),'XP',await p.evaluate(()=>S.xp));
// obs for young + middle
for(const cls of ["Class 2","Class 7"]){p=await open(cls,"obs");console.log('OBS',cls,'listed',await p.evaluate(()=>__l.includes('Sharp Eyes')));
 const modes=[];let ok=true;for(let r=0;r<6;r++){await p.click('[data-ob="nxt"]').catch(()=>{});const i=await p.evaluate(()=>({m:OB.mode,sel:OB.mode==="odd"?'[data-ob="p'+OB.odd+'"]':'[data-ob="q'+OB.ans+'"]',n:OB.mode==="seq"?OB.opts.filter(v=>String(v)===String(OB.ans)).length:1,u:OB.mode==="seq"?new Set(OB.opts.map(String)).size:3}));modes.push(i.m);if(i.n!==1||i.u!==3)ok=false;await p.click(i.sel)}
 console.log(' modes',modes.join(','),'options valid',ok,'|',await status(p),'XP',await p.evaluate(()=>S.xp),'| sideways',await wide(p))}
// alg
p=await open("Class 10","alg");console.log('ALG listed',await p.evaluate(()=>__l.includes('Algebra Challenges')));
await p.click('[data-al="chk"]');console.log(' alg wrong:',await status(p));
for(let r=0;r<5;r++){await p.click('[data-al="nxt"]').catch(()=>{});const x=await p.evaluate(()=>AL.x);for(let i=0;i<Math.abs(x);i++)await p.click('[data-al="'+(x>0?'inc':'dec')+'"]');await p.click('[data-al="chk"]')}
console.log(' alg after 5:',await status(p),'XP',await p.evaluate(()=>S.xp),'| sideways',await wide(p));
// dx (sec) and above
p=await open("Class 10","dx");console.log('DX listed sec',await p.evaluate(()=>__l.includes('Dataset Explorer')));
await p.click('[data-dx="f7"]');console.log(' rows@sleep>=7:',await p.evaluate(()=>document.querySelectorAll('main table tr').length-1),'expected',await p.evaluate(()=>dxSub(7).length));
await p.fill('#dx1','0');await p.click('[data-dx="chk"]');console.log(' dx wrong:',await status(p));
for(let r=0;r<5;r++){await p.click('[data-dx="nxt"]').catch(()=>{});const c=await p.evaluate(()=>dxVal(dxSub(DX.t),DX.col,DX.stat));await p.fill('#dx1',c.toFixed(1));await p.click('[data-dx="chk"]')}
console.log(' dx after 5:',await status(p),'XP',await p.evaluate(()=>S.xp),'| sideways',await wide(p));
// eng
p=await open("Class 11","eng");console.log('ENG listed',await p.evaluate(()=>__l.includes('Engineering Lab')));
await p.fill('#eg1','0');await p.click('[data-eg="chk"]');console.log(' eng wrong:',await status(p));
for(let r=0;r<5;r++){await p.click('[data-eg="nxt"]').catch(()=>{});const rb=await p.evaluate(()=>EG.W*EG.x/8);await p.fill('#eg1',String(rb));await p.click('[data-eg="chk"]')}
console.log(' eng after 5:',await status(p),'XP',await p.evaluate(()=>S.xp),'| sideways',await wide(p));
// above-12 sees dx but no stale planned list; dropper sees eng
for(const [c,expect] of [["Class 12","Engineering Lab"],["Class 5","Sharp Eyes"]]){p=await open(c,"home");console.log(c,'lists',expect,await p.evaluate(e=>__l.includes(e),expect))}
console.log('errors:',errs.length?errs:'none');await b.close()})();
