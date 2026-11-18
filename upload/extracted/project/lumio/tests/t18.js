const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const T=async()=>(await p.locator('#root').innerText()).replace(/\n+/g,' | ');
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(300);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});
await require('./_ob.js').finish(p);await p.waitForTimeout(300);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';S.plan.n=6;S.plan.len=10;S.compSub=COMP[0][0];save();render()");
await p.locator('.nb',{hasText:'Home'}).click();
console.log('COMP before quiz:',(await T()).match(/Complementary[^|]*\|[^|]*/)?.[0]);
await p.locator('.nb',{hasText:'Study'}).click();await p.locator('[data-open="0"]').click();await p.getByRole('button',{name:'Start quiz'}).click();
const ans=await p.evaluate("B().ch[0][3].map(q=>q.a)");for(const a of ans){await p.locator('.opt').nth(a).click();await p.getByRole('button',{name:/Next|Finish/}).click();await p.waitForTimeout(100)}
await p.evaluate("document.querySelectorAll('[data-act=closec]').forEach(x=>x.click())");
await p.locator('.nb',{hasText:'Home'}).click();console.log('COMP after quiz:',(await T()).match(/Complementary[^|]*\|[^|]*\|?[^|]*/)?.[0]);
const cb=p.locator('[data-go="comp"]');console.log('comp button:',await cb.count());
if(await cb.count()){await cb.first().click();const q=await p.evaluate("COMP.find(x=>x[0]===S.compSub)[2].a");await p.locator('[data-cp]').nth(q).click();console.log('comp result xp:',await p.evaluate("S.xp"),'| done today:',await p.evaluate("!!S.comp[today()]"))}
await p.locator('.nb',{hasText:'Study'}).click();const st=await T();
console.log('REVISION:',st.match(/Revision[^|]*\|[^|]*\|?[^|]*/)?.[0]);
console.log('rev ctrl:',await p.locator('[data-rev]').evaluateAll(e=>e.map(x=>x.dataset.rev+':'+x.innerText.slice(0,20))));
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
