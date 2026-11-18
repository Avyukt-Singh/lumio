const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('file:///home/claude/proj/lumio/lumio.html');await p.waitForTimeout(800);
console.log('title',await p.title(),'buttons',await p.locator('button').count());
console.log('errors',JSON.stringify(errs.filter(e=>!/fonts\.googleapis|ERR_/.test(e))));
await b.close()})().catch(e=>{console.log('FAIL',e.message.split('\n')[0]);process.exit(1)});
