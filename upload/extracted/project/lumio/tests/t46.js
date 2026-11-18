const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:800}});p.setDefaultTimeout(3000);
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';S.plan.n=6;S.plan.len=10;save();render()");
await p.locator('nav.bn button',{hasText:'Study'}).click();await p.locator('[data-open="0"]').click();await p.waitForTimeout(150);
console.log('flashcard markup:',await p.evaluate("(()=>{const h=document.getElementById('root').innerHTML;const i=h.indexOf('Flashcards');return h.slice(i,i+420)})()"));
try{await p.getByRole('button',{name:'Start quiz'}).click({timeout:2500});console.log('start quiz clickable')}catch(e){console.log('ERR',e.message.split('\n').slice(0,6).join(' / '))}
await b.close()})();
