const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 9'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.locator('.nb',{hasText:'Practice'}).click();await p.locator('[data-go="bio"]').first().click();
const exp=(a,b)=>{let n=0;for(const x of a)for(const y of b)if(x==='A'||y==='A')n++;return n*25};
let bad=0;
for(const a of ['AA','Aa','aa'])for(const b2 of ['AA','Aa','aa']){let right=null;
 for(const v of [0,25,50,75,100]){await p.evaluate(`BIO={a:'${a}',b:'${b2}',s:0,msg:'',done:false};render()`);await p.locator('[data-bio="'+v+'"]').click();const m=await p.locator('[role=status]').first().innerText();if(/correct|yes|right/i.test(m)&&!/not|wrong|incorrect/i.test(m)){if(right!==null)right='MULTI';else right=v}}
 const e=exp(a,b2);const ok=right===e;if(!ok)bad++;console.log(a+' × '+b2,'app accepts',right,'| expected',e,ok?'✓':'✗ MISMATCH')}
console.log('mismatches:',bad,errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
