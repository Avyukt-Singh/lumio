const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1200,height:800}});const p=await ctx.newPage();
p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
const T=async(s)=>(await p.locator(s).first().innerText()).replace(/\n+/g,' | ');
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(400);
await p.getByText('School Student').click();
const sel=p.locator('#root select');await sel.nth(0).selectOption({label:'CBSE'});await sel.nth(1).selectOption({label:'Class 11'});
await require('./_ob.js').finish(p);await p.waitForTimeout(300);
console.log('HOME:',(await T('#root')).slice(0,160));
await p.locator('.nb',{hasText:'Study'}).click();await p.waitForTimeout(200);
const st=await T('#root');
console.log('study has outline:',st.includes('chapter outline'),'| worksheet:',st.includes('Printable worksheet'),'| reminder:',st.includes('Study reminder'),'| uploads:',st.includes('My uploaded notes'));
await p.locator('summary',{hasText:'chapter outline'}).click();
console.log('outline items:',await p.locator('details li').filter({hasText:/Gravitation|Waves|Thermodynamics/}).count());
// upload test
await p.setInputFiles('#upf',{name:'n.txt',mimeType:'text/plain',buffer:Buffer.from('Newton second law F=ma')});await p.waitForTimeout(200);
console.log('upload:',(await T('#upm')),'| listed:',(await T('#root')).includes('n.txt'));
await p.setInputFiles('#upf',{name:'bad.pdf',mimeType:'application/pdf',buffer:Buffer.from('x')});await p.waitForTimeout(200);
console.log('bad upload:',await T('#upm'));
// worksheet download
const [dl]=await Promise.all([p.waitForEvent('download'),p.locator('[data-ws]').click()]);
const fs=require('fs');await dl.saveAs('/tmp/ws.html');const w=fs.readFileSync('/tmp/ws.html','utf8');
console.log('worksheet:',dl.suggestedFilename(),'questions:',(w.match(/<ol type="A">/g)||[]).length,'key:',w.includes('Answer key'));
// reload persistence
await p.reload();await p.waitForTimeout(300);await p.locator('.nb',{hasText:'Study'}).click();
console.log('after reload upload kept:',(await T('#root')).includes('n.txt'));
// games -> coding
await p.locator('.nb',{hasText:'Practice'}).click().catch(()=>{});await p.waitForTimeout(200);
console.log('GAMES:',(await T('#root')).slice(0,200));
console.log('errs',errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
