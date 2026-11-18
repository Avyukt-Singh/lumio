const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();
for(const [lab,fn] of [['CBSE 11',async p=>{await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'})}],['ICSE 8',async p=>{await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'ICSE / CISCE'});await p.locator('#root select').nth(1).selectOption({label:'Class 8'})}],['Class 2',async p=>{await p.getByText('School Student').click();await p.locator('#root select').nth(1).selectOption({label:'Class 2'})}]]){
const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);await fn(p);await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.locator('.nb',{hasText:'Practice'}).click();
const gos=await p.locator('#root [data-go]').evaluateAll(e=>[...new Set(e.map(x=>x.dataset.go))].filter(x=>!['home','study','games','progress','ach','board','settings'].includes(x)));
const res=[];
for(const g of gos){await p.locator('.nb',{hasText:'Practice'}).click();const before=errs.length;await p.locator('#root [data-go="'+g+'"]').first().click();await p.waitForTimeout(150);
 const len=(await p.locator('#root').innerText()).length;const h=(await p.locator('#root h1').first().innerText().catch(()=>'?')).slice(0,22);res.push(g+':'+(errs.length>before?'ERR':'ok')+'('+h+')')}
console.log('['+lab+']',res.join(' '),'| errs',errs);await p.close()}
await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
