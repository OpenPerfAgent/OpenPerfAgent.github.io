import {openFullTrace} from './full-trace.js';
const COLOR_TOKENS=['compute','transfer','transfer','other','host','scope','compute'];
const color=(styles,token)=>styles.getPropertyValue('--timeline-'+token).trim();
const TYPES=['GPU kernel','Host → GPU','GPU → host','Other device work','CPU cuDNN call','Stage scope','NaN-fill kernel'];
const CASES={
 ultralytics:{title:'Filling memory before overwriting it',subtitle:'YOLO26x · baseline · GPU stream 7 · 6 ms excerpt',source:'13F2sARH2xuz2HaPpR0XeibacstaU1TfH',rows:['GPU stream 7'],
 views:[['Excerpt',0,6,'Highlighted kernels fill tensors with NaN. Muted bars show the other GPU work on the same stream.']],
 note:'Actual interval 3–9 ms into ProfilerStep#40. Fill kernels are matched to CPU aten::fill_(NaN) calls by External id.'},
 fastvideo:{title:'Where the generation time goes',subtitle:'FastVideo · baseline · GPU stream 7',source:'1Or8Hyhtp5kLCmcySGfgnAh1J7u419aBe',rows:['GPU stream 7'],
 views:[],
 note:'Rank-0 baseline, conditioning through audio decoding. Percentages describe this displayed interval, not the complete request or all ranks. Stage bars are scopes, not GPU utilization.' },
 funasr:{title:'When the GPU waits for the host',subtitle:'Fun-ASR-Nano · baseline · three aligned tracks',source:'1-iYephBIEGfgrbaugJdMKJHsxvJXYAht',rows:['Forward thread','Backward thread','GPU stream 7'],
 views:[['Two steps',0,1365.686,'Compare the short normal step with the slow step: CPU calls stretch while GPU activity stays sparse.'],['Forward',220,715,'The cuDNN forward call spans 444 ms. Compare its duration with GPU work directly below.'],['Backward',715,1320,'The cuDNN backward call spans 554 ms, again with little GPU activity beneath it.']],
 note:'CPU lanes show cuDNN attention calls only; blank space omits other CPU work. Plan creation is not separately instrumented.'}
};
const duration=n=>n>=1000?`${(n/1000).toFixed(2)} s`:n>=1?`${n.toFixed(2)} ms`:`${(n*1000).toFixed(2)} µs`;
async function mount(root){
 const key=root.dataset.traceCase;if(!CASES[key])return;
 const compactFastVideo=key==='fastvideo'&&document.body.classList.contains('mlsys-draft');
 const c={...CASES[key],rows:compactFastVideo?['GPU stream']:key==='funasr'&&document.body.classList.contains('mlsys-draft')?['Forward thread on CPU','Backward thread on CPU','GPU stream']:CASES[key].rows};
 const tokens=[...COLOR_TOKENS];
 if(compactFastVideo){tokens[2]='return-transfer';root.style.setProperty('--timeline-return-transfer','#b18cbc');}
 root.classList.add('trace-figure');
 root.innerHTML=`<header class="trace-heading"><span class="trace-figure-number">${key==='fastvideo'?'TRACE 01':key==='funasr'?'TRACE 02':'TRACE 03'}</span><h5>${c.title}</h5></header><div class="trace-eyebrow">${c.subtitle}</div><p class="trace-story"></p><div class="trace-chart"><canvas tabindex="0" role="img" aria-label="${c.subtitle}. Ctrl/Command + scroll to zoom; drag to pan. Arrow keys inspect GPU events."></canvas></div><div class="trace-stages" aria-label="Pipeline stages"></div><div class="trace-legend"></div><div class="trace-detail" aria-live="polite"><span>Preparing trace…</span></div><div class="trace-foot"><nav><a class="trace-full" href="https://ui.perfetto.dev" target="_blank">Open in Perfetto ↗</a><a href="https://drive.google.com/file/d/${c.source}/view" target="_blank" rel="noopener">Source trace ↗</a></nav><span class="trace-status" role="status"></span></div>`;
 if(document.body.classList.contains('mlsys-draft')&&(key==='fastvideo'||key==='funasr')){
  root.querySelector('.trace-heading h5').remove();root.querySelector('.trace-eyebrow').remove();
  root.querySelector('.trace-full').textContent='Open raw trace in Perfetto ↗';
  root.querySelector('.trace-foot nav a:not(.trace-full)').remove();
 }
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),detail=root.querySelector('.trace-detail'),story=root.querySelector('.trace-story');
 root.querySelector('.trace-full').onclick=e=>{e.preventDefault();openFullTrace(key,root.querySelector('.trace-status'));};
 const legend=root.querySelector('.trace-legend');

 let data;try{data=(await import(`./data/${key}-timeline.js`)).default;}catch{detail.textContent='Trace preview could not load. The original is available at the source link below.';return;}
 const presentTypes=new Set(data.rows.flatMap(row=>row.map(event=>event[3])));
 const combineTransfers=key==='funasr'&&document.body.classList.contains('mlsys-draft');
 const typeLabel=i=>combineTransfers&&(i===1||i===2)?'Data transfer':TYPES[i];
 for(const i of [6,4,0,1,2,3].filter(i=>presentTypes.has(i)&&!(combineTransfers&&i===2&&presentTypes.has(1)))){const item=document.createElement('span');item.innerHTML=`<i style="background:var(--timeline-${key==='ultralytics'&&i===0?'scope':tokens[i]})"></i>${key==='ultralytics'&&i===0?'Other GPU kernels':typeLabel(i)}`;legend.append(item);}
 if(key==='fastvideo'){
  const stage=name=>data.stages.find(e=>data.names[e[2]].includes(name));
  const dec=stage('VideoDecoding'),den=stage('Denoising'),offset=(6016039389707.752-data.origin_us)/1000;
  c.views=[['All stages',0,data.duration,'Video decoding occupies most of this trace; the transfers beneath it explain where the time goes.'],['Denoising',den[0],den[0]+den[1],'Denoising spans 3.08 seconds. Video decoding takes almost three times as long.'],['Video decoding',dec[0],dec[0]+dec[1],'Most of this stage is host–GPU data movement. Empty space is time with no recorded device event on this stream.'],['One copy',offset+6290,offset+6345,'One 64 MiB pageable transfer takes 30.83 ms. Hover the transfer bar for the recorded event.']];
  const m=data.metrics,metrics=document.createElement('div');metrics.className='trace-metrics';
  metrics.innerHTML=`<span><b>${duration(m.decode_ms)}</b> video decoding <em>${Math.round(m.decode_ms/m.span_ms*100)}% of shown time</em></span><span><b>${duration(m.copy_ms)}</b> host ↔ GPU copies <em>${Math.round(m.copy_ms/m.decode_ms*100)}% of decoding</em></span>`;
  root.querySelector('.trace-legend').after(metrics);
  if(!compactFastVideo)data.stages.forEach((e,i)=>{const item=document.createElement('span');item.innerHTML=`<b>${i+1}</b> ${stageName(e)} <small>${duration(e[1])}</small>`;root.querySelector('.trace-stages').append(item);});
 }
 if(key==='ultralytics'){
  const note=document.createElement('p');note.className='trace-story';note.textContent=`${data.metrics.nan_fills} NaN-fill kernels · 3–9 ms into recorded step 40. Identified through the matching CPU aten::fill_(NaN) calls.`;root.querySelector('.trace-legend').after(note);
 }
 let start=0,end=data.duration,width=0,height=0,hit=[],selected=null,keyboardIndex=0;
 const left=()=>12;
 const stageTop=compactFastVideo?98:66;
 const rowTop=i=>(key==='fastvideo'?(compactFastVideo?194:154):112)+i*82;
 function stageName(e){return data.names[e[2]].replace('stage:MiniMaxH3','').replace('Stage','').replace('VideoDecoding','Video decoding').replace('AudioDecoding','Audio decoding').replace('LatentPreparation','Latent prep');}
 function fits(text,w){return ctx.measureText(text).width+14<=w;}
 const position=t=>left()+(t-start)/(end-start)*(width-left()-18);

 function show(e,row){
  selected=e?[e,row]:null;detail.replaceChildren();
  if(!e){const s=document.createElement('span');s.textContent=key==='ultralytics'?'Hover a kernel to inspect it. Click to hold details.':'Hover a stage or event to inspect it. Click to hold details.';detail.append(s);return;}
  const name=document.createElement('strong');name.textContent=data.names[e[2]];
  const meta=document.createElement('span');meta.textContent=`${row===-1?'Pipeline stage':c.rows[row]} · ${typeLabel(e[3])} · ${duration(e[1])}${e[4]?` · ${(e[4]/1048576).toFixed(2)} MiB`:''} · starts at ${duration(e[0])}`;
  detail.append(name,meta);
 }
 function draw(){
  const styles=getComputedStyle(root),ink=styles.color;
  const colors=tokens.map(token=>color(styles,token)),barInk=color(styles,'bar-ink');
  if(key==='ultralytics')colors[0]=color(styles,'scope');
  ctx.clearRect(0,0,width,height);ctx.font='12px ui-monospace, SFMono-Regular, Menlo, monospace';ctx.textBaseline='middle';
  const l=left(),plot=width-l-18;
  const ticks=width<420?2:4;
  for(let i=0;i<=ticks;i++){let x=l+plot*i/ticks;ctx.strokeStyle='rgba(130,145,140,.18)';ctx.beginPath();ctx.moveTo(x,34);ctx.lineTo(x,height-12);ctx.stroke();ctx.fillStyle=ink;ctx.textAlign=i===ticks?'right':'left';ctx.fillText(duration(start+(end-start)*i/ticks),x,18);}
  ctx.textAlign='left';
  hit=[];
  if(key==='fastvideo'){
   ctx.fillStyle=ink;ctx.fillText('PIPELINE STAGES',l,50);
   const labels=[];
   for(const [index,e] of data.stages.entries()){
    const x=Math.max(l,position(e[0])),right=Math.min(width-18,position(e[0]+e[1]));if(right<=x)continue;
    const w=right-x,label=`${index+1}  ${stageName(e)}`;
    ctx.fillStyle=color(styles,index===3?'scope-emphasis':'scope');ctx.fillRect(x,stageTop,Math.max(.5,w-1),30);hit.push([x,stageTop,w,30,e,-1]);
    if(compactFastVideo){labels.push({e,index,anchor:(x+right)/2,text:stageName(e)});}
    else{
     ctx.fillStyle=barInk;const text=fits(label,w)?label:fits(String(index+1),w)?String(index+1):'';
     if(text)ctx.fillText(text,x+7,81);
    }
   }
   if(compactFastVideo){
    ctx.font='11px ui-monospace, SFMono-Regular, Menlo, monospace';
    for(const below of [false,true]){
     const lane=labels.filter(item=>(item.index===1||item.index===4)===below);
     let next=l;
     for(const item of lane){
      item.w=ctx.measureText(item.text).width;
      item.x=Math.max(next,Math.min(width-18-item.w,item.anchor-item.w/2));
      next=item.x+item.w+12;
     }
     let edge=width-18;
     for(const item of [...lane].reverse()){item.x=Math.min(item.x,edge-item.w);edge=item.x-12;}
     for(const item of lane){
      const y=below?150:76,tip=below?stageTop+30:stageTop;
      const labelCenter=item.x+item.w/2;
      ctx.strokeStyle=ink;ctx.globalAlpha=.5;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(item.anchor,tip);ctx.lineTo(item.anchor,below?tip+6:tip-6);ctx.lineTo(labelCenter,below?y-9:y+9);ctx.stroke();ctx.globalAlpha=1;
      ctx.fillStyle=ink;ctx.fillText(item.text,item.x,y);
      hit.push([item.x,y-9,item.w,18,item.e,-1]);
     }
    }
   }
  }
  if(key==='funasr')for(const s of data.steps){
   const x=Math.max(l,position(s[0])),right=Math.min(width-18,position(s[0]+s[1]));
   if(right>x){
    const normal=s[2].endsWith('#8');
    if(document.body.classList.contains('mlsys-draft')){
     const label=normal?'Normal step':'Slow step';
     ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.globalAlpha=.55;
     const braceLeft=x+1,braceRight=right-1,braceMid=(x+right)/2;
     const curl=Math.min(7,(braceRight-braceLeft)/6);
     ctx.beginPath();ctx.moveTo(braceLeft,73);
     ctx.bezierCurveTo(braceLeft,66,braceLeft+curl/2,66,braceLeft+curl,66);
     ctx.lineTo(braceMid-curl,66);
     ctx.bezierCurveTo(braceMid-curl/2,66,braceMid,66,braceMid,60);
     ctx.bezierCurveTo(braceMid,66,braceMid+curl/2,66,braceMid+curl,66);
     ctx.lineTo(braceRight-curl,66);
     ctx.bezierCurveTo(braceRight-curl/2,66,braceRight,66,braceRight,73);
     ctx.stroke();ctx.globalAlpha=1;
     ctx.fillStyle=ink;ctx.font='12px system-ui, sans-serif';
     ctx.textAlign='center';ctx.fillText(label,(x+right)/2,53);ctx.textAlign='left';
    }else{
     ctx.fillStyle=color(styles,normal?'scope':'scope-emphasis');ctx.fillRect(x,48,right-x,24);
     ctx.fillStyle=barInk;const text=normal?'Normal · 181 ms':'Slow · 1.185 s';
     if(fits(text,right-x))ctx.fillText(text,x+7,60);
     else if(fits(normal?'Normal':'Slow',right-x))ctx.fillText(normal?'Normal':'Slow',x+7,60);
    }
   }
  }
  for(let r=0;r<data.rows.length;r++){
   const y=rowTop(r);ctx.fillStyle=ink;ctx.font='12px ui-monospace, SFMono-Regular, Menlo, monospace';ctx.fillText(c.rows[r],l,y-16);
   ctx.fillStyle='rgba(130,145,140,.07)';ctx.fillRect(l,y,plot,32);
   for(const e of data.rows[r]){if(e[0]>end)break;if(e[0]+e[1]<start)continue;
    const x=Math.max(l,position(e[0])),right=Math.min(width-18,position(e[0]+e[1])),w=Math.max(.5,right-x);
    ctx.fillStyle=colors[e[3]];ctx.fillRect(x,y,w,32);hit.push([x,y,w,32,e,r]);
    const label=e[3]===4?`${r===0?'cuDNN forward':'cuDNN backward'} · ${duration(e[1])}`:typeLabel(e[3]);
    if(fits(label,w)){ctx.fillStyle=barInk;ctx.fillText(label,x+7,y+16);}
   }
  }
  if(compactFastVideo){
   // Host-side gloo:broadcast overlapping the gap in the displayed GPU stream.
   const broadcastStart=6726.00165,broadcastEnd=7989.561986;
   const x=Math.max(l,position(broadcastStart)),right=Math.min(width-18,position(broadcastEnd));
   if(right>x){
    const y=rowTop(0),mid=(x+right)/2;
    ctx.font='11px ui-monospace, SFMono-Regular, Menlo, monospace';
    const label='CPU-side broadcast · 1.26 s',labelWidth=ctx.measureText(label).width;
    const labelX=Math.max(l,Math.min(width-18-labelWidth,mid-labelWidth/2));
    ctx.fillStyle=ink;ctx.fillText(label,labelX,y-16);
    ctx.strokeStyle=ink;ctx.lineWidth=1;ctx.globalAlpha=.5;
    ctx.beginPath();ctx.moveTo(x,y-3);ctx.lineTo(x,y-7);ctx.lineTo(right,y-7);ctx.lineTo(right,y-3);ctx.stroke();
    ctx.globalAlpha=1;
   }
  }
  if(selected){const[e,r]=selected;ctx.strokeStyle=ink;ctx.lineWidth=2;const x=Math.max(l,position(e[0])),right=Math.min(width-18,position(e[0]+e[1]));if(right>=l&&x<=width-18&&right>=x)ctx.strokeRect(x,(r===-1?stageTop:rowTop(r))-2,Math.max(2,right-x),36);}
 }
 function resize(){width=canvas.getBoundingClientRect().width;height=rowTop(data.rows.length-1)+48;const dpr=devicePixelRatio||1;canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
 let pinned=false,drag=null;
 function eventAt(e){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;let best=null,dist=Infinity;for(const h of hit){if(y<h[1]||y>h[1]+h[3])continue;const d=Math.abs(x-(h[0]+h[2]/2));if(x>=h[0]-2&&x<=h[0]+h[2]+2&&d<dist){best=h;dist=d;}}return best;}
 canvas.onpointermove=e=>{if(drag){const delta=(e.clientX-drag.x)/(width-left()-18)*drag.span;const ns=Math.max(0,Math.min(data.duration-drag.span,drag.start-delta));start=ns;end=ns+drag.span;draw();return;}if(pinned)return;const h=eventAt(e);show(h?.[4],h?.[5]);draw();canvas.style.cursor=h?'pointer':'grab';};
 canvas.onpointerleave=()=>{if(!pinned&&!drag){show(null);draw();}};
 canvas.onpointerdown=e=>{drag={x:e.clientX,start,span:end-start};canvas.setPointerCapture(e.pointerId);};
 canvas.onpointerup=e=>{if(!drag)return;const moved=Math.abs(e.clientX-drag.x)>3;drag=null;if(!moved){const h=eventAt(e);pinned=!!h;show(h?.[4],h?.[5]);draw();}canvas.releasePointerCapture(e.pointerId);};
 canvas.onpointercancel=()=>{drag=null;};
 canvas.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const rect=canvas.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(e.clientX-rect.left-left())/(width-left()-18))),span=end-start,ns=Math.max(.05,Math.min(data.duration,span*Math.exp(e.deltaY*.005))),at=start+ratio*span;start=Math.max(0,Math.min(data.duration-ns,at-ratio*ns));end=start+ns;draw();},{passive:false});
 canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Escape'].includes(e.key))return;e.preventDefault();if(e.key==='Escape'){pinned=false;show(null);draw();return;}const row=data.rows.length-1,events=data.rows[row].filter(x=>x[0]>=start&&x[0]<=end);if(!events.length)return;keyboardIndex=(keyboardIndex+(e.key==='ArrowRight'?1:-1)+events.length)%events.length;pinned=true;show(events[keyboardIndex],row);draw();};
 new ResizeObserver(resize).observe(canvas);new MutationObserver(draw).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','class','style']});
 story.textContent=c.views[0][3];show(null);resize();
}
document.querySelectorAll('[data-trace-case]').forEach(mount);
