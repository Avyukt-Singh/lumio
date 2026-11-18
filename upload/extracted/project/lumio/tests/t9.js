const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();
for(const [lab,fn] of [['Dropper',p=>p.getByText('Dropper').first().click()],['CBSE11 mobile',async p=>{await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'})}]]){
const p=await b.newPage({viewport:{width:390,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(300);await fn(p);await require('./_ob.js').finish(p);await p.waitForTimeout(300);
const labels=await p.locator('nav.bn button').evaluateAll(e=>e.map(x=>x.innerText.replace(/\n/g,' ')));
const clip=await p.locator('nav.bn button').evaluateAll(e=>e.some(x=>x.scrollWidth>x.clientWidth+1));
await p.locator('nav.bn button').filter({hasText:'Study'}).click();await p.waitForTimeout(200);
const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
await p.locator('nav.bn button').filter({hasText:'Ranks'}).click();
console.log(lab,'bottom nav:',labels.join(', '),'| clipped:',clip,'| overflowX:',ov,'| sidebar label:',(await p.locator('#root').innerText()).includes('Class 10')?'HAS Class 10':'ok',errs);
if(lab==='Dropper'){await p.locator('nav.bn button').filter({hasText:'Home'}).click();console.log(' home text ok:',!(await p.locator('#root').innerText()).includes('Class 10 ·'))}
await p.close()}
await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
