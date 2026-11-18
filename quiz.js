(() => {
  'use strict';
  const form=document.getElementById('class-quiz'),status=document.getElementById('submission-status'),button=document.getElementById('submit-quiz'),nameInput=document.getElementById('student-name'),result=document.getElementById('quiz-explanation'),title=document.getElementById('quiz-title');
  const config=window.QuantumQuizConfig||{},key='quantum-class-quiz-v1',uuid=()=>crypto.randomUUID(),isID=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
  let stored={participant:uuid(),receipts:{},drafts:{},profiles:[],submitted:{},lastName:'',pending:null};
  try{const value=JSON.parse(localStorage.getItem(key));if(value&&isID(value.participant))stored={...stored,...value};}catch(_){}
  stored.profiles=Array.isArray(stored.profiles)?stored.profiles.filter(p=>p&&typeof p.name==='string'&&isID(p.participant)):[];
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(stored));}catch(_){}};
  let classCode=config.defaultClass||'QM1-04',activePhase=null,activeName='',participant=stored.participant,ready=false,checking=false,accepting=false,busy=false,notice='',noticeError=false;
  const phase=()=>activePhase||'before',answers=()=>['q1','q2','q3'].map(name=>form.elements[name].value);
  const currentKey=()=>classCode+'/'+participant+'/'+phase();
  const normalizeName=value=>value.trim().replace(/\s+/g,' ');
  function clearFeedback(){result.hidden=true;result.replaceChildren();form.querySelectorAll('.answer-correct,.answer-incorrect').forEach(e=>e.classList.remove('answer-correct','answer-incorrect'));}
  function validFeedback(f){return f&&Array.isArray(f.answers)&&Array.isArray(f.correctAnswers)&&f.answers.length===3&&f.correctAnswers.length===3&&[...f.answers,...f.correctAnswers].every(a=>['a','b','c'].includes(a))&&Number.isInteger(f.score)&&f.score===f.answers.filter((a,i)=>a===f.correctAnswers[i]).length&&Array.isArray(f.explanations)&&f.explanations.length===3&&f.explanations.every(s=>typeof s==='string'&&s.length<=300);}
  function showFeedback(feedback){
    clearFeedback();if(!ready||activePhase!=='after'||!validFeedback(feedback))return;
    const heading=document.createElement('h3');heading.textContent=`3問中 ${feedback.score}問正解`;result.append(heading);
    const list=document.createElement('ol');list.className='result-list';
    feedback.answers.forEach((answer,i)=>{
      const correct=answer===feedback.correctAnswers[i],item=document.createElement('li'),label=document.createElement('strong');
      item.className=correct?'result-correct':'result-incorrect';label.textContent=`問${i+1}　${correct?'○ 正解':'× 不正解'}`;item.append(label);
      const fields=[...form.elements['q'+(i+1)]],choice=code=>fields.find(f=>f.value===code).closest('label');
      choice(feedback.correctAnswers[i]).classList.add('answer-correct');if(!correct)choice(answer).classList.add('answer-incorrect');
      if(!correct){const selected=document.createElement('p');selected.className='chosen-answer';selected.textContent='あなたの回答：'+choice(answer).querySelector('span').textContent;item.append(selected);}
      const solution=document.createElement('p');solution.textContent='正解：'+choice(feedback.correctAnswers[i]).querySelector('span').textContent;item.append(solution);
      const explanation=document.createElement('p');explanation.textContent=feedback.explanations[i];item.append(explanation);list.append(item);
    });
    result.append(list);result.hidden=false;
  }
  function updateControls(){
    title.textContent=activePhase==='before'?'実験前クイズ':activePhase==='after'?'実験後クイズ':'確認クイズ';
    for(const input of form.querySelectorAll('input'))input.disabled=busy||!ready||!accepting;
    status.classList.toggle('error',noticeError);
    if(busy){button.type='submit';button.disabled=true;status.textContent='送信しています…';return;}
    if(!ready){button.type='button';button.disabled=checking;button.textContent=checking?'接続しています…':'接続をやり直す';status.textContent=notice;return;}
    button.type='submit';button.disabled=!accepting;
    button.textContent=accepting?(stored.receipts[currentKey()]?'回答を更新する':'回答を送信する'):'受付待ち';
    status.textContent=notice||(!accepting?'回答受付は停止中です。':stored.receipts[currentKey()]?'送信済み':'');
  }
  function render(){
    clearFeedback();const draft=stored.drafts[currentKey()]||[];
    ['q1','q2','q3'].forEach((name,i)=>{for(const field of form.elements[name])field.checked=field.value===draft[i];});
    updateControls();const previous=stored.submitted[currentKey()];
    if(previous&&JSON.stringify(previous.answers)===JSON.stringify(draft))showFeedback(previous);
  }
  function activateName(){
    const name=normalizeName(nameInput.value);nameInput.setCustomValidity('');
    if(!name)return;
    if(name.length>60||/[\u0000-\u001f\u007f]/.test(name)){nameInput.setCustomValidity('名前を60文字以内で入力してください。');return;}
    if(name===activeName)return;
    const unassigned=!activeName?answers():null;
    let profile=stored.profiles.find(p=>p.name===name);
    if(!profile){profile={name,participant:stored.profiles.length?uuid():stored.participant};stored.profiles.push(profile);}
    activeName=name;participant=profile.participant;stored.lastName=name;nameInput.value=name;
    for(const timing of ['before','after']){
      const old=classCode+'/'+timing,next=classCode+'/'+participant+'/'+timing;
      if(participant===stored.participant){
        if(stored.drafts[old]&&!stored.drafts[next])stored.drafts[next]=stored.drafts[old];
        if(stored.receipts[old]&&!stored.receipts[next])stored.receipts[next]=stored.receipts[old];
      }
    }
    if(unassigned&&unassigned.some(Boolean)&&!stored.drafts[currentKey()])stored.drafts[currentKey()]=unassigned;
    notice='';noticeError=false;save();render();
  }
  nameInput.value=typeof stored.lastName==='string'?stored.lastName:'';activateName();
  nameInput.addEventListener('change',activateName);
  nameInput.addEventListener('input',()=>{nameInput.setCustomValidity('');clearFeedback();});
  form.addEventListener('change',e=>{if(/^q[123]$/.test(e.target.name)){stored.drafts[currentKey()]=answers();save();clearFeedback();notice='';noticeError=false;updateControls();}});
  async function refresh(){
    if(checking||busy)return;checking=true;if(!ready)updateControls();
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(config.endpoint,{credentials:'omit',redirect:'follow',cache:'no-store',signal:controller.signal});
      const settings=await response.json();
      if(!response.ok||settings.version!==3||typeof settings.classCode!=='string'||!/^[A-Z0-9_-]{1,32}$/.test(settings.classCode)||![null,'before','after'].includes(settings.phase))throw new Error('configuration');
      if(busy)return;
      const changed=classCode!==settings.classCode||activePhase!==settings.phase,wasReady=ready,wasAccepting=accepting;
      classCode=settings.classCode;activePhase=settings.phase;accepting=settings.accepting===true&&activePhase!==null;ready=true;
      if(changed||!wasReady||wasAccepting!==accepting){notice='';noticeError=false;render();}
    }catch(_){
      if(!busy){ready=false;accepting=false;clearFeedback();notice='受付状況を確認できませんでした。もう一度お試しください。';noticeError=true;}
    }finally{clearTimeout(timeout);checking=false;if(!busy)updateControls();}
  }
  button.addEventListener('click',()=>{if(!ready&&!checking)refresh();});
  form.addEventListener('submit',async e=>{
    e.preventDefault();activateName();
    if(!ready||!accepting||busy||!activePhase||!form.reportValidity())return;
    if(!normalizeName(nameInput.value)){nameInput.setCustomValidity('名前を入力してください。');nameInput.reportValidity();return;}
    const payload={version:3,classCode,name:activeName,participant,phase:activePhase,answers:answers()},submissionKey=currentKey();
    const signature=JSON.stringify(payload);
    if(!stored.pending||stored.pending.signature!==signature)stored.pending={signature,id:uuid()};
    payload.submission=stored.pending.id;save();clearFeedback();busy=true;notice='';noticeError=false;updateControls();
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);let refreshNeeded=false;
    try{
      const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),credentials:'omit',redirect:'follow',signal:controller.signal});
      if(!response.ok)throw new Error('network');
      const receipt=await response.json();
      if(receipt.ok!==true||receipt.submission!==payload.submission)throw new Error(receipt.error||'unconfirmed');
      if(payload.phase==='after'&&!validFeedback(receipt.feedback))throw new Error('feedback');
      stored.receipts[submissionKey]=receipt.receivedAt;stored.pending=null;
      if(receipt.feedback)stored.submitted[submissionKey]=receipt.feedback;
      save();notice='送信しました。';
      if(payload.phase==='after'){showFeedback(receipt.feedback);result.focus({preventScroll:true});result.scrollIntoView({behavior:'smooth',block:'start'});}
    }catch(error){
      const messages={class:'受付する授業が変わりました。',phase:'受付するクイズが切り替わりました。',closed:'回答受付は停止中です。',full:'回答の保存先が上限に達しました。教員に知らせてください。'};
      notice=messages[error.message]||'送信完了を確認できませんでした。もう一度送信してください。';noticeError=true;
      if(['class','phase','closed'].includes(error.message)){refreshNeeded=true;ready=false;accepting=false;clearFeedback();}
    }finally{clearTimeout(timeout);busy=false;updateControls();if(refreshNeeded)refresh();}
  });
  const refreshIfVisible=()=>{if(!document.hidden&&!document.getElementById('view-quiz').hidden)refresh();};
  document.querySelectorAll('[data-view="quiz"]').forEach(el=>el.addEventListener('click',()=>refresh()));
  window.addEventListener('focus',refreshIfVisible);document.addEventListener('visibilitychange',refreshIfVisible);
  setInterval(refreshIfVisible,15000+Math.random()*5000);
  render();refresh();
})();
