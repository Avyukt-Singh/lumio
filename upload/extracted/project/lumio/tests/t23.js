const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(300);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});
await require('./_ob.js').finish(p);await p.waitForTimeout(300);
// keyboard: tab through, record focus ring + names
const seen=[];let noRing=0,unnamed=0;
for(let i=0;i<30;i++){await p.keyboard.press('Tab');await p.waitForTimeout(300);const r=await p.evaluate(()=>{const e=document.activeElement;if(!e||e===document.body)return null;const cs=getComputedStyle(e);const ring=(cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0)||cs.boxShadow!=='none';const name=(e.getAttribute('aria-label')||e.innerText||e.title||e.value||'').trim().slice(0,20);return{t:e.tagName,ring,name}});
 if(!r)continue;seen.push(r.name);if(!r.ring){noRing++;console.log('NORING',r.t,r.name)}if(!r.name)unnamed++}
console.log('tabbed:',seen.length,'| no visible focus:',noRing,'| unnamed controls:',unnamed);
console.log('sample:',seen.slice(0,12).join(' > '));
// Enter on nav via keyboard
await p.locator('.nb',{hasText:'Progress'}).focus();await p.keyboard.press('Enter');await p.waitForTimeout(150);
console.log('Enter activates nav:',(await p.locator('#root h1').first().innerText()));
// images alt, inputs labels, landmarks, skip link
console.log(await p.evaluate(()=>({imgsNoAlt:[...document.images].filter(i=>!i.hasAttribute('alt')).length,inputsNoLabel:[...document.querySelectorAll('input,select,textarea')].filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')).length,main:!!document.querySelector('main,[role=main]'),nav:!!document.querySelector('nav'),h1:document.querySelectorAll('h1').length,lang:document.documentElement.lang})));
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
