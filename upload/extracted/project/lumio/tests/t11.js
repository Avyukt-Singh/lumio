const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1200,height:800}});const p=await ctx.newPage();p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const T=async()=>(await p.locator('#root').innerText()).replace(/\n+/g,' | ');
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(300);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});
await require('./_ob.js').finish(p);await p.waitForTimeout(300);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';save();render()");
await p.locator('.nb',{hasText:'Study'}).click();await p.locator('[data-open="0"]').click();await p.getByRole('button',{name:'Start quiz'}).click();await p.waitForTimeout(200);
const ans=await p.evaluate("B().ch[0][3].map(q=>q.a)");
for(let i=0;i<ans.length;i++){await p.locator('.opt').nth(ans[i]).click();await p.waitForTimeout(150);
 const nxt=p.getByRole('button',{name:/Next|Finish|See result/i});if(await nxt.count())await nxt.first().click();await p.waitForTimeout(250)}
console.log('RESULT:',(await T()).slice(0,260));
await p.evaluate("document.querySelectorAll('[data-act=closec]').forEach(x=>x.click())").catch(()=>{});
const st=await p.evaluate("({xp:S.xp,days:S.days.length,res:JSON.stringify(S.res)})");console.log('state:',st);
await p.reload();await p.waitForTimeout(300);
console.log('after reload:',await p.evaluate("({xp:S.xp,days:S.days.length,streak:streak()})"));
await p.locator('.nb',{hasText:'Progress'}).click();console.log('PROGRESS:',(await T()).slice(0,220));
await p.locator('.nb',{hasText:'Achievements'}).click();console.log('ACH:',(await T()).match(/\d+\/\d+ unlocked/)?.[0]);
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
