const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(1).selectOption({label:'UKG'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.locator('.nb',{hasText:'Practice'}).click();console.log('games:',await p.locator('#root [data-go]').evaluateAll(e=>[...new Set(e.map(x=>x.dataset.go))].filter(x=>!['home','study','games','progress','ach','board','settings'].includes(x))));
await p.locator('[data-go="word"]').first().click();
const ans=()=>p.evaluate("WDS[WD.i][1]");
await p.locator('[data-wd]:not([data-wd="'+await ans()+'"])').first().click();console.log('wrong:',await p.locator('[role=status]').first().innerText());await p.locator('[data-wdn]').click();
for(let i=0;i<5;i++){await p.locator('[data-wd="'+await ans()+'"]').click();if(i<4)await p.locator('[data-wdn]').click()}
console.log('after 5 right:',await p.locator('[role=status]').first().innerText(),'| xp',await p.evaluate("S.xp"));
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
