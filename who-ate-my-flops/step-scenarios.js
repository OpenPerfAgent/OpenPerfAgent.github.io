(() => {
  const root = document.querySelector('#step-scenarios');
  if (!root) return;
  // Schematic positions, not measured profiles or predicted speedups.
  const scenes = [
  {
    "category": "CPU blocking",
    "button": "CPU preprocessing",
    "title": "The GPU waits while the CPU prepares its input",
    "explanation": "The GPU is ready, but the CPU is still preparing its input.",
    "label": "Waiting for input",
    "examples": "Loading data, encoding PNGs, or decoding video on the CPU while the GPU waits.",
    "lanes": [
      "CPU",
      "GPU"
    ],
    "bars": [
      [
        0,
        0,
        55,
        "cpu"
      ],
      [
        1,
        55,
        100,
        "compute"
      ]
    ],
    "gap": [
      1,
      0,
      55
    ],
    "solution": "The agent shortens CPU data preparation or overlaps it with the previous step’s GPU computation."
  },
  {
    "category": "Data movement",
    "button": "GPU all-reduce",
    "title": "The GPU waits for communication to finish",
    "explanation": "Communication can run alongside compute. When compute finishes first, the GPU has to wait.",
    "label": "Waiting for all-reduce",
    "examples": "Limited communication–compute overlap; unpinned CPU memory; transferring fp32 outputs before converting them to uint8.",
    "lanes": [
      "GPU",
      "All-reduce"
    ],
    "bars": [
      [
        0,
        0,
        38,
        "compute"
      ],
      [
        0,
        65,
        100,
        "compute"
      ],
      [
        1,
        20,
        65,
        "transfer"
      ]
    ],
    "gap": [
      0,
      38,
      65
    ],
    "solution": "The agent looks for ways to shorten communication or overlap it with other GPU computation."
  },
  {
    "category": "Launch & sync overhead",
    "button": "Small kernels + .item()",
    "title": "Short operations leave long gaps between useful work",
    "explanation": "Launch overhead and synchronization can leave the GPU waiting on the CPU.",
    "label": "Launch / sync gaps",
    "examples": "Launching lots of tiny kernels for compute or communication; repeatedly making the CPU wait for GPU results, for example when indexing with a boolean mask.",
    "lanes": [
      "CPU",
      "GPU"
    ],
    "bars": [
      [
        0,
        0,
        5,
        "cpu"
      ],
      [
        0,
        25,
        30,
        "cpu"
      ],
      [
        0,
        50,
        55,
        "cpu"
      ],
      [
        0,
        82,
        87,
        "cpu"
      ],
      [
        1,
        6,
        12,
        "compute"
      ],
      [
        1,
        31,
        37,
        "compute"
      ],
      [
        1,
        56,
        62,
        "compute"
      ],
      [
        1,
        88,
        94,
        "compute"
      ]
    ],
    "gap": [
      1,
      62,
      88
    ],
    "solution": "The agent looks for ways to batch launches and remove unnecessary synchronization."
  },
  {
    "category": "Load imbalance",
    "button": "All-reduce after uneven work",
    "title": "The other GPUs wait for the slowest one",
    "explanation": "One GPU finishes early and waits for another to catch up.",
    "label": "Waiting for rank 1",
    "lanes": [
      "Rank 0",
      "Rank 1"
    ],
    "examples": "Giving some GPUs larger batches or more data, leaving the others waiting when they need to communicate.",
    "bars": [
      [
        0,
        0,
        32,
        "compute"
      ],
      [
        1,
        0,
        76,
        "compute"
      ],
      [
        0,
        76,
        100,
        "transfer"
      ],
      [
        1,
        76,
        100,
        "transfer"
      ]
    ],
    "gap": [
      0,
      32,
      76
    ],
    "solution": "The agent checks whether the work can be shared more evenly."
  },
  {
    "category": "Inefficient kernels",
    "button": "Attention backend / fallback",
    "title": "Same attention work, different runtime on B200",
    "explanation": "The kernel does not make full use of the GPU.",
    "label": "Busy ≠ efficient",
    "lanes": [
      "Backend",
      "GPU"
    ],
    "examples": "Keeping the same kernels after moving to newer GPUs; forgetting to install a fast-kernel package in the conda environment, so the code quietly falls back to a slower implementation.",
    "bars": [
      [
        1,
        0,
        100,
        "compute"
      ]
    ],
    "gap": null,
    "solution": "The agent should find the best kernel for the workload and hardware."
  }
];
  root.innerHTML='<div class="step-tabs" role="tablist" aria-label="Performance problem"></div><div class="step-panel" id="step-operation-panel" role="tabpanel" tabindex="0"></div>';
  const tabs=root.querySelector('.step-tabs'), panel=root.querySelector('.step-panel');
  const buttons=scenes.map((scene,i)=>{
    const button=document.createElement('button');button.type='button';button.textContent=scene.category;button.id='step-operation-'+i;
    button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);tabs.append(button);
    button.addEventListener('click',()=>show(i));
    button.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight')next=(i+1)%scenes.length;
      else if(event.key==='ArrowLeft')next=(i+scenes.length-1)%scenes.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=scenes.length-1;
      else return;
      event.preventDefault();show(next);buttons[next].focus();
    });return button;
  });
  // Specialized sketches separate launch overhead from synchronization and routing from timing.
  function miniTrack(name,bars,gaps=[]){
    return `<div class="pattern-row"><span class="pattern-lane">${name}</span><div class="pattern-track">${bars.map(([start,end,type,label=''])=>`<span class="pattern-bar pattern-${type}" style="left:${start}%;width:${end-start}%">${label}</span>`).join('')}${gaps.map(([start,end])=>`<i class="pattern-gap" style="left:${start}%;width:${end-start}%">${index===0?`<span class="pattern-inline-label">${type==='cpu'?'Preparing input':'GPU computation'}</span>`:index===3&&!(row===0&&type==='transfer')?`<span class="pattern-inline-label">${type==='compute'?'Compute':'All-reduce'}</span>`:''}</i>`).join('')}</div></div>`;
  }
  function smallOpsSketch(){
    const rect=(x,y,w,kind)=>`<rect x="${x}" y="${y}" width="${w}" height="14" rx="2" class="${kind}"/>`;
    const frame=`<text x="390" y="12" text-anchor="end" class="step-small">Time →</text>
      <text x="0" y="43" class="step-small">CPU</text><text x="0" y="85" class="step-small">GPU</text>
      ${rect(40,32,350,'coordination-idle')}${rect(40,74,350,'coordination-idle')}`;
    const launch=Array.from({length:3},(_,i)=>{
      const x=40+i*100;
      return rect(x,32,95,'step-cpu')+rect(x+95,74,32,'step-compute')+
        `<text x="${x+47.5}" y="42" text-anchor="middle" class="launch-block-label">Launch</text><text x="${x+111}" y="84" text-anchor="middle" class="launch-block-label launch-kernel-label">Kernel</text>`;
    }).join('');
    return `<div class="pattern-pair coordination-pair">
      <div><h4>Launch overhead</h4>
      <svg class="sync-sketch" viewBox="0 0 400 132" role="img" aria-label="Three CPU launches each start a short GPU kernel. The highlighted gap shows the GPU waiting for the next launch to finish.">
      <defs><marker id="launch-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="currentColor"/></marker></defs>
      ${frame}${launch}
      <path d="M135 48V71" class="sync-dependency" style="marker-end:url(#launch-arrow)"/>
      <path d="M167 94V98H235V94" class="launch-gap-bracket"/>
      <text x="201" y="112" text-anchor="middle" class="sync-note">Waiting for the</text>
      <text x="201" y="124" text-anchor="middle" class="sync-note">next launch</text>
      </svg>
      </div>
      <div><h4>Synchronization overhead</h4>
      <svg class="sync-sketch" viewBox="0 0 400 132" role="img" aria-label="A .item() call blocks the CPU until a GPU result is ready. The CPU then resumes and launches the next kernel.">
      <defs><marker id="sync-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="currentColor"/></marker></defs>
      ${frame}
      ${rect(40,32,34,'step-cpu')}${rect(74,32,130,'coordination-wait')}${rect(204,32,54,'step-cpu')}
      ${rect(40,74,146,'step-compute')}${rect(258,74,132,'step-compute')}
      <text x="57" y="42" text-anchor="middle" class="launch-block-label launch-kernel-label">Launch</text>
      <text x="231" y="42" text-anchor="middle" class="launch-block-label">Launch</text>
      <text x="113" y="84" text-anchor="middle" class="launch-block-label">Kernel</text>
      <text x="324" y="84" text-anchor="middle" class="launch-block-label">Kernel</text>
      <text x="139" y="42" text-anchor="middle" class="sync-note">.item() waits</text>
      <path d="M186 71L204 49M258 49V71" class="sync-dependency"/>
      <text x="188" y="63" text-anchor="end" class="sync-note">result ready</text>
      </svg>
      <p>Reading a GPU value blocks the CPU, delaying the next kernel launch.</p></div>
    </div><p class="coordination-legend"><span><i class="coordination-key step-cpu"></i>CPU work</span><span><i class="coordination-key step-compute"></i>GPU compute</span><span><i class="coordination-key coordination-idle"></i>Waiting / idle</span><span>Two schematic scenarios</span></p>`;
  }
  function backendSketch(){
    return `<div class="hardware-sketch" role="img" aria-label="Published B200 attention forward benchmark, BF16, non-causal, sequence length 8192, head dimension 128. Relative runtime derived from throughput: FA2 1.00 times, FA4 about 0.27 times.">
      <div class="hardware-heading"><span>B200 · BF16 · Forward only</span></div>
      <div class="hardware-time-axis" aria-label="Time increases to the right"><span>Time →</span><i aria-hidden="true"></i></div>
      <div class="hardware-row"><span class="hardware-name">FlashAttention-2</span><div class="hardware-track"><span class="hardware-bar" style="width:100%"></span></div></div>
      <div class="hardware-row"><span class="hardware-name">FlashAttention-4</span><div class="hardware-track hardware-track-savings"><span class="hardware-bar" style="width:${427/1579*100}%"></span><span class="hardware-savings" style="left:${427/1579*100}%;width:${100-427/1579*100}%"><svg viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true"><path d="M1 2 Q1 8 5 8 H45 Q50 8 50 15 Q50 8 55 8 H95 Q99 8 99 2"/></svg><span>73% less time</span></span></div></div>
      <div class="hardware-caption">Same attention work, FA4 is 3.7× faster. <a href="https://tridao.me/assets/img/2026-03-05-flash4/fa4_fwd_causalFalse_hdim128.png" target="_blank" rel="noopener">FA4 authors’ benchmark ↗</a></div>
    </div>`;
  }

  function show(index){
    const scene=scenes[index];
    buttons.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});
    panel.setAttribute('aria-labelledby',buttons[index].id);
    const tracks=scene.lanes.map((name,row)=>{
      const bars=scene.bars.filter(b=>b[0]===row).map(([,start,end,type])=>`<i class="pattern-bar pattern-${type}" style="left:${start}%;width:${end-start}%">${index===0?`<span class="pattern-inline-label">${type==='cpu'?'Preparing input':'GPU computation'}</span>`:index===3&&!(row===0&&type==='transfer')?`<span class="pattern-inline-label">${type==='compute'?'Compute':'All-reduce'}</span>`:''}</i>`).join('');
      const gap=scene.gap&&scene.gap[0]===row?`<i class="pattern-gap" style="left:${scene.gap[1]}%;width:${scene.gap[2]-scene.gap[1]}%">${index===0?'<span class="pattern-inline-label">Waiting for input</span>':''}</i>`:'';
      const path=index===4&&row===0?'<span class="pattern-path">Fallback / unsuitable backend</span>':'';
      return `<div class="pattern-row"><span class="pattern-lane">${name}</span><div class="pattern-track">${bars}${gap}${path}${index===3&&row===0?'<span class="imbalance-collective"><span>All-reduce</span></span><span class="imbalance-bracket"><span>Waiting due to load imbalance</span></span>':''}${index===0&&row===0?'<span class="pattern-input-ready"><span>Input ready</span></span>':''}</div></div>`;
    }).join('');
    const sketch=index===2?smallOpsSketch():index===4?backendSketch():`<div class="pattern-sketch${index===0?' pattern-cpu-blocking':index===3?' pattern-imbalance':''}" role="img" aria-label="${scene.title}. ${scene.explanation}"><div class="pattern-time">Time →</div>${tracks}<div class="pattern-caption"${index===0||index===3?' hidden':''}>${scene.gap?'<i class="pattern-gap-key"></i>':''}${scene.label}</div></div>`;
    panel.innerHTML=`${sketch}<div class="step-operation-description"><p><strong>Pattern:</strong> ${scene.explanation}</p><p><strong>Common causes:</strong> ${scene.examples}</p><p><strong>Potential solution:</strong> ${scene.solution}</p></div>`;
  }
  show(0);
})();
