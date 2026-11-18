const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';S.plan.n=10;S.plan.len=10;S.res={senior0:{best:2,att:1,last:today()},senior1:{best:2,att:1,last:today()},senior2:{best:2,att:1,last:today()}};save();render()");
await p.locator('.nb',{hasText:'Study'}).click();await p.locator('[data-open="3"]').click();await p.waitForTimeout(150);
console.log('key points items:',await p.locator('h2:has-text("Key points") + ul li').count(),'| first item length:',(await p.locator('h2:has-text("Key points") + ul li').first().innerText()).length);
await b.close()})();
