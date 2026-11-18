const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const T=async()=>(await p.locator('#root').innerText()).replace(/\n+/g,' | ');
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';S.plan.n=6;S.plan.len=10;S.consent=true;save();render()");
await p.locator('.nb',{hasText:'Study'}).click();await p.locator('[data-open="3"]').click().catch(()=>{});
await p.evaluate("V='study';render()");await p.locator('[data-open="0"]').click();await p.getByRole('button',{name:'Start quiz'}).click();
const ans=await p.evaluate("B().ch[0][3].map(q=>q.a)");for(let i=0;i<ans.length;i++){await p.locator('.opt').nth(i===0?ans[i]:(ans[i]+1)%3).click();await p.getByRole('button',{name:/Next|Finish/}).click();await p.waitForTimeout(100)}
await p.evaluate("document.querySelectorAll('[data-act=closec]').forEach(x=>x.click())");
await p.evaluate("V='parent';render()");const t=await T();
console.log('chapter line:',t.match(/[^|]*· best[^|]*/)?.[0]);
console.log('weekly report:',t.match(/Weekly report \| [^|]*/)?.[0]);
console.log('print btn:',await p.locator('[data-print]').count());
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
