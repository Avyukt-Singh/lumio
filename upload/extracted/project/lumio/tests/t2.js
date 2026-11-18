const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(500);
const dump=async()=>console.log((await p.locator('#root').innerText()).replace(/\n+/g,' | ').slice(0,500),'\nBTN:',JSON.stringify(await p.locator('#root button, #root select, #root input').evaluateAll(e=>e.map(x=>(x.tagName[0])+':'+(x.innerText||x.id||x.type||'').slice(0,28)).slice(0,25))));
await dump();console.log('errs',errs);await b.close()})();
