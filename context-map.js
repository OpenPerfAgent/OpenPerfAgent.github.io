(() => {
  const root = document.getElementById('context-map');
  if (!root) return;
  // Shared schematic time units; all summary views derive from these events.
  const duration = 100;
  const ranks = [
    {compute: [[4,26,'attention'],[29,43,'mlp'],[49,71,'attention'],[75,89,'mlp']], comm: [[60,96]]},
    {compute: [[4,26,'attention'],[29,43,'mlp'],[65,77,'attention'],[85,93,'mlp']], comm: [[60,96]]}
  ];
  const names = {attention: 'Attention', mlp: 'MLP'};
  const intersect = (a,b) => Math.max(0, Math.min(a[1],b[1])-Math.max(a[0],b[0]));
  const x = time => 94 + time * 3.36;
  const timeline = root.querySelector('#context-runtime-timeline');
  if (timeline) {
    timeline.innerHTML = `<text x="374" y="14" class="ctx-axis">Time →</text>
      <g class="ctx-grid">${[0,25,50,75,100].map(t=>`<path d="M${x(t)} 24V158"/>`).join('')}</g>` + ranks.map((rank,i)=>{
      const y = 30+i*70;
      return `<text x="0" y="${y+13}" class="ctx-axis">GPU${i} comp</text>
        <text x="0" y="${y+41}" class="ctx-axis">GPU${i} comm</text>` +
        Object.keys(names).map(key=>`<g data-context-op="${key}" role="button" tabindex="0" aria-label="Inspect GPU${i} ${names[key]} events" aria-pressed="${key==='attention'}">${rank.compute.filter(e=>e[2]===key).map(e=>`<rect ${rank.comm.some(c=>intersect(e,c)>0)?'data-overlap-kernel':''} x="${x(e[0])}" y="${y}" width="${(e[1]-e[0])*3.36}" height="19" rx="2"/>`).join('')}</g>`).join('') +
        rank.comm.map(e=>`<rect class="context-comm-event" x="${x(e[0])}" y="${y+28}" width="${(e[1]-e[0])*3.36}" height="19" rx="2" fill="#ad844e"/>`).join('');
    }).join('');
    const views = root.querySelectorAll('.context-view');
    const totals = Object.fromEntries(Object.keys(names).map(key=>[key,ranks.reduce((total,r)=>total+r.compute.filter(e=>e[2]===key).reduce((n,e)=>n+e[1]-e[0],0),0)]));
    const totalCompute = Object.values(totals).reduce((a,b)=>a+b,0);
    views[0].innerHTML = `<h6>Time by operation</h6>` + Object.keys(names).map(key=>`<button type="button" data-context-op="${key}" aria-pressed="${key==='attention'}"><span>${names[key]}</span><i style="--bar:${totals[key]/totalCompute*100}%"></i><em>${totals[key]}</em></button>`).join('') + '<small>Kernel time summed across GPUs · schematic units</small>';
    views[1].innerHTML = '<h6>Busy / idle by rank</h6>' + ranks.map((r,i)=>{
      const busy=r.compute.reduce((n,e)=>n+e[1]-e[0],0)/duration*100;
      return `<div class="rank-line" aria-label="GPU${i}: ${Math.round(busy)}% compute busy"><span>GPU${i}</span><i style="--busy:${busy}%"></i><span>${Math.round(busy)}%</span></div>`;
    }).join('') + '<small>Green: compute busy · pale: no compute</small>';
    views[2].innerHTML = '<h6>Communication overlap</h6>' + ranks.map((r,i)=>{
      const comm=r.comm.reduce((n,e)=>n+e[1]-e[0],0);
      const overlap=r.comm.reduce((n,c)=>n+r.compute.reduce((v,e)=>v+intersect(c,e),0),0)/comm*100;
      return `<div class="rank-overlap" aria-label="GPU${i}: ${overlap.toFixed(1)}% of communication overlaps compute"><span>GPU${i}</span><div class="overlap-strip"><i style="width:${overlap}%"></i><b style="width:${100-overlap}%"></b></div><span>${Math.round(overlap)}%</span></div>`;
    }).join('') + '<small>Overlaps compute / remaining comm.</small>';
  }
  function select(key) {
    root.classList.remove("show-communication-overlap");
    root.querySelectorAll('[data-context-op]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.contextOp === key)));
  }
  root.querySelectorAll('[data-context-op]').forEach(el => {
    ['pointerenter', 'focus', 'click'].forEach(type => el.addEventListener(type, () => select(el.dataset.contextOp)));
    el.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(el.dataset.contextOp); }
    });
  });
  const overlap = root.querySelector('.context-overlap-view');
  if (overlap) {
    const highlight = () => root.classList.add('show-communication-overlap');
    const clear = () => root.classList.remove('show-communication-overlap');
    overlap.addEventListener('pointerenter', highlight);
    overlap.addEventListener('pointerleave', clear);
    overlap.addEventListener('focus', highlight);
    overlap.addEventListener('blur', clear);
  }
})();
