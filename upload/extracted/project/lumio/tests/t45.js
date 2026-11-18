const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const audit=()=>{const vw=innerWidth,bad={overflow:[],small:new Set(),tap:new Set()};
document.querySelectorAll('#root *').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none')return;
 if(r.right>vw+2&&!e.closest('[style*="overflow-x"]')&&!e.closest('pre,textarea,.codebox'))bad.overflow.push(e.tagName+'.'+(e.className||'').toString().slice(0,18)+' '+Math.round(r.right));
 const t=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(t&&parseFloat(cs.fontSize)<11.5)bad.small.add(e.tagName+':'+(e.textContent||'').trim().slice(0,22)+'@'+cs.fontSize);
 if((e.tagName==='BUTTON'||e.tagName==='A'||(e.tagName==='INPUT'&&e.type!=='hidden'&&e.type!=='range'&&e.type!=='checkbox'))&&(r.height<32||r.width<32))bad.tap.add(e.tagName+':'+(e.innerText||e.id||'').trim().slice(0,18)+' '+Math.round(r.width)+'x'+Math.round(r.height))});
return{pageOverflow:document.documentElement.scrollWidth>vw+2,overflow:[...new Set(bad.overflow)].slice(0,4),small:[...bad.small].slice(0,4),tap:[...bad.tap].slice(0,5)}};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';S.plan.n=6;S.plan.len=10;save();render()");
const rep=async(l)=>{const r=await p.evaluate("("+audit.toString()+")()");console.log(l.padEnd(14),r.pageOverflow||r.overflow.length?JSON.stringify({o:r.pageOverflow,ov:r.overflow}):'no overflow',r.tap.filter(x=>!/upf/.test(x)).length?JSON.stringify(r.tap.filter(x=>!/upf/.test(x))):'')};
await p.locator('nav.bn button',{hasText:'Study'}).click();await rep('study list');
await p.locator('[data-open="0"]').click();await p.waitForTimeout(150);await rep('chapter notes');
const fc=p.locator('[data-f]');console.log('flashcards:',await fc.count(),'| roles:',await fc.evaluateAll(e=>e.map(x=>x.tagName+':'+(x.getAttribute('aria-pressed')??x.getAttribute('aria-label')??'-')).slice(0,2)));
if(await fc.count()){const before=await fc.first().innerText();await fc.first().click();await p.waitForTimeout(100);console.log('flip changed text:',before!==await p.locator('[data-f]').first().innerText());await p.locator('[data-f]').first().focus();await p.keyboard.press('Enter');}
const chk=p.locator('[data-chk]');console.log('checklist items:',await chk.count());if(await chk.count()){await chk.first().check().catch(()=>chk.first().click());await p.waitForTimeout(80);console.log('checklist persisted:',await p.evaluate("JSON.stringify(S.chk)"))}
await p.getByRole('button',{name:'Start quiz'}).click();await p.waitForTimeout(150);await rep('quiz question');
const ans=await p.evaluate("B().ch[0][3][0].a");await p.locator('.opt').nth((ans+1)%3).click();await p.waitForTimeout(120);
const t=(await p.locator('#root').innerText()).replace(/\n+/g,' | ');console.log('wrong feedback shown:',/Not quite|Incorrect|Why|explain/i.test(t)||/Newton|v=u\+at|=/.test(t),'|',t.match(/(Not quite|Not yet|Incorrect)[^|]*\|?[^|]*/)?.[0]?.slice(0,110));await rep('quiz feedback');
await p.getByRole('button',{name:/Next|Finish/}).click();await p.locator('.opt').nth(await p.evaluate("B().ch[0][3][1].a")).click();await p.getByRole('button',{name:/Next|Finish/}).click();await p.waitForTimeout(200);await rep('quiz result');
console.log('result text:',(await p.locator('#root').innerText()).replace(/\n+/g,' | ').slice(0,200));
console.log(errs);await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
