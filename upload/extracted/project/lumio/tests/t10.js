const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const T=async()=>(await p.locator('#root').innerText()).replace(/\n+/g,' | ');
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(300);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});
await require('./_ob.js').finish(p);await p.waitForTimeout(300);
// LOCK: session far in the future today
await p.evaluate("S.plan.st='23:00';S.plan.bed='23:59';save();render()");
await p.locator('.nb',{hasText:'Study'}).click();await p.waitForTimeout(200);
await p.locator('[data-open="0"]').click().catch(e=>console.log('open0 fail'));await p.waitForTimeout(200);
console.log('LOCK:',(await T()).match(/Session 1 unlocks at[^|]*|🔒[^|]*/)?.[0]);
// UNLOCK
await p.evaluate("S.plan.st='00:00';S.plan.len=30;S.plan.bed='23:59';save();render()");await p.waitForTimeout(200);
await p.locator('[data-open="0"]').click();await p.waitForTimeout(300);
console.log('QUIZ start:',(await T()).slice(250,520));
console.log('CTRL',JSON.stringify(await p.locator('#root button').evaluateAll(e=>e.map(x=>(x.className+'|'+x.innerText).slice(0,34)).slice(-9))));
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
