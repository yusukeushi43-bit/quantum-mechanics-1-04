(() => {
  'use strict';
  const $=id=>document.getElementById(id), P=window.QuantumPhysics;
  const state={sigma:1,mean:0,chirp:0};
  let pin=null, samplePin=null, samples={x:[],p:[]}, toastTimer;
  const storageKey='quantum-yohaku-v1';
  let saved={records:[],reflection:'',prediction:null};
  try {const raw=JSON.parse(localStorage.getItem(storageKey)||'null');if(raw&&typeof raw==='object'){
    saved.records=Array.isArray(raw.records)?raw.records.filter(validState).slice(0,30):[];
    saved.reflection=typeof raw.reflection==='string'?raw.reflection:'';
    saved.prediction=['half','same','double'].includes(raw.prediction)?raw.prediction:null;
  }} catch(_){}
  function validState(s){return s&&Number.isFinite(s.sigma)&&s.sigma>=.35&&s.sigma<=2.5&&Number.isFinite(s.mean)&&Math.abs(s.mean)<=2&&Number.isFinite(s.chirp)&&s.chirp>=0&&s.chirp<=2;}
  let storageOK=true;
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch(_){if(storageOK)toast('このブラウザでは保存できません。記録はCSVで保存してください。');storageOK=false;}}
  function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
  const fmt=(v,n=2)=>Math.abs(v)<.5*10**(-n)?(0).toFixed(n):v.toFixed(n);
  const ns='http://www.w3.org/2000/svg';
  function el(tag,attrs={},content){const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(content!==undefined)e.textContent=content;return e;}
  function add(svg,tag,attrs,content){const n=el(tag,attrs,content);svg.append(n);return n;}
  function pathFor(fn,X,Y,min=-8,max=8,n=440){let d='';for(let i=0;i<=n;i++){const x=min+(max-min)*i/n;d+=(i?'L':'M')+X(x).toFixed(2)+','+Y(fn(x)).toFixed(2);}return d;}
  function plot(id,mean,sd,color,ymax,compare,label,delta){
    const svg=$(id);svg.replaceChildren();
    const w=Math.max(280,svg.getBoundingClientRect().width||620),h=w<500?190:w*184/620,left=35,right=14,top=18,bottom=36,base=h-bottom;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.style.aspectRatio=`${w}/${h}`;
    const X=x=>left+(x+8)/16*(w-left-right),Y=y=>base-y/ymax*(base-top);
    add(svg,'title',{},`${label}の確率密度。中心 ${fmt(mean)}、広がり ${fmt(sd)}。横軸の範囲は −8 から 8。`);
    for(let j=0;j<=3;j++){let val=ymax*j/3,y=Y(val);add(svg,'line',{x1:left,x2:w-right,y1:y,y2:y,stroke:'#ffffff',opacity:j?'.07':'.2','stroke-width':'.8'});add(svg,'text',{x:left-7,y:y+3,fill:'#b5bac6','font-size':'8','text-anchor':'end'},val.toFixed(1));}
    for(let x=-8;x<=8;x+=2){add(svg,'line',{x1:X(x),x2:X(x),y1:top,y2:base,stroke:'#fff',opacity:x===0?'.14':'.045','stroke-width':'.8'});add(svg,'text',{x:X(x),y:base+14,fill:'#b5bac6','font-size':'9','text-anchor':'middle'},x);}
    add(svg,'text',{x:left,y:8,fill:'#b5bac6','font-size':'8'},'確率密度');
    const d=pathFor(x=>P.density(x,mean,sd),X,Y);
    add(svg,'path',{d:d+`L${X(8)},${base}L${X(-8)},${base}Z`,fill:color,opacity:'.10'});
    const bandStart=Math.max(-8,mean-sd),bandEnd=Math.min(8,mean+sd);
    const band=pathFor(x=>P.density(x,mean,sd),X,Y,bandStart,bandEnd,120);
    add(svg,'path',{d:band+`L${X(bandEnd)},${base}L${X(bandStart)},${base}Z`,fill:color,opacity:'.19'});
    for(const x of [mean-sd,mean+sd])if(x>=-8&&x<=8)add(svg,'line',{x1:X(x),x2:X(x),y1:base,y2:Y(P.density(x,mean,sd)),stroke:color,opacity:'.55','stroke-dasharray':'3 4','stroke-width':'1'});
    if(compare){add(svg,'path',{d:pathFor(x=>P.density(x,compare.mean,compare.sd),X,Y),fill:'none',stroke:'#e8eaf0',opacity:'.55','stroke-width':'1.5','stroke-dasharray':'5 5'});}
    add(svg,'path',{d,fill:'none',stroke:color,'stroke-width':'2.2','stroke-linejoin':'round'});
    const barY=base-8;
    add(svg,'line',{x1:X(mean),x2:X(mean+sd),y1:barY,y2:barY,stroke:color,'stroke-width':'1.5'});
    for(const x of [mean,mean+sd])add(svg,'line',{x1:X(x),x2:X(x),y1:barY-3,y2:barY+3,stroke:color,'stroke-width':'1.5'});
    add(svg,'text',{x:X(mean+sd/2),y:barY-6,fill:color,'font-family':'Georgia,serif','font-size':'11','text-anchor':'middle'},delta);
    add(svg,'text',{x:(w+left-right)/2,y:h-3,fill:'#b5bac6','font-size':'9','text-anchor':'middle'},label==='位置'?'位置 x / L':'運動量 pₓ / (ℏ/L)');
  }
  function updateState(reset=true){
    if(reset)samples={x:[],p:[]};
    const sp=P.momentumSD(state.sigma,state.chirp),product=state.sigma*sp;
    $('measure-sigma').value=state.sigma;$('measure-sigma-output').textContent=fmt(state.sigma);$('sigma').value=state.sigma;$('mean').value=state.mean;$('chirp').value=state.chirp;
    $('mobile-sigma').value=state.sigma;$('mobile-output').textContent=fmt(state.sigma);$('sigma-output').textContent=fmt(state.sigma);$('mean-output').textContent=fmt(state.mean);$('chirp-output').textContent=fmt(state.chirp);
    $('read-x').textContent=fmt(state.sigma);$('read-p').textContent=fmt(sp);$('read-product').textContent=fmt(product,3);
    $('bound-label').textContent=state.chirp===0?'下限 0.5 に一致':'下限 0.5 より大きい';
    document.querySelectorAll('[data-sigma]').forEach(b=>b.classList.toggle('selected',Math.abs(+b.dataset.sigma-state.sigma)<.001));
    plot('position-plot',0,state.sigma,'#8d9aff',1.2,pin?{mean:0,sd:pin.sigma}:null,'位置','Δx');
    plot('momentum-plot',state.mean,sp,'#ff8e96',2.1,pin?{mean:pin.mean,sd:P.momentumSD(pin.sigma,pin.chirp)}:null,'運動量','Δpₓ');
    $('pin-legend').hidden=!pin;$('clear-pin').hidden=!pin;
    $('pin-state').textContent=pin?'比較を今の分布に更新':'＋ 今の分布を残す';
    $('measure-state').textContent=`Δx = ${fmt(state.sigma)} · Δpₓ = ${fmt(sp)} · p₀ = ${fmt(state.mean)}`;
    updateHistogram();
  }
  [['measure-sigma','sigma'],['sigma','sigma'],['mobile-sigma','sigma'],['mean','mean'],['chirp','chirp']].forEach(([id,key])=>$(id).addEventListener('input',e=>{state[key]=+e.target.value;updateState();}));
  document.querySelectorAll('[data-sigma]').forEach(b=>b.addEventListener('click',()=>{state.sigma=+b.dataset.sigma;updateState();}));
  $('reset-state').addEventListener('click',()=>{Object.assign(state,{sigma:1,mean:0,chirp:0});pin=null;updateState();toast('初期値に戻しました。');});
  $('pin-state').addEventListener('click',()=>{pin={...state};updateState(false);toast('分布を比較用に残しました。');});
  $('clear-pin').addEventListener('click',()=>{pin=null;updateState(false);});
  function view(name,scroll=true){
    if(!['explore','measure','quiz'].includes(name))name='explore';
    document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!=='view-'+name);
    document.querySelectorAll('.main-nav [data-view]').forEach(b=>{const active=b.dataset.view===name;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    try {history.replaceState(null,'','#'+name);}catch(_){}
    if(name==='explore')updateState(false);else if(name==='measure')updateHistogram();
    if(scroll)$('view-'+name).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  }
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
  window.addEventListener('hashchange',()=>view(location.hash.slice(1),false));
  $('reflection').value=saved.reflection;
  $('reflection').addEventListener('input',e=>{saved.reflection=e.target.value;persist();});
  function renderRecords(){
    const body=$('records-body');body.replaceChildren();
    if(!saved.records.length){const row=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.className='empty';td.textContent='記録はありません。';row.append(td);body.append(row);}
    saved.records.forEach((s,i)=>{const row=document.createElement('tr');const sp=P.momentumSD(s.sigma,s.chirp);[`${i+1}`,fmt(s.sigma),fmt(sp,3),fmt(s.mean),fmt(s.chirp),fmt(s.sigma*sp,3)].forEach(value=>{const td=document.createElement('td');td.textContent=value;row.append(td);});const td=document.createElement('td'),button=document.createElement('button');button.className='text-button';button.textContent='再現 ↗';button.setAttribute('aria-label',`条件${i+1}を再現`);button.addEventListener('click',()=>{Object.assign(state,s);updateState();$('view-explore').scrollIntoView({behavior:'smooth'});toast(`条件 ${i+1} を再現しました。`);});td.append(button);row.append(td);body.append(row);});
    $('download-csv').disabled=!saved.records.length;$('clear-records').disabled=!saved.records.length;
  }
  $('record-state').addEventListener('click',()=>{if(saved.records.length>=30){toast('記録は30件までです。CSVを保存してから記録を消してください。');return;}saved.records.push({...state});persist();renderRecords();$('record-status').textContent=`条件 ${saved.records.length} を記録しました。`;toast(`条件 ${saved.records.length} を記録しました。`);});
  $('clear-records').addEventListener('click',()=>{saved.records=[];persist();renderRecords();$('record-status').textContent='記録を消しました。';});
  $('download-csv').addEventListener('click',()=>{const rows=[['条件','位置の標準偏差 Δx/L','運動量の標準偏差 Δpₓ/(ℏ/L)','運動量の中心 p₀/(ℏ/L)','位相の曲がり C','不確定性の積 ΔxΔpₓ/ℏ']];saved.records.forEach((s,i)=>{const sp=P.momentumSD(s.sigma,s.chirp);rows.push([i+1,s.sigma,sp,s.mean,s.chirp,s.sigma*sp]);});const blob=new Blob(['\uFEFF'+rows.map(r=>r.join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='量子力学Ⅰ_第4回_実験記録.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);});
  function updateHistogram(){
    const n=samples.x.length,revealed=n>=10000;
    $('sample-count').replaceChildren(document.createTextNode(n.toLocaleString('ja-JP')),Object.assign(document.createElement('small'),{textContent:' / 10,000 回'}));
    $('dock-count').textContent=`各 ${n.toLocaleString('ja-JP')} 回`;
    $('measure-dock').classList.toggle('complete',revealed);
    $('sample-progress').value=n;
    $('pin-samples').disabled=n<2;
    $('clear-sample-pin').hidden=!samplePin;
    $('sample-pin-status').hidden=!samplePin;
    document.querySelectorAll('.sample-pin-key').forEach(e=>e.hidden=!samplePin);
    if(samplePin)$('sample-pin-status').textContent=`破線：Δx = ${fmt(samplePin.state.sigma)}、Δpₓ = ${fmt(P.momentumSD(samplePin.state.sigma,samplePin.state.chirp))} ／ ${samplePin.x.length.toLocaleString('ja-JP')}回`;

    ['sample-one','sample-ten','sample-hundred','sample-thousand'].forEach(id=>$(id).disabled=revealed);
    document.querySelectorAll('[data-measure-count]').forEach(b=>b.disabled=revealed);
    document.querySelectorAll('.theory-key').forEach(e=>e.hidden=!revealed);
    $('reveal-note').classList.toggle('revealed',revealed);
    $('reveal-note').textContent=revealed?'理論曲線を表示中':'10,000回で理論曲線を表示';
    drawHistogram('x',revealed);drawHistogram('p',revealed);
  }
  function drawHistogram(quantity,revealed){
    const values=samples[quantity],isX=quantity==='x',sd=isX?state.sigma:P.momentumSD(state.sigma,state.chirp),mean=isX?0:state.mean;
    const n=values.length,summary=P.stats(values),color=isX?'#8d9aff':'#ff8e96',fill=isX?'#5863aa':'#a95765';
    $('sample-last-'+quantity).textContent=n?`直近：${fmt(values[n-1],3)}`:'未測定';
    const theory=$('theory-sd-'+quantity);theory.textContent=revealed?fmt(sd,3):'—';theory.classList.toggle('awaiting-theory',!revealed);
    $('sample-sd-'+quantity).textContent=summary.sd===null?'—':fmt(summary.sd,3);
    $('sample-mean-'+quantity).textContent=summary.mean===null?'—':fmt(summary.mean,3);
    const svg=$('histogram-'+quantity);svg.replaceChildren();
    const w=Math.max(280,svg.getBoundingClientRect().width||500),compact=matchMedia('(max-width:850px)').matches,h=compact?190:330,left=40,right=18,top=25,base=h-38,max=8,min=-8;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.style.aspectRatio=`${w}/${h}`;
    const histogram=P.bins(values,min,max,48),densities=histogram.bins.map(v=>n?v/(n*histogram.width):0);
    const ymax=2.2;
    const X=x=>left+(x-min)/(max-min)*(w-left-right),Y=y=>base-Math.min(y,ymax)/ymax*(base-top);
    add(svg,'title',{},`${isX?'位置':'運動量'}を${n}回測定。標本標準偏差 ${summary.sd===null?'未計算':fmt(summary.sd,3)}。${revealed?'理論の正規分布を表示。':'理論の曲線は10,000回で表示。'}`);
    for(let j=0;j<=4;j++){const y=j*.5;add(svg,'line',{x1:left,x2:w-right,y1:Y(y),y2:Y(y),stroke:'#3a3e48','stroke-width':'.8'});add(svg,'text',{x:left-7,y:Y(y)+3,fill:'#b5bac6','font-size':'10','text-anchor':'end'},fmt(y,2));}
    add(svg,'text',{x:left,y:12,fill:'#b5bac6','font-size':'10'},'確率密度');
    for(let x=-8;x<=8;x+=2)add(svg,'text',{x:X(x),y:base+18,fill:'#b5bac6','font-size':'11','text-anchor':'middle'},x);
    densities.forEach((v,i)=>{if(v>0)add(svg,'rect',{x:X(min+i*histogram.width)+1,y:Y(v),width:(w-left-right)/48-2,height:base-Y(v),fill,rx:'1'});});
    densities.forEach((v,i)=>{if(v>ymax){const x=X(min+(i+.5)*histogram.width);add(svg,'path',{d:`M${x-4},${top+6}L${x},${top}L${x+4},${top+6}Z`,fill:color,'data-overflow':'true'});}});
    if(samplePin){
      const previous=P.bins(samplePin[quantity],min,max,48),previousN=samplePin[quantity].length;
      let d=`M${X(min)},${base}`;
      previous.bins.forEach((v,i)=>{const y=Y(v/(previousN*previous.width));d+=`L${X(min+i*previous.width)},${y}L${X(min+(i+1)*previous.width)},${y}`;});
      d+=`L${X(max)},${base}`;
      add(svg,'path',{d,fill:'none',stroke:'#ebedf2',opacity:'.8','stroke-width':'1.6','stroke-dasharray':'4 3','data-comparison':'true'});
    }
    if(revealed)add(svg,'path',{d:pathFor(x=>P.density(x,mean,sd),X,Y),fill:'none',stroke:color,'stroke-width':'2.5','data-theory-curve':'true'});
    if(n===1&&values[0]>=min&&values[0]<=max)add(svg,'circle',{cx:X(values[0]),cy:base+3,r:4,fill:color});
    if(!n)add(svg,'text',{x:(w+left-right)/2,y:base/2,fill:'#b5bac6','font-size':'12','text-anchor':'middle'},'測定結果');
    add(svg,'text',{x:(w+left-right)/2,y:h-3,fill:'#b5bac6','font-size':'11','text-anchor':'middle'},isX?'位置 x / L':'運動量 pₓ / (ℏ/L)');
    const notes=[];
    if(densities.some(v=>v>ymax))notes.push('▲ 縦軸の上限を超える値');
    if(histogram.outside)notes.push(`範囲外：${histogram.outside}回`);
    $('sample-message-'+quantity).textContent=notes.join(' ／ ');
    $('sample-message-'+quantity).hidden=!notes.length;
  }
  function measure(count){
    const total=Math.min(count,10000-samples.x.length),sp=P.momentumSD(state.sigma,state.chirp);
    for(let i=0;i<total;i++){samples.x.push(P.normal(0,state.sigma));samples.p.push(P.normal(state.mean,sp));}
    updateHistogram();
    if(total&&samples.x.length===10000)toast('10,000回：理論曲線を表示しました。');
  }
  $('sample-one').addEventListener('click',()=>measure(1));$('sample-ten').addEventListener('click',()=>measure(10));$('sample-hundred').addEventListener('click',()=>measure(100));$('sample-thousand').addEventListener('click',()=>measure(1000));
  document.querySelectorAll('[data-measure-count]').forEach(button=>button.addEventListener('click',()=>measure(+button.dataset.measureCount)));
  $('reset-samples').addEventListener('click',()=>{samples={x:[],p:[]};updateHistogram();toast('測定をリセットしました。');});
  $('pin-samples').addEventListener('click',()=>{samplePin={state:{...state},x:[...samples.x],p:[...samples.p]};updateHistogram();toast('測定結果を比較用に残しました。');});
  $('clear-sample-pin').addEventListener('click',()=>{samplePin=null;updateHistogram();});
  if('IntersectionObserver' in window){new IntersectionObserver(entries=>{const entry=entries[0];$('mobile-dock').hidden=!entry.isIntersecting;},{threshold:0.1}).observe(document.querySelector('.graph-panel'));new IntersectionObserver(entries=>{$('measure-dock').hidden=!entries[0].isIntersecting;},{threshold:0.05}).observe(document.querySelector('.histogram-grid'));}
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!$('view-explore').hidden)updateState(false);else updateHistogram();},100);});
  updateState(false);renderRecords();view(location.hash.slice(1)||'explore',false);
})();
