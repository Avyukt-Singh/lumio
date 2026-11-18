const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'ICSE / CISCE'});await p.locator('#root select').nth(1).selectOption({label:'Class 7'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.locator('.nb',{hasText:'Practice'}).click();await p.locator('[data-go="pend"]').first().click();
console.log('question locked:',(await p.locator('#root').innerText()).includes('at least 3 trials'));
for(const L of ['0.25','1','2']){await p.locator('#pdl').fill(L);await p.locator('[data-pd="run"]').click()}
console.log('rows:',await p.evaluate("PD.rows.map(r=>r.L+':'+r.t.toFixed(1)).join(' ')"),'(1 m should be ~20.1 s)');
await p.locator('[data-pq="0"]').click();console.log('wrong:',(await p.locator('[role=status]').innerText()).slice(0,60));
await p.locator('[data-pd="clr"]').click();for(const L of ['0.25','1','2'])await p.locator('#pdl').fill(L),await p.locator('[data-pd="run"]').click();
await p.locator('[data-pq="1"]').click();console.log('right:',(await p.locator('[role=status]').innerText()).slice(-12),'| xp',await p.evaluate("S.xp"));
console.log('slider label live:',await (async()=>{await p.locator('#pdl').fill('1.5');return p.locator('#pdv').innerText()})());
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
