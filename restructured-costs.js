(() => {
  const table = document.querySelector('#run-cost-data');
  if (!table) return;
  const minutes = text => {
    const h = +(text.match(/(\d+)h/) || [0, 0])[1];
    const m = +(text.match(/(\d+)m/) || [0, 0])[1];
    const s = +(text.match(/(\d+)s/) || [0, 0])[1];
    return h * 60 + m + s / 60;
  };
  const data = [...table.querySelectorAll('tbody tr')].map(row => {
    const [name, init, opt, tokens] = [...row.cells].map(cell => cell.textContent);
    return {name, init, opt, tokens, setup: minutes(init), optimization: minutes(opt), count: parseFloat(tokens)};
  });
  const root = document.createElement('section');
  root.className = 'run-costs';
  root.setAttribute('aria-label', 'Run time and token usage by repository');
  root.innerHTML = `<div class="cost-charts"></div><div class="cost-detail" aria-live="polite" aria-atomic="true"></div><p class="cost-hint">Hover or focus a bar to inspect a run. Click to keep it selected; Escape to clear.</p>`;
  const charts = root.querySelector('.cost-charts');
  const detail = root.querySelector('.cost-detail');
  const buttons = [];
  let pinned = null;
  const time = mins => { const rounded = Math.round(mins); return `${Math.floor(rounded / 60)}h ${rounded % 60}m`; };
  function select(index) {
    root.classList.toggle('has-selection', index !== null);
    buttons.forEach(button => {
      const selected = +button.dataset.index === index;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(+button.dataset.index === pinned));
    });
    detail.hidden = index === null && document.body.classList.contains('mlsys-draft');
    if (detail.hidden) {
      detail.innerHTML = '';
      return;
    }
    if (index === null) {
      detail.innerHTML = '<div class="cost-detail-title"><span class="demo-kicker">INSPECT A RUN</span><strong>Time and tokens, side by side.</strong></div><p>Select a repository in either chart to see its setup time, optimization time, and token usage.</p>';
      return;
    }
    const d = data[index];
    detail.innerHTML = `<div class="cost-detail-title"><span class="demo-kicker">SELECTED RUN</span><strong>${d.name}</strong><span class="cost-total">${time(d.setup + d.optimization)} total</span></div><div class="cost-readouts"><div><span>Init</span><b>${d.init}</b><small>Setup &amp; clarification</small></div><div><span>Optimization</span><b>${d.opt}</b><small>Experiment loop</small></div><div><span>Tokens</span><b>${d.tokens}</b><small>Includes cache reads</small></div></div>`;
  }
  ['time', 'tokens'].forEach(kind => {
    const figure = document.createElement('figure');
    figure.className = 'cost-chart';
    const isTime = kind === 'time', max = isTime ? 240 : 320;
    figure.innerHTML = `<h4>${isTime ? 'Elapsed time' : 'Token usage'}</h4><div class="cost-legend">${isTime ? '<span><i class="cost-init"></i>Init</span><span><i class="cost-opt"></i>Optimization</span>' : '<span><i class="cost-token"></i>Total tokens · mostly cache reads</span>'}</div><div class="cost-scroll"><div class="cost-plot"><div class="cost-axis"></div><div class="cost-bars"></div></div></div>`;
    const axis = figure.querySelector('.cost-axis');
    for (let i = 0; i <= 4; i++) {
      const tick = document.createElement('span');
      tick.style.bottom = `${i * 25}%`;
      tick.textContent = isTime ? `${i}h` : `${i * 80}M`;
      axis.append(tick);
    }
    const bars = figure.querySelector('.cost-bars');
    data.forEach((d, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'cost-bar'; button.dataset.index = index;
      button.setAttribute('aria-label', isTime ? `${d.name}: init ${d.init}, optimization ${d.opt}` : `${d.name}: ${d.tokens} tokens`);
      const total = isTime ? d.setup + d.optimization : d.count;
      const stack = document.createElement('span'); stack.dataset.value = isTime ? time(total) : d.tokens; stack.className = 'cost-stack'; stack.style.height = `${total / max * 100}%`;
      if (isTime) stack.innerHTML = `<span class="cost-opt" style="flex:${d.optimization}"></span><span class="cost-init" style="flex:${d.setup}"></span>`;
      else stack.innerHTML = '<span class="cost-token" style="flex:1"></span>';
      const label = document.createElement('span'); label.className = 'cost-label'; label.textContent = d.name;
      button.append(stack, label); bars.append(button); buttons.push(button);
      button.addEventListener('pointerenter', () => select(index));
      button.addEventListener('pointerleave', () => select(pinned));
      button.addEventListener('focus', () => select(index));
      button.addEventListener('blur', () => select(pinned));
      button.addEventListener('click', () => { pinned = pinned === index ? null : index; select(pinned); });
      button.addEventListener('keydown', event => {
        if (event.key === 'Escape') { pinned = null; select(null); }
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + data.length) % data.length;
          bars.children[next].focus();
        }
      });
    });
    charts.append(figure);
  });
  const wrapper = table.closest('.tablewrap');
  (wrapper || table).replaceWith(root);
  select(null);
})();
