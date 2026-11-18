// Board- and class-aware catalogue test (checklist B of the second list). Run from the project folder: node tests/catalogue.js $(npm root -g)
const {chromium}=require(process.argv[2]+'/playwright');
let fails=0;const ok=(n,c,x='')=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''))};
(async()=>{const b=await chromium.launch();const errs=[];
const fresh=async()=>{const c=await b.newContext();const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+process.cwd()+'/lumio.html');return p};
const p=await fresh();
const cf=(bd,c,s,i)=>p.evaluate(([bd,c,s,i])=>{const r=catFor(bd,c,s,i);return{names:catNames(bd,c,s,i),level:r.level,name:r.name,note:r.note,pattern:r.pattern,link:r.link&&r.link[1],books:r.groups.flatMap(g=>g[1]).filter(x=>x.includes('|'))}},[bd,c,s||'',i||'']);
const idx=l=>p.evaluate(l=>CLS.indexOf(l),l);
let r=await cf('CBSE',await idx('Class 7'));ok('CBSE Class 7: NCERT book names (Ganita Prakash, Curiosity, Poorvi, Malhar)',r.level==='books'&&['Ganita Prakash','Curiosity','Poorvi','Malhar'].every(x=>r.books.join(' ').includes(x)),r.books.length+' books');
ok('CBSE Class 7 has no senior subjects',!r.names.includes('Accountancy')&&!r.names.includes('Physics')&&r.names.includes('Mathematics')&&r.names.includes('Social Science'));
const cb11=await cf('CBSE',await idx('Class 11'));ok('CBSE Class 11: Physics, Accountancy, Informatics Practices, Applied Mathematics',['Physics','Accountancy','Informatics Practices','Applied Mathematics','Computer Science','Legal Studies'].every(x=>cb11.names.includes(x)));
ok('CBSE Class 11 pattern mentions 70 theory plus 30 practical',/70 marks theory plus 30 practical/.test(cb11.pattern));
const ic9=await cf('ICSE / CISCE',await idx('Class 9'));ok('ICSE Class 9 uses CISCE names (History, Civics and Geography; Computer Applications)',ic9.names.includes('History, Civics and Geography')&&ic9.names.includes('Computer Applications')&&!ic9.names.includes('Informatics Practices'));
const isc=await cf('ICSE / CISCE',await idx('Class 12'));ok('ISC Class 12 has Environmental Science and Accounts',isc.names.includes('Environmental Science')&&isc.names.includes('Accounts'));
const ic3=await cf('ICSE / CISCE',await idx('Class 3'));ok('ICSE lower classes say the school usually decides',/school usually decides/.test(ic3.note));
const up11=await cf('UP Board',await idx('Class 11'));ok('UP Board Class 11: Civics, Agriculture, Hindi',up11.names.includes('Civics')&&up11.names.includes('Agriculture')&&up11.names.includes('Hindi')&&/Lumio has not mapped/.test(up11.pattern));
const up4=await cf('UP Board',await idx('Class 4'));ok('UP Board lower classes: honest note about UPMSP scope',/Classes below 9/.test(up4.note));
const ni10=await cf('NIOS',await idx('Class 10')),ni12=await cf('NIOS',await idx('Class 12'));ok('NIOS Secondary vs Senior Secondary lists differ',ni10.names.includes('Science and Technology')&&!ni10.names.includes('Physics')&&ni12.names.includes('Physics')&&ni12.names.includes('Mass Communication')&&ni10.link==='https://nios.ac.in/');
const ke=await cf('Other State Board',await idx('Class 9'),'Kerala'),go=await cf('Other State Board',await idx('Class 9'),'Goa');ok('Other State Board: names the state board, says it is not mapped, no invented link',/Kerala State Board/.test(ke.note)&&ke.level==='generic'&&ke.link===null&&/Goa state board/.test(go.name));
const ib=await cf('Other / International',await idx('Class 11'),'','IB Diploma'),cam=await cf('Other / International',await idx('Class 9'),'','Cambridge IGCSE'),un=await cf('Other / International',await idx('Class 9'),'','');
ok('International: IB Diploma and Cambridge IGCSE structures',ib.names.includes('Theory of Knowledge')&&cam.names.includes('Computer Science')&&/IGCSE/.test(await p.evaluate(()=>catFor('Other / International',11,'','Cambridge IGCSE').groups[0][0]))&&un.level==='generic'&&/Tell Lumio which curriculum/.test(un.note));
const all=await p.evaluate(()=>CAT.length);ok('boards and classes no longer all see the same '+all+' subjects',new Set([cb11.names.join(),ic9.names.join(),up11.names.join(),ni10.names.join(),r.names.join()]).size===5);
ok('no official links invented: only CBSE, CISCE, UPMSP and NIOS pages are linked',[r.link,ic9.link,up11.link,ni10.link].every(l=>!l||/cbseacademic\.nic\.in|cisce\.org|upmsp\.edu\.in|nios\.ac\.in/.test(l)));
// ---- onboarding step 2 uses the board-aware list
const q=await fresh();await q.click('[data-oc="school"]');
await q.selectOption('#of_board','ICSE / CISCE');await q.selectOption('#of_cls',String(await q.evaluate(()=>CLS.indexOf('Class 9'))));await q.click('[data-obw="next"]');await q.waitForTimeout(100);
const opts=await q.evaluate(()=>[...document.querySelectorAll('[data-of="subs"]')].map(e=>e.dataset.mv));
ok('onboarding shows the ICSE Class 9 subject list (not the generic 34)',opts.includes('History, Civics and Geography')&&opts.length===ic9.names.length&&!opts.includes('Accountancy')&&opts.length!==all,opts.length+' subjects');
ok('onboarding explains the board in a note',await q.evaluate(()=>/ICSE \/ CISCE, Classes 9 and 10/.test(document.querySelector('#root').innerText)&&/not copied from the official syllabus/.test(document.querySelector('#root').innerText)));
await q.selectOption('#of_src','Not sure');await q.click('[data-obw="next"]');await q.waitForTimeout(80);ok('needs a subject or a custom one',/Choose at least one subject or add your own/.test(await q.evaluate(()=>document.querySelector('[role=alert]').innerText)));
await q.check('[data-of="subs"][data-mv="Mathematics"]');await q.fill('#of_customSub','Robotics club, Chess');await q.click('[data-obw="next"]');
for(let i=0;i<3;i++){await q.click('[data-obw="next"],[data-obw="fin"]');await q.waitForTimeout(80)}
await q.waitForTimeout(250);
const subs=await q.evaluate(()=>S.subs);ok('custom subjects are saved with the chosen ones',subs.includes('Mathematics')&&subs.includes('Robotics club')&&subs.includes('Chess'),JSON.stringify(subs));
// ---- stale subjects dropped when board/class changes
const w=await fresh();await w.click('[data-oc="school"]');await w.selectOption('#of_board','CBSE');await w.selectOption('#of_cls',String(await w.evaluate(()=>CLS.indexOf('Class 11'))));await w.click('[data-obw="next"]');await w.check('[data-of="subs"][data-mv="Physics"]');await w.check('[data-of="subs"][data-mv="Accountancy"]');await w.selectOption('#of_src','Not sure');
await w.click('[data-obw="back"]');await w.selectOption('#of_cls',String(await w.evaluate(()=>CLS.indexOf('Class 7'))));await w.click('[data-obw="next"]');await w.waitForTimeout(100);
ok('subjects from the old class are removed after changing class',await w.evaluate(()=>!document.querySelector('[data-of="subs"][data-mv="Physics"]')&&!(O.f.subs||[]).includes('Physics')));
// ---- Study Area guide and Settings card
const g=await fresh();await g.evaluate(()=>{S.cat="school";S.board="CBSE";S.cls=CLS.indexOf("Class 7");S.band=bandOf(S.cls);S.name="T";S.subs=["Mathematics","My own subject"];save();V="study";render()});
const guide=await g.evaluate(()=>{const d=[...document.querySelectorAll('main details')].find(x=>/Board and class guide/.test(x.innerText));if(d)d.open=true;return d?d.innerText:''});
ok('Study Area shows the board and class guide with books, pattern and source',/CBSE · Classes 6 to 8/.test(guide)&&/Ganita Prakash/.test(guide)&&/Assessment pattern/.test(guide)&&/Official source/.test(guide)&&/No external board exam/.test(guide));
ok('guide links only to the official CBSE curriculum page',await g.evaluate(()=>[...document.querySelectorAll('main details a')].every(a=>/cbseacademic\.nic\.in/.test(a.href))));
await g.evaluate(()=>{V="settings";render()});
const boxes=await g.evaluate(()=>[...document.querySelectorAll('.sb2')].map(e=>e.value+(e.checked?'*':'')));
ok('Settings lists this board and class (not all 34) and keeps custom subjects ticked',boxes.length<20&&boxes.includes('Mathematics*')&&boxes.includes('My own subject*')&&!boxes.some(x=>x.startsWith('Accountancy')),boxes.length+' items');
await g.fill('#csub','Origami');await g.click('[data-act="ssg"]');await g.waitForTimeout(150);
ok('Settings can add a subject that is not listed',await g.evaluate(()=>S.subs.includes('Origami')&&S.subs.includes('Mathematics')));
await g.setViewportSize({width:390,height:800});await g.evaluate(()=>{V="study";render();document.querySelectorAll('main details').forEach(d=>d.open=true)});
ok('guide has no sideways scroll at 390 px',await g.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?'FAILURES: '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0)})();
