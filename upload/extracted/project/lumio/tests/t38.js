const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.locator('.nb',{hasText:'Settings'}).click();
await p.locator('#sc').selectOption({label:'Class 12'});await p.locator('[data-act="sp"]').click();await p.waitForTimeout(150);
console.log('school class change ->',await p.evaluate("CLS[S.cls]"),'| catalogue:',await p.locator('.sb2').count(),'| cfq present:',await p.locator('#cfq').count(),errs);
await b.close()})();
