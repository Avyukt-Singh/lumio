const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:800}});
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(200);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(200);
await p.evaluate("V='study';render()");
console.log(await p.evaluate(`(()=>{const out=[];document.querySelectorAll('#root a').forEach(a=>{a.scrollIntoView({block:'center'});const r=a.getBoundingClientRect();const t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(t!==a&&!a.contains(t))out.push({a:a.textContent.slice(0,40),rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],under:t.tagName+' '+t.textContent.slice(0,30),underRect:(()=>{const q=t.getBoundingClientRect();return [Math.round(q.left),Math.round(q.top),Math.round(q.width),Math.round(q.height)]})(),pdisp:getComputedStyle(a).display,parent:a.parentElement.tagName+'.'+a.parentElement.className})});return JSON.stringify(out)})()`));
await b.close()})();
