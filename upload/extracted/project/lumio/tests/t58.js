const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';S.plan.n=10;S.plan.len=10;save();render()");
await p.locator('.nb',{hasText:'Study'}).click();await p.locator('summary',{hasText:'chapter outline'}).click();
const t=await p.locator('details').first().innerText();console.log('facts shown:',/70 marks/.test(t)&&/blocks automated access/.test(t),'| pdf link:',await p.locator('a[href*="Physics_SecP2_2026-27.pdf"]').count());
await p.locator('[data-open="0"]').click();console.log('chapter source line:',(await p.locator('#root').innerText()).match(/Source:[^\n]*/)?.[0]?.slice(0,95));
console.log(errs);await b.close()})();
