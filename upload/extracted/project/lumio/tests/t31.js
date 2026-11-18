const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();
for(const [bd,cl] of [['ICSE / CISCE','Class 8'],['ICSE / CISCE','Class 10'],['CBSE','Class 8']]){
const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:bd});await p.locator('#root select').nth(1).selectOption({label:cl});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.locator('.nb',{hasText:'Study'}).click();
console.log(bd,cl,'-> note shown:',(await p.locator('#root').innerText()).includes('vary from school to school'),errs);await p.close()}
await b.close()})();
