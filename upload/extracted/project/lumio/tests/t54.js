const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 9'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.locator('.nb',{hasText:'Practice'}).click();await p.locator('[data-go="chem"]').first().click();
const coef=async()=>p.locator('[data-cc$=":1"]').evaluateAll(e=>e.map(x=>x.previousElementSibling?.nextElementSibling));
const setC=async(vals)=>{for(let k=0;k<vals.length;k++){const cur=await p.evaluate(`(()=>{const b=document.querySelector('[data-cc="${k}:1"]');return +b.previousElementSibling.previousElementSibling? 0:0})()`);}
 // read current via DOM
 for(let k=0;k<vals.length;k++){let now=+(await p.locator('[data-cc="'+k+':1"]').evaluate(e=>e.previousElementSibling.textContent));while(now<vals[k]){await p.locator('[data-cc="'+k+':1"]').click();now++}while(now>vals[k]){await p.locator('[data-cc="'+k+':-1"]').click();now--}}};
const chk=async()=>{await p.locator('[data-act="chk"]').click();return (await p.locator('[role=status]').first().innerText())};
const cases=[[0,'H2+O2→H2O',[2,1,2],true],[0,'H2O unbalanced',[1,1,1],false],[0,'not smallest',[4,2,4],false],[1,'N2+3H2→2NH3',[1,3,2],true],[2,'4Fe+3O2→2Fe2O3',[4,3,2],true],[2,'wrong Fe',[2,3,2],false],[3,'CH4+2O2→CO2+2H2O',[1,2,1,2],true],[3,'CH4 wrong',[1,1,1,2],false]];
for(const [i,l,v,exp] of cases){await p.locator('[data-chi="'+i+'"]').click();await setC(v);const m=await chk();const ok=/balanced|Balanced|Correct|Yes/i.test(m)&&!/not|isn/i.test(m.slice(0,12));console.log(l.padEnd(20),JSON.stringify(v).padEnd(11),'expected',exp?'accept':'reject','->',m.slice(0,70))}
console.log('xp',await p.evaluate("S.xp"),errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
