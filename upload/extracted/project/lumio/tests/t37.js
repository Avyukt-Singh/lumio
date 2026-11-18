const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1200,height:800}});const p=await ctx.newPage();p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const T=async()=>(await p.locator('#root').innerText()).replace(/\n+/g,' | ');
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('Above Class 12').click();await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.locator('.nb',{hasText:'Settings'}).click();const st=await T();
console.log('class selector hidden:',!(/Nursery|LKG/.test(st)),'| catalogue count:',await p.locator('.sb2').count(),'| has school subjects:',await p.locator('.sb2[value="Sanskrit"]').count());
await p.locator('#cfq').fill('data');console.log('filter visible:',await p.locator('.cat-l:visible').count());
await p.locator('#cfq').fill('');await p.locator('.sb2[value="Python programming"]').check();await p.locator('#g6').fill('Build a data-analysis portfolio');
await p.locator('[data-act="ssg"]').click();await p.waitForTimeout(150);
await p.locator('.nb',{hasText:'Home'}).click();console.log('goal on home:',/Your goal: Build a data-analysis portfolio/.test(await T()));
await p.reload();await p.waitForTimeout(250);await p.locator('.nb',{hasText:'Settings'}).click();
console.log('persisted subs:',await p.evaluate("S.subs.join(',')"),'| goal:',await p.evaluate("S.goalTxt"));
await p.locator('[data-act="sp"]').click();console.log('profile save ok, cls still',await p.evaluate("S.cls"));
// dropper + school regression
const p2=await ctx.newPage();await p2.goto('file:///home/claude/lumio/lumio.html');await p2.evaluate("localStorage.clear()");await p2.reload();await p2.getByText('Dropper').first().click();await require('./_ob.js').finish(p2);await p2.locator('.nb',{hasText:'Settings'}).click();
console.log('dropper catalogue:',await p2.locator('.sb2').evaluateAll(e=>e.map(x=>x.value)));
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
