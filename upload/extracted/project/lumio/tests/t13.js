const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const out=[];
for(const [h,exp] of [[10,'morning'],[17,'evening'],[18,'evening'],[19,'night'],[3,'night'],[16,'morning']]){
const p=await b.newPage();await p.clock.setFixedTime(new Date(2026,9,26,h,30,0));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
const t=await p.evaluate("document.documentElement.dataset.theme");out.push(h+':00→'+t+(t===exp?' ✓':' ✗ expected '+exp));await p.close()}
console.log(out.join(' | '));
const p=await b.newPage();await p.goto('file:///home/claude/lumio/lumio.html');await p.evaluate("S.mode='night';save();applyTheme()");await p.reload();await p.waitForTimeout(200);
console.log('manual override persists:',await p.evaluate("document.documentElement.dataset.theme"),'| lang attr:',await p.evaluate("document.documentElement.lang"));
await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
