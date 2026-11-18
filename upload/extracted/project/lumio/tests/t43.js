const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const audit=()=>{const vw=innerWidth,bad={overflow:[],small:new Set(),tap:new Set()};
document.querySelectorAll('#root *').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none')return;
 if(r.right>vw+2&&!e.closest('[style*="overflow-x"]')&&!e.closest('pre,textarea,.codebox'))bad.overflow.push(e.tagName+'.'+(e.className||'').toString().slice(0,18)+' '+Math.round(r.right));
 const t=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(t&&parseFloat(cs.fontSize)<11.5)bad.small.add(e.tagName+':'+(e.textContent||'').trim().slice(0,22)+'@'+cs.fontSize);
 if((e.tagName==='BUTTON'||e.tagName==='A'||(e.tagName==='INPUT'&&e.type!=='hidden'&&e.type!=='range'&&e.type!=='checkbox'))&&(r.height<32||r.width<32))bad.tap.add(e.tagName+':'+(e.innerText||e.id||'').trim().slice(0,18)+' '+Math.round(r.width)+'x'+Math.round(r.height))});
return{pageOverflow:document.documentElement.scrollWidth>vw+2,overflow:[...new Set(bad.overflow)].slice(0,4),small:[...bad.small].slice(0,4),tap:[...bad.tap].slice(0,5)}};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
const views=['home','study','games','progress','ach','board','settings','ship','code','chem','ai','aif','proj','web','bio','math','biz','time','geo','parent','comp'];
await p.evaluate("S.consent=true;S.compSub=COMP[0][0];save()");
for(const v of views){await p.evaluate("V='"+v+"';render()");await p.waitForTimeout(60);const r=await p.evaluate("("+audit.toString()+")()");
 const flag=r.pageOverflow||r.overflow.length||r.small.length||r.tap.length;console.log(v.padEnd(8),flag?JSON.stringify(r):'ok')}
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
