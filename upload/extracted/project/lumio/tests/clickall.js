const {chromium}=require(process.argv[2]+'/playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:800}});const p=await ctx.newPage();
await p.addInitScript(()=>{try{localStorage.clear()}catch(e){}});
let errs=[];p.on('pageerror',e=>errs.push(e.message));
const views=(process.argv[3]||'home,study,games,progress,ach,board,settings,focus,social,parent').split(',');
const skip=/reset|delete|erase|clear all|sign out|log out|logout|remove account|export|download|print/i;
let total=0,bad=[];
const setup=async v=>{await p.goto('file://'+process.cwd()+'/lumio.html');await p.evaluate(v=>{S.cat="school";S.board="CBSE";S.cls=CLS.indexOf("Class 11");S.band=bandOf(S.cls);S.name="T";save();V=v;render()},v)};
for(const v of views){await setup(v);const n=await p.evaluate(()=>document.querySelectorAll('#root button').length);
for(let i=0;i<n;i++){await setup(v);errs=[];
const info=await p.evaluate(i=>{const x=document.querySelectorAll('#root button')[i];return x?{t:(x.textContent||x.getAttribute('aria-label')||'').trim().slice(0,40),dis:x.disabled}:null},i);
if(!info||info.dis||skip.test(info.t))continue;total++;
try{await p.evaluate(i=>document.querySelectorAll('#root button')[i].click(),i);await p.waitForTimeout(40);
const st=await p.evaluate(()=>({blank:!document.querySelector('#root').innerText.trim(),sw:document.documentElement.scrollWidth>innerWidth}));
if(errs.length||st.blank||st.sw)bad.push(v+' #'+i+' "'+info.t+'" '+(errs[0]||(st.blank?'BLANK':'sideways')))}catch(e){bad.push(v+' #'+i+' "'+info.t+'" '+String(e).slice(0,80))}}}
console.log('clicked',total,'buttons; problems:',bad.length);bad.slice(0,15).forEach(x=>console.log(' -',x));await b.close()})();
