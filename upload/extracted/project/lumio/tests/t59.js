const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch();
for(const mode of ['supported','unsupported']){const p=await b.newPage({viewport:{width:1200,height:800}});p.setDefaultTimeout(4000);const errs=[];p.on('pageerror',e=>errs.push(e.message));
if(mode==='supported')await p.addInitScript(()=>{window.__spoken=[];const real=window.speechSynthesis;window.SpeechSynthesisUtterance=function(t){this.text=t};Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(u){window.__spoken.push(u.text);window.__lang=u.lang},cancel(){window.__cancel=(window.__cancel||0)+1}}})});
else await p.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{configurable:true,value:undefined});delete window.speechSynthesis;try{delete window.SpeechSynthesisUtterance}catch(e){}});
await p.goto('file:///home/claude/lumio/lumio.html');await p.waitForTimeout(250);
await p.getByText('School Student').click();await p.locator('#root select').nth(0).selectOption({label:'CBSE'});await p.locator('#root select').nth(1).selectOption({label:'Class 11'});await require('./_ob.js').finish(p);await p.waitForTimeout(250);
await p.evaluate("S.plan.st='00:00';S.plan.bed='23:59';save();render()");
await p.locator('.nb',{hasText:'Study'}).click();await p.locator('[data-open="0"]').click();
if(mode==='supported'){await p.locator('[data-ra="play"]').click();const sp=await p.evaluate("window.__spoken");console.log(mode,'-> spoke',sp.length,'utterance, chars',sp[0].length,'| lang',await p.evaluate("window.__lang"),'| includes notes:',/v=u\+at|acceleration/i.test(sp[0]),'| excludes flashcards:',!/Flashcards/.test(sp[0]));await p.locator('[data-ra="stop"]').click();console.log(' stop cancels:',(await p.evaluate("window.__cancel"))>=2)}
else console.log(mode,'->',(await p.locator('#root').innerText()).includes('Read-aloud is not supported'),errs);
await p.close()}
await b.close()})().catch(e=>console.log('FAIL',e.message.split('\n')[0]));
