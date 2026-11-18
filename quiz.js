(() => {
  'use strict';
  const form=document.getElementById('class-quiz'),status=document.getElementById('submission-status'),button=document.getElementById('submit-quiz'),nameInput=document.getElementById('student-name'),result=document.getElementById('quiz-explanation');
  const config=window.QuantumQuizConfig||{},key='quantum-class-quiz-v1',uuid=()=>crypto.randomUUID(),isID=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
  let stored={participant:uuid(),receipts:{},drafts:{},profiles:[],submitted:{},lastName:'',pending:null};
  try{const value=JSON.parse(localStorage.getItem(key));if(value&&isID(value.participant))stored={...stored,...value};}catch(_){}
  stored.profiles=Array.isArray(stored.profiles)?stored.profiles.filter(p=>p&&typeof p.name==='string'&&isID(p.participant)):[];
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(stored));}catch(_){}};
  let classCode=config.defaultClass||'QM1-04',activeName='',participant=stored.participant,ready=false,connecting=false,accepting=true;
  const phase=()=>form.elements.phase.value,answers=()=>['q1','q2','q3'].map(name=>form.elements[name].value);
  const currentKey=()=>classCode+'/'+participant+'/'+phase();
  const normalizeName=value=>value.trim().replace(/\s+/g,' ');
  const explanations=['C = 0 では ΔxΔpₓ = ℏ/2。','測定回数を増やしても、状態の広がりは一定です。','分布全体の面積が1なので、広がるほど山は低くなります。'];
  function clearFeedback(){result.hidden=true;result.replaceChildren();form.querySelectorAll('.answer-correct,.answer-incorrect').forEach(e=>e.classList.remove('answer-correct','answer-incorrect'));}
  function validFeedback(f){return f&&Array.isArray(f.answers)&&Array.isArray(f.correctAnswers)&&f.answers.length===3&&f.correctAnswers.length===3&&[...f.answers,...f.correctAnswers].every(a=>['a','b','c'].includes(a))&&Number.isInteger(f.score)&&f.score===f.answers.filter((a,i)=>a===f.correctAnswers[i]).length;}
  function showFeedback(feedback){
    clearFeedback();if(phase()!=='after'||!validFeedback(feedback))return;
    const heading=document.createElement('h3');heading.textContent=`3問中 ${feedback.score}問正解`;result.append(heading);
    const list=document.createElement('ol');list.className='result-list';
    feedback.answers.forEach((answer,i)=>{
      const correct=answer===feedback.correctAnswers[i],item=document.createElement('li'),title=document.createElement('strong');
      item.className=correct?'result-correct':'result-incorrect';title.textContent=`問${i+1}　${correct?'○ 正解':'× 不正解'}`;item.append(title);
      const fields=[...form.elements['q'+(i+1)]],choice=code=>fields.find(f=>f.value===code).closest('label');
      choice(feedback.correctAnswers[i]).classList.add('answer-correct');if(!correct)choice(answer).classList.add('answer-incorrect');
      if(!correct){const selected=document.createElement('p');selected.className='chosen-answer';selected.textContent='あなたの回答：'+choice(answer).querySelector('span').textContent;item.append(selected);}
      const solution=document.createElement('p');solution.textContent='正解：'+choice(feedback.correctAnswers[i]).querySelector('span').textContent;item.append(solution);
      const explanation=document.createElement('p');explanation.textContent=explanations[i];item.append(explanation);list.append(item);
    });
    result.append(list);result.hidden=false;
  }
  function render(){
    clearFeedback();
    const draft=stored.drafts[currentKey()]||[];
    ['q1','q2','q3'].forEach((name,i)=>{for(const field of form.elements[name])field.checked=field.value===draft[i];});
    const receipt=stored.receipts[currentKey()];
    if(ready){status.classList.remove('error');status.textContent=accepting?(receipt?'送信済み':''):'回答受付は終了しています。';button.textContent=receipt?'回答を更新する':'回答を送信する';button.disabled=!accepting;}
    const previous=stored.submitted[currentKey()];
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
    save();render();
  }
  nameInput.value=typeof stored.lastName==='string'?stored.lastName:'';
  activateName();
  nameInput.addEventListener('change',activateName);
  nameInput.addEventListener('input',()=>{nameInput.setCustomValidity('');clearFeedback();});
  for(const field of form.elements.phase)field.addEventListener('change',render);
  form.addEventListener('change',e=>{if(/^q[123]$/.test(e.target.name)){stored.drafts[currentKey()]=answers();save();clearFeedback();}});
  async function connect(){
    if(connecting)return;connecting=true;button.disabled=true;status.textContent='接続しています…';status.classList.remove('error');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch(config.endpoint,{credentials:'omit',redirect:'follow',cache:'no-store',signal:controller.signal});
      const settings=await response.json();
      if(!response.ok||settings.version!==2||typeof settings.classCode!=='string'||!/^[A-Z0-9_-]{1,32}$/.test(settings.classCode))throw new Error('configuration');
      classCode=settings.classCode;accepting=settings.accepting===true;ready=true;button.type='submit';render();
    }catch(_){ready=false;button.type='button';button.textContent='接続をやり直す';button.disabled=false;status.textContent='接続できませんでした。もう一度お試しください。';status.classList.add('error');}
    finally{clearTimeout(timeout);connecting=false;}
  }
  button.addEventListener('click',()=>{if(!ready&&!connecting)connect();});
  form.addEventListener('submit',async e=>{
    e.preventDefault();activateName();
    if(!ready||button.disabled||!form.reportValidity())return;
    if(!normalizeName(nameInput.value)){nameInput.setCustomValidity('名前を入力してください。');nameInput.reportValidity();return;}
    const payload={version:2,classCode,name:activeName,participant,phase:phase(),answers:answers()};
    const signature=JSON.stringify(payload);
    if(!stored.pending||stored.pending.signature!==signature)stored.pending={signature,id:uuid()};
    payload.submission=stored.pending.id;save();clearFeedback();
    const fields=[...form.querySelectorAll('input')];fields.forEach(el=>el.disabled=true);button.disabled=true;
    status.textContent='送信しています…';status.classList.remove('error');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),credentials:'omit',redirect:'follow',signal:controller.signal});
      if(!response.ok)throw new Error('network');
      const receipt=await response.json();
      if(receipt.ok!==true||receipt.submission!==payload.submission)throw new Error(receipt.error||'unconfirmed');
      if(payload.phase==='after'&&!validFeedback(receipt.feedback))throw new Error('feedback');
      stored.receipts[currentKey()]=receipt.receivedAt;stored.pending=null;
      if(receipt.feedback)stored.submitted[currentKey()]=receipt.feedback;
      save();status.textContent='送信しました。';button.textContent='回答を更新する';
      if(payload.phase==='after'){showFeedback(receipt.feedback);result.focus({preventScroll:true});result.scrollIntoView({behavior:'smooth',block:'start'});}
    }catch(error){
      const messages={class:'受付する授業が変わりました。ページを再読み込みしてください。',closed:'この授業の回答受付は終了しています。',full:'回答の保存先が上限に達しました。教員に知らせてください。'};
      status.textContent=messages[error.message]||'送信完了を確認できませんでした。もう一度送信してください。';status.classList.add('error');
    }finally{clearTimeout(timeout);fields.forEach(el=>el.disabled=false);button.disabled=false;}
  });
  render();connect();
})();
