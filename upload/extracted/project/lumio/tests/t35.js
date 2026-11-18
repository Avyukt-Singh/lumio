const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();
const school=(bd,cl)=>async p=>{await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:bd});await p.locator('#root select').nth(1).selectOption({label:cl})};
const profiles=[['Class 2 CBSE',school('CBSE','Class 2')],['ICSE 7',school('ICSE / CISCE','Class 7')],['UP 10',school('UP Board','Class 10')],['CBSE 11',school('CBSE','Class 11')],['Dropper',async p=>{await p.getByText('Dropper').first().click()}],['Above 12',async p=>{await p.getByText('Above Class 12').click()}]];
for(const [lab,fn] of profiles){const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(200);await fn(p);await require('./_ob.js').finish(p);await p.waitForTimeout(200);
const seen=[];for(const n of ['Home','Study','Practice','Progress','Achievements','Leaderboard','Settings']){if(!(await p.locator('.nb',{hasText:n}).count())){seen.push('-');continue}await p.locator('.nb',{hasText:n}).click();await p.waitForTimeout(80);seen.push((await p.locator('#root').innerText()).length>200?'✓':'✗')}
await p.locator('.nb',{hasText:'Practice'}).click();const t=(await p.locator('#root').innerText());
const stale=/Stage \d|arrives in|loading comes/.test(await p.evaluate("document.body.innerText"));
console.log(lab.padEnd(13),seen.join(''),'planned list:',(t.match(/Planned[\s\S]*/)?.[0]||'').replace(/\n+/g,' | ').slice(0,90),'| stale text:',stale,'| errs',errs)
await p.close()}
await b.close()})();
