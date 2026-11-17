(() => {
  'use strict';
  const form=document.getElementById('class-quiz'), status=document.getElementById('submission-status'), button=document.getElementById('submit-quiz');
  const config=window.QuantumQuizConfig||{}, key='quantum-class-quiz-v1';
  const uuid=()=>crypto.randomUUID();
  let stored={participant:uuid(),receipts:{},drafts:{},pending:null};
  try{const value=JSON.parse(localStorage.getItem(key));if(value&&/^[a-f0-9-]{36}$/.test(value.participant)){stored={...stored,...value};}}catch(_){}
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(stored));}catch(_){}};
  save();
  const classInput=document.getElementById('class-code');
  classInput.value=stored.classCode||config.defaultClass||'QM1-04';
  const phase=()=>form.elements.phase.value;
  const currentKey=()=>classInput.value.trim().toUpperCase()+'/'+phase();
  function render(){
    document.getElementById('quiz-explanation').hidden=true;
    const answers=stored.drafts[currentKey()]||[];
    ['q1','q2','q3'].forEach((name,i)=>{for(const field of form.elements[name])field.checked=field.value===answers[i];});
    const receipt=stored.receipts[currentKey()];
    status.textContent=receipt?'送信済み':'';
    button.textContent=receipt?'回答を更新する':'回答を送信する';
    if(!config.endpoint){button.disabled=true;status.textContent='集計の接続を準備しています。回答の送信はまだできません。';}
  }
  classInput.addEventListener('change',()=>{classInput.value=classInput.value.trim().toUpperCase();stored.classCode=classInput.value;save();render();});
  for(const field of form.elements.phase)field.addEventListener('change',render);
  form.addEventListener('change',e=>{if(/^q[123]$/.test(e.target.name)){stored.drafts[currentKey()]=['q1','q2','q3'].map(name=>form.elements[name].value);save();}});
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!config.endpoint||button.disabled||!form.reportValidity())return;
    const payload={version:1,classCode:classInput.value.trim().toUpperCase(),participant:stored.participant,phase:phase(),answers:['q1','q2','q3'].map(name=>form.elements[name].value)};
    const signature=JSON.stringify(payload);
    if(!stored.pending||stored.pending.signature!==signature)stored.pending={signature,id:uuid()};
    payload.submission=stored.pending.id;save();
    const fields=[...form.querySelectorAll('input')];fields.forEach(el=>el.disabled=true);button.disabled=true;
    status.textContent='送信しています…';status.classList.remove('error');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),credentials:'omit',redirect:'follow',signal:controller.signal});
      if(!response.ok)throw new Error('network');
      const receipt=await response.json();
      if(receipt.ok!==true||receipt.submission!==payload.submission)throw new Error(receipt.error||'unconfirmed');
      stored.receipts[payload.classCode+'/'+payload.phase]=receipt.receivedAt;stored.pending=null;save();
      status.textContent='送信しました。';
      button.textContent='回答を更新する';
      document.getElementById('quiz-explanation').hidden=payload.phase!=='after';
    }catch(error){
      const messages={class:'授業コードを確認してください。このコードでは受付していません。',closed:'この授業の回答受付は終了しています。',full:'回答の保存先が上限に達しました。教員に知らせてください。'};
      status.textContent=messages[error.message]||'送信完了を確認できませんでした。通信を確認して、もう一度送信してください。再送しても回答数は増えません。';status.classList.add('error');
    }finally{clearTimeout(timeout);fields.forEach(el=>el.disabled=false);button.disabled=false;}
  });
  render();
})();
