const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.evaluate("S.dn='Asha';save()");await p.locator('.nb',{hasText:'Leaderboard'}).click();await p.locator('[data-act="lbs"]').click();await p.waitForTimeout(600);
console.log('offline sync message:',(await p.locator('#root').innerText()).match(/Could not reach[^\n]*/)?.[0]);
console.log('remove offline:');await p.locator('[data-act="lbd"]').click();await p.waitForTimeout(500);console.log((await p.locator('#root').innerText()).match(/Could not reach[^\n]*/)?.[0]);
console.log(errs);await b.close()})();
