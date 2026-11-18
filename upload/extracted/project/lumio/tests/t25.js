const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(1).selectOption({label:'Class 2'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.locator('.nb',{hasText:'Practice'}).click();await p.locator('[data-go="memory"]').first().click();
console.log('cards:',await p.locator('[data-mm]').count());
// mismatch: find two cards of different pairs
const key=await p.evaluate("MM.c.map(x=>x.k)");
const a=0,c=key.findIndex((k,i)=>i>0&&k!==key[0]);
await p.locator('[data-mm="'+a+'"]').click();await p.locator('[data-mm="'+c+'"]').click();
console.log('mismatch msg:',await p.locator('[role=status]').first().innerText(),'| open:',await p.evaluate("MM.o.length"));
await p.locator('[data-mm="'+a+'"]').click();console.log('after next tap open (expect 1):',await p.evaluate("MM.o.length"));
// solve
for(let k=0;k<6;k++){const idx=key.map((x,i)=>x===k?i:-1).filter(i=>i>=0);await p.evaluate("MM.o=[]");await p.locator('[data-mm="'+idx[0]+'"]').click();await p.locator('[data-mm="'+idx[1]+'"]').click()}
console.log('final:',await p.locator('[role=status]').first().innerText(),'| xp',await p.evaluate("S.xp"));
await p.locator('[data-mmr]').click();console.log('reset matched:',await p.evaluate("MM.m.length"));
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
