const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const url='file:///home/claude/lumio/lumio.html';
const T=async p=>(await p.locator('#root').innerText()).replace(/\n+/g,' | ');
(async()=>{const b=await chromium.launch();
let p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(url);await p.waitForTimeout(250);await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(300);
await p.locator('#fpill').click();await p.locator('[data-fo="start"]').click();await p.waitForTimeout(2200);
await p.reload();await p.waitForTimeout(500);await p.locator('#fpill').click();await p.waitForTimeout(300);
console.log('M run survives reload:',await p.locator('#ftime').innerText(),'(expect ~24:5x)');
await p.evaluate("FO().run.end=Date.now()-600000;save()");await p.reload();await p.waitForTimeout(1800);
console.log('N finished while closed -> not counted:',(await T(p)).match(/ended while Lumio was closed[^|]*/)?.[0],'| log',await p.evaluate("JSON.stringify(fDay())"));
// old save without fo
await p.evaluate("delete S.fo;save()");await p.reload();await p.waitForTimeout(500);await p.locator('#fpill').click();console.log('O old save without focus data loads:',/Pick a focus style/.test(await T(p)),errs);
await p.close();
// young learner default profile
p=await b.newPage({viewport:{width:1200,height:800}});await p.goto(url);await p.waitForTimeout(250);await p.getByText('School Student').click();await p.locator('#root select').nth(1).selectOption({label:'Class 2'});await require('./_ob.js').finish(p);await p.waitForTimeout(300);
await p.locator('#fpill').click();console.log('P Class 2 default short 15/3:',/Short 15 \/ 3: 15 minutes of focus, 3 minutes/.test(await T(p)));await p.close();
// mobile
p=await b.newPage({viewport:{width:390,height:800}});p.setDefaultTimeout(4000);await p.goto(url);await p.waitForTimeout(250);await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(300);
await p.evaluate("FO().strict=true;save()");
const audit=async l=>{const r=await p.evaluate(`(()=>{const vw=innerWidth,o=[],obs=[],tap=[];document.querySelectorAll('#root *').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width)return;if(r.right>vw+2&&!e.closest('[style*="overflow-x"]'))o.push(e.tagName);});document.querySelectorAll('#root button,#root input:not([type=hidden]),#root select,#root summary').forEach(e=>{const r0=e.getBoundingClientRect();if(!r0.width)return;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect(),t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(t&&t!==e&&!e.contains(t)&&!t.contains(e)&&!(e.closest('label')&&e.closest('label').contains(t)))obs.push((e.innerText||e.id).slice(0,16)+' under '+t.tagName);if((e.tagName==='BUTTON')&&r.height<30)tap.push((e.innerText||'').slice(0,12)+' '+Math.round(r.height))});return JSON.stringify({page:document.documentElement.scrollWidth>vw+2,o:[...new Set(o)].slice(0,3),obs:obs.slice(0,3),tap:tap.slice(0,3)})})()`);console.log(l,r)};
await p.evaluate("V='focus';render()");await audit('Q mobile focus idle   ');
await p.locator('[data-fo="start"]').click();await p.waitForTimeout(400);await audit('R mobile focus running');
await p.evaluate("V='games';render()");await audit('S mobile block screen  ');
console.log('header pill visible on mobile:',await p.locator('#fpill').isVisible(),'| errs',errs);
await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n').slice(0,3).join(' / ')));
