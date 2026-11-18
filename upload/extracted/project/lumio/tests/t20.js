const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const T=async()=>(await p.locator('#root').innerText()).replace(/\n+/g,' | ');
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(300);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});
await require('./_ob.js').finish(p);await p.waitForTimeout(300);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';S.plan.n=10;S.plan.len=10;save();render()");
const quiz=async(ci,right)=>{await p.locator('.nb',{hasText:'Study'}).click();await p.locator('[data-open="'+ci+'"]').click();await p.getByRole('button',{name:'Start quiz'}).click();
 const ans=await p.evaluate("B().ch["+ci+"][3].map(q=>q.a)");for(let i=0;i<ans.length;i++){const k=i<right?ans[i]:(ans[i]+1)%3;await p.locator('.opt').nth(k).click();await p.getByRole('button',{name:/Next|Finish/}).click();await p.waitForTimeout(100)}
 await p.evaluate("document.querySelectorAll('[data-act=closec]').forEach(x=>x.click())")};
await quiz(0,2);await quiz(1,1);await quiz(2,0);
await p.locator('.nb',{hasText:'Progress'}).click();
console.log('PROGRESS:',(await T()).slice(230,900));
console.log('state:',await p.evaluate("JSON.stringify(S.res)"));
// mock
await p.locator('.nb',{hasText:'Study'}).click();await p.locator('[data-rev="mock:0"]').click();await p.waitForTimeout(300);
console.log('MOCK start:',(await T()).slice(240,420));
let n=0;while(await p.locator('[data-rp]').count()&&n<30){await p.locator('[data-rp]').first().click();const nx=p.getByRole('button',{name:/Next|Finish|Submit/i});if(await nx.count())await nx.first().click();await p.waitForTimeout(100);n++}
console.log('MOCK end:',(await T()).slice(240,520));
console.log('mocks stored:',await p.evaluate("JSON.stringify(S.mocks)"));
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
