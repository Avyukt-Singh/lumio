const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(400);
const dump=async(l)=>console.log('['+l+']',(await p.locator('#root').innerText()).replace(/\n+/g,' | ').slice(0,260),'\n  CTRL:',JSON.stringify(await p.locator('#root button, #root select, #root input').evaluateAll(e=>e.map(x=>x.tagName[0]+':'+(x.innerText||x.id||x.type||'').slice(0,18)).slice(0,14))));
await p.getByText('School Student').click();await dump('after school');
await b.close();console.log(errs)})();
