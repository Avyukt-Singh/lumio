const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(300);
await p.locator('#fpill').click();await p.locator('[data-fo="start"]').click();await p.waitForTimeout(500);
await p.evaluate("FO().run.end=Date.now()-600000;save()");await p.reload();await p.waitForTimeout(1800);await p.locator('#fpill').click();await p.waitForTimeout(300);
console.log('N closed-app message:',(await p.locator('#root').innerText()).match(/ended while Lumio was closed[^\n]*/)?.[0],'| log',await p.evaluate("JSON.stringify(fDay())"));
await b.close()})();
