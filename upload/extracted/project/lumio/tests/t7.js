const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();
for(const who of ['Dropper','Above Class 12']){
const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(300);
await p.getByText(who).first().click();await p.waitForTimeout(200);
console.log('['+who+']',(await p.locator('#root').innerText()).replace(/\n+/g,' | ').slice(0,300));
console.log(' CTRL',JSON.stringify(await p.locator('#root button, #root select, #root input').evaluateAll(e=>e.map(x=>x.tagName[0]+':'+(x.innerText||x.id||x.type||'').slice(0,22)))),errs);
await p.close()}
await b.close()})();
