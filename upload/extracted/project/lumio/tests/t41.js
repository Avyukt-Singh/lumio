const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1200,height:800}});const p=await ctx.newPage();p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const T=async()=>(await p.locator('#root').innerText()).replace(/\n+/g,' | ');
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
console.log('imgs:',await p.evaluate("[...document.images].map(i=>(i.src.slice(0,22)+' '+i.naturalWidth+'px ok='+i.complete)).join(' ; ')"));
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.locator('.nb',{hasText:'Settings'}).click();
console.log('theme controls:',await p.locator('[data-th]').evaluateAll(e=>e.map(x=>x.dataset.th+':'+x.innerText)));
for(const th of ['night','evening','morning','auto']){const bt=p.locator('[data-th="'+th+'"]');if(await bt.count()){await bt.click();await p.waitForTimeout(150);console.log('theme',th,'->',await p.evaluate("document.documentElement.dataset.theme"))}}
await p.locator('[data-th="night"]').click();await p.reload();await p.waitForTimeout(250);console.log('night persists:',await p.evaluate("document.documentElement.dataset.theme"));
// owl image failure fallback
await p.evaluate("document.querySelectorAll('img').forEach(i=>{i.src='data:image/png;base64,broken'})");await p.waitForTimeout(300);
console.log('broken image fallback visible text:',await p.evaluate("[...document.images].filter(i=>!i.naturalWidth).length+' broken imgs; alt texts: '+[...document.images].map(i=>i.alt).filter(Boolean).slice(0,3).join('|')"));
// reset
p.on('dialog',d=>d.dismiss());await p.evaluate("S.xp=99;save()");await p.locator('.nb',{hasText:'Settings'}).click();await p.locator('[data-act="reset"]').click();console.log('reset dismissed -> xp kept:',await p.evaluate("S.xp"));
p.removeAllListeners('dialog');p.on('dialog',d=>d.accept());await p.locator('[data-act="reset"]').click();await p.waitForTimeout(250);
console.log('reset accepted -> xp:',await p.evaluate("S.xp"),'| back at onboarding:',(await T()).includes('Who is learning today'),'| localStorage keys:',await p.evaluate("Object.keys(localStorage).join(',')"));
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
