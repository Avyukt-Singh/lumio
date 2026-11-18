const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();
for(const [w,lab] of [[390,'mobile'],[1200,'desktop']]){const p=await b.newPage({viewport:{width:w,height:800}});p.setDefaultTimeout(3000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';S.plan.n=6;S.plan.len=10;save();render()");
await p.locator(w<800?'nav.bn button':'.nb',{hasText:'Study'}).click();await p.locator('[data-open="0"]').click();await p.waitForTimeout(150);
const vis=await p.evaluate("(()=>{const b=document.querySelector('.bub').getBoundingClientRect();return Math.round(b.width)})()");
await p.getByRole('button',{name:'Start quiz'}).click();console.log(lab,'bubble width when closed:',vis,'| Start quiz clickable: yes');
await p.locator('.owlt').click();console.log(' tip toggled open:',await p.evaluate("document.querySelector('.owl').classList.contains('open')"),'| bubble text still readable:',(await p.locator('.bub').innerText()).length>5,errs);await p.close()}
await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
