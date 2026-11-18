const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(300);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});
await require('./_ob.js').finish(p);await p.waitForTimeout(300);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';S.plan.n=6;S.plan.len=10;save();render()");
const doQuiz=async(ci,right)=>{await p.locator('.nb',{hasText:'Study'}).click();await p.locator('[data-open="'+ci+'"]').click();await p.getByRole('button',{name:'Start quiz'}).click();
 const ans=await p.evaluate("B().ch["+ci+"][3].map(q=>q.a)");
 for(let i=0;i<ans.length;i++){const k=i<right?ans[i]:(ans[i]+1)%3;await p.locator('.opt').nth(k).click();await p.getByRole('button',{name:/Next|Finish/}).click();await p.waitForTimeout(120)}
 await p.evaluate("document.querySelectorAll('[data-act=closec]').forEach(x=>x.click())");await p.waitForTimeout(150)};
for(const ci of [0,1,2,3])await doQuiz(ci,6);
await doQuiz(4,6);
console.log('6/6 -> state:',await p.evaluate("state(4)"),'| achievements:',await p.evaluate("unlocked().length"),'| xp',await p.evaluate("S.xp"));
const w=await p.evaluate("1");await p.locator('.nb',{hasText:'Study'}).click();await p.locator('[data-open="4"]').click();
console.log('notes show:',(await p.locator('#root').innerText()).includes('Distance is the total path'));
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
