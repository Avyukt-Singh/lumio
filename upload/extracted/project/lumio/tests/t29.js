const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('Above Class 12').click();await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.locator('.nb',{hasText:'Practice'}).click();await p.locator('[data-go="aif"]').first().click();
const m=()=>p.evaluate("[afM('A').acc.toFixed(1),afM('B').acc.toFixed(1)].join(' / ')");
for(const T of [58,60,62,65]){await p.locator('#afs').fill(String(T));await p.waitForTimeout(80);console.log('single T='+T,'-> A/B acc:',await m())}
await p.locator('[data-af="chk"]').click();console.log('single check:',(await p.locator('[role=status]').innerText()).slice(0,70));
await p.locator('#afs').fill('65');await p.locator('#afc').check();await p.locator('#afsb').fill('58');await p.waitForTimeout(80);
console.log('A65/B58 ->',await m());await p.locator('[data-af="chk"]').click();console.log('sep check:',(await p.locator('[role=status]').innerText()).slice(0,90),'| xp',await p.evaluate("S.xp"));
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
