// Shared helper: finish the onboarding wizard the way a real learner would (used by older tests).
// If a step shows a validation error, it fills the empty required fields with the first sensible choice.
exports.finish=async p=>{for(let i=0;i<20;i++){
 if(await p.evaluate(()=>!document.querySelector('[data-obw="next"],[data-obw="fin"]')))return;
 const last=await p.evaluate(()=>!!document.querySelector('[data-obw="fin"]'));
 await p.click(last?'[data-obw="fin"]':'[data-obw="next"]');await p.waitForTimeout(70);
 if(await p.evaluate(()=>!!document.querySelector('[role=alert]'))){
  await p.evaluate(()=>{const r=document.querySelector('#root');
   r.querySelectorAll('select').forEach(s=>{if(!s.value){const o=[...s.options].find(x=>x.value);if(o){s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true}));s.dispatchEvent(new Event('input',{bubbles:true}))}}});
   const groups={};r.querySelectorAll('input[type=radio]').forEach(x=>{(groups[x.name||'g']=groups[x.name||'g']||[]).push(x)});
   Object.values(groups).forEach(g=>{if(!g.some(x=>x.checked))g[0].click()});
   r.querySelectorAll('input[type=text],input:not([type]),input[type=number]').forEach(x=>{if(x.value)return;if(x.type==='number'){x.value=String(Math.max(+x.min||0,10))}else x.value='Test learner';x.dispatchEvent(new Event('input',{bubbles:true}));x.dispatchEvent(new Event('change',{bubbles:true}))});
   const al=(document.querySelector('[role=alert]')||{}).innerText||'';if(/confirm|guardian|consent|agree/i.test(al)){r.querySelectorAll('input[type=checkbox]').forEach(x=>{if(!x.checked)x.click()})}else if(![...r.querySelectorAll('input[type=checkbox]')].some(x=>x.checked)){const all=[...r.querySelectorAll('input[type=checkbox]')],pick=all.filter(x=>/physics|chemistry|math/i.test((x.closest('label')||{}).textContent||''));(pick.length?pick:all.slice(0,1)).forEach(x=>x.click())}});
  await p.waitForTimeout(40)}
}};
