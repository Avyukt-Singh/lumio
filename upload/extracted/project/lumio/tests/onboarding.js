// Onboarding wizard test (checklist A). Run from the project folder: node tests/onboarding.js $(npm root -g)
const {chromium}=require(process.argv[2]+'/playwright');
let fails=0;const ok=(n,c,x='')=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+n+(x?'  '+x:''))};
(async()=>{const b=await chromium.launch();const errs=[];
const fresh=async()=>{const c=await b.newContext();const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto('file://'+process.cwd()+'/lumio.html');return p};
const err=p=>p.evaluate(()=>(document.querySelector('[role=alert]')||{}).innerText||'');
const next=async p=>{await p.click('[data-obw="next"],[data-obw="fin"]');await p.waitForTimeout(80)};
const title=p=>p.evaluate(()=>document.querySelector('#root h2').innerText);
const sw=async p=>{await p.setViewportSize({width:390,height:800});const w=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);await p.setViewportSize({width:1100,height:800});return w};
// ---- School, Other State Board, young learner (Class 3)
let p=await fresh();await p.click('[data-oc="school"]');
ok('first school step is About you',await title(p)==='About you');
await p.selectOption('#of_board','Other State Board');ok('state field appears for Other State Board',await p.evaluate(()=>!!document.querySelector('#of_state')));
await next(p);ok('class/state required',/State or union territory/.test(await err(p)));
await p.selectOption('#of_state','Kerala');await next(p);ok('class required',/Class is required/.test(await err(p)));
await p.selectOption('#of_cls','5');await p.selectOption('#of_lang','hi');await p.fill('#of_name','Mia');
ok('academic year defaults to the current one',await p.evaluate(()=>document.querySelector('#of_year').value===obYear()));
await next(p);ok('subjects step',await title(p)==='Subjects and books');await p.selectOption('#of_src','Official board syllabus');await next(p);ok('subjects required from Class 1 up',/Choose at least one subject/.test(await err(p)));
await p.check('[data-of="subs"][data-mv="English"]');await p.check('[data-of="subs"][data-mv="Mathematics"]');await p.fill('#of_books','NCERT Math Magic');await p.selectOption('#of_src','Official board syllabus');await next(p);
ok('your day step',await title(p)==='Your day');await p.fill('#of_sh1','09:00');await p.fill('#of_sh2','08:00');await next(p);ok('school end before start rejected',/School must end after it starts/.test(await err(p)));
await p.fill('#of_sh2','14:00');await next(p);ok('goals step',await title(p)==='Goals');await next(p);
ok('guardian step (young)',await title(p)==='Parents and guardians'&&await p.evaluate(()=>document.querySelector('#root').innerText.includes('Nursery to Class 5')));
await next(p);ok('young learner blocked without guardian confirmation',/parent or guardian must confirm/.test(await err(p)));
ok('young guardian summary defaults on',await p.evaluate(()=>document.querySelector('#of_share').checked));
await p.check('#of_adult');await next(p);await p.waitForTimeout(300);
const s1=await p.evaluate(()=>({cat:S.cat,band:S.band,state:S.state,year:S.year,lang:S.prefLang,consent:S.consent,g:S.guardian&&S.guardian.level,plan:S.plan,subs:S.subs,name:S.name,books:S.prof.books}));
ok('profile stored',s1.cat==='school'&&s1.band==='young'&&s1.state==='Kerala'&&s1.lang==='hi'&&s1.consent===true&&s1.g==='young'&&s1.name==='Mia'&&s1.books==='NCERT Math Magic',JSON.stringify(s1).slice(0,160));
ok('young plan: 1 short session after school',s1.plan.n===1&&s1.plan.len===20&&s1.plan.st==='16:00'&&s1.plan.sh1==='09:00',JSON.stringify([s1.plan.st,s1.plan.len,s1.plan.n]));
ok('home loads after onboarding',await p.evaluate(()=>/Welcome back, Mia/.test(document.querySelector('main').innerText)));
// ---- School Class 11 CBSE with competitive exam, teen guardian
p=await fresh();await p.click('[data-oc="school"]');await p.selectOption('#of_board','CBSE');await p.selectOption('#of_cls','13');await next(p);
ok('no state field for CBSE',true);await p.check('[data-of="subs"][data-mv="Physics"]');await p.selectOption('#of_src','Official board syllabus');await next(p);
await p.fill('#of_cur','60');ok('Class 10-12 study-time field shown',await p.evaluate(()=>!!document.querySelector('#of_cur')));await next(p);
ok('competitive exam field shown from Class 9',await p.evaluate(()=>!!document.querySelector('[data-of="comp"]')));ok('exam date hidden until exam picked',await p.evaluate(()=>!document.querySelector('#of_compDate')));
await p.check('[data-of="comp"][data-mv="JEE Main"]');await p.waitForTimeout(150);ok('competitive exam date appears after choosing an exam',await p.evaluate(()=>!!document.querySelector('#of_compDate')));
await p.fill('#of_compDate','2000-01-01');await next(p);ok('past exam date rejected',/today or later/.test(await err(p)));
await p.fill('#of_compDate','2027-01-20');await p.fill('#of_examName','Half-yearly');await p.press('#of_examName','Tab');await p.waitForTimeout(150);await p.fill('#of_examDate','2026-12-05');await next(p);
ok('teen guardian step is optional',await title(p)==='Parents and guardians'&&await p.evaluate(()=>!document.querySelector('#of_adult')&&!document.querySelector('#of_share').checked));
await next(p);await p.waitForTimeout(300);
const s2=await p.evaluate(()=>({band:S.band,exam:S.exam,edate:S.edate,consent:S.consent,plan:S.plan,ex:S.prof.examName}));
ok('Class 11: band, competitive exam, consent off',s2.band==='senior'&&s2.exam==='JEE Main'&&s2.edate==='2027-01-20'&&s2.consent===false&&s2.ex==='Half-yearly');
ok('1.5x rule gives 3 sessions of 30 min from 16:00',s2.plan.n===3&&s2.plan.len===30&&s2.plan.st==='16:00',JSON.stringify([s2.plan.n,s2.plan.len,s2.plan.st]));
// ---- UP Board sets state automatically
p=await fresh();await p.click('[data-oc="school"]');await p.selectOption('#of_board','UP Board');await p.selectOption('#of_cls','10');await next(p);await p.check('[data-of="subs"][data-mv="Science"]');await p.selectOption('#of_src','Not sure');await next(p);await next(p);await next(p);await p.waitForTimeout(100);
const mid=await title(p);ok('Class 8 reaches the middle-school guardian step',mid==='Parents and guardians'&&await p.evaluate(()=>document.querySelector('#root').innerText.includes('We recommend')));await next(p);await p.waitForTimeout(250);
ok('UP Board fills state automatically',await p.evaluate(()=>S.state==='Uttar Pradesh'&&S.band==='middle'));
// ---- Dropper
p=await fresh();await p.click('[data-oc="dropper"]');await p.selectOption('#of_exam','NEET');await p.fill('#of_edate','2020-05-05');await p.selectOption('#of_attempts','1');await p.selectOption('#of_lang','hg');await next(p);ok('past exam date rejected',/today or later/.test(await err(p)));
await p.fill('#of_edate','2027-05-03');await next(p);ok('preparation step',await title(p)==='Your preparation');await next(p);ok('subjects required',/Exam subjects/.test(await err(p)));
for(const x of['Physics','Chemistry','Biology'])await p.check(`[data-of="subs"][data-mv="${x}"]`);await p.fill('#of_covered','55');await p.fill('#of_strong','Organic basics');await next(p);ok('weak areas required',/Your weak areas/.test(await err(p)));
await p.fill('#of_weak','Rotation, electrostatics');await p.selectOption('#of_prev','Coaching');await p.fill('#of_prevNote','Allen, 2025');await next(p);
ok('mock and habits step',await title(p)==='Mock tests and habits');await p.fill('#of_mocks','12');await p.fill('#of_mscore','430');await p.selectOption('#of_best','morning');await p.fill('#of_hrs','5');await p.fill('#of_avail','6');await next(p);ok('mock score needs total',/mock score and its total/.test(await err(p)));
await p.fill('#of_mtotal','720');await p.fill('#of_hrs','5');await next(p);await next(p);await p.waitForTimeout(300);
const s3=await p.evaluate(()=>({band:S.band,exam:S.exam,edate:S.edate,weak:S.weak,prev:S.prev,subs:S.subs,plan:S.plan,prof:{mocks:S.prof.mocks,ms:S.prof.mscore,mt:S.prof.mtotal,cov:S.prof.covered,att:S.prof.attempts,hrs:S.prof.hrs}}));
ok('dropper profile stored',s3.band==='dropper'&&s3.exam==='NEET'&&s3.edate==='2027-05-03'&&/electrostatics/.test(s3.weak)&&/Allen/.test(s3.prev)&&s3.subs.length===3&&s3.prof.mocks==='12'&&s3.prof.mt==='720'&&s3.prof.cov==='55',JSON.stringify(s3.prof));
ok('dropper plan from availability (4 sessions, morning start, fits before bedtime)',s3.plan.n===4&&s3.plan.st==='09:00'&&s3.plan.len>=30,JSON.stringify([s3.plan.n,s3.plan.st,s3.plan.len]));
ok('dropper home shows exam countdown',await p.evaluate(()=>/NEET/.test(document.querySelector('main').innerText)));
// ---- Above Class 12
p=await fresh();await p.click('[data-oc="above"]');await p.selectOption('#of_type','Working professional');await p.selectOption('#of_field','Data and AI');await next(p);
ok('goals step',await title(p)==='Your goals');await p.selectOption('#of_level','Beginner');await next(p);ok('goal required',/What do you want to achieve/.test(await err(p)));
await p.fill('#of_goal','Become a data analyst');await p.fill('#of_hpw','10');await p.selectOption('#of_best','evening');await p.fill('#of_commit','Office 9 to 6');await next(p);
ok('topics step with no parent phone note',await title(p)==='Topics'&&await p.evaluate(()=>/does not ask for a parent/.test(document.querySelector('#root').innerText)));
await next(p);ok('topics required',/Topics you want to learn/.test(await err(p)));await p.check('[data-of="subs"][data-mv="Python programming"]');await next(p);await p.waitForTimeout(300);
const s4=await p.evaluate(()=>({band:S.band,goal:S.goalTxt,subs:S.subs,plan:S.plan,t:S.prof.type,f:S.prof.field,l:S.prof.level}));
ok('above-12 profile stored',s4.band==='above'&&s4.goal==='Become a data analyst'&&s4.subs[0]==='Python programming'&&s4.t==='Working professional'&&s4.f==='Data and AI'&&s4.l==='Beginner');
ok('above-12 plan: 10 h/week (86 min a day) gives 2 sessions from 18:00',s4.plan.n===2&&s4.plan.st==='18:00',JSON.stringify([s4.plan.n,s4.plan.st,s4.plan.len]));
ok('above-12 has no guardian data',await p.evaluate(()=>!S.guardian));
// ---- Edit keeps progress, prefilled, cancel works
await p.evaluate(()=>{S.xp=345;S.res[cid(0)]={best:2,att:1,last:today()};save();V="settings";render()});
await p.click('[data-obw="edit"]');ok('edit opens the wizard prefilled',await p.evaluate(()=>document.querySelector('#of_name')!==null&&document.querySelector('#of_type').value==='Working professional'));
await p.selectOption('#of_lang','hi');await next(p);await p.fill('#of_hpw','20');await next(p);await next(p);await p.waitForTimeout(250);
const s5=await p.evaluate(()=>({xp:S.xp,best:S.res[cid(0)]&&S.res[cid(0)].best,lang:S.prefLang,hpw:S.prof.hpw,V}));
ok('editing keeps XP and quiz results, saves changes and returns to Settings',s5.xp===345&&s5.best===2&&s5.lang==='hi'&&s5.hpw==='20'&&s5.V==='settings',JSON.stringify(s5));
await p.click('[data-obw="edit"]');await p.click('[data-obw="back"]');ok('cancel at first step returns to Settings',await p.evaluate(()=>V==='settings'));
// ---- layout at phone width on a few steps
p=await fresh();await p.click('[data-oc="school"]');let wide=await sw(p);await p.selectOption('#of_cls','13');await p.selectOption('#of_board','CBSE');await next(p);wide=wide||await sw(p);await p.check('[data-of="subs"][data-mv="Physics"]');await p.selectOption('#of_src','Not sure');await next(p);wide=wide||await sw(p);
ok('no sideways scroll at 390 px on onboarding steps',!wide);
ok('no page errors',errs.length===0,errs.join(' | '));
console.log(fails?'FAILURES: '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0)})();
