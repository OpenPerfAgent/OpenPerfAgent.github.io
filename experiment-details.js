(() => {
  const source = document.querySelector('#repository-findings');
  const table = document.querySelector('#optimization-results');
  if (!source || !table) return;
  const findings = new Map([...source.content.querySelectorAll('tbody tr')].map(row => [row.cells[0].textContent.trim(), row]));
  const body = table.tBodies[0];
  // Retain findings that do not yet have a reported result, without inventing one.
  const existing = new Set([...body.rows].map(row => row.cells[0].querySelector('a')?.textContent.trim() || row.cells[0].textContent.trim()));
  for (const [name, sourceRow] of findings) {
    if (existing.has(name)) continue;
    const row = body.insertRow();
    [name, sourceRow.cells[4].textContent, 'Not reported', '—'].forEach(text => { row.insertCell().textContent = text; });
  }
  [...body.rows].forEach((row, index) => {
    const repoCell = row.cells[0];
    const repoLink = repoCell.querySelector('a');
    const name = repoLink?.textContent.trim() || repoCell.textContent.trim();
    const finding = findings.get(name);
    if (!finding) return;
    const cells = finding.cells;
    const detail = document.createElement('tr');
    detail.className = 'experiment-detail-row';
    detail.hidden = true;
    const cell = detail.insertCell(); cell.colSpan = row.cells.length;
    const panel = document.createElement('div'); panel.className = 'experiment-detail-panel';
    panel.id = `experiment-detail-${index}`;
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'experiment-toggle'; button.id = `experiment-toggle-${index}`;
    button.textContent = name; button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', button.id);
    if (repoLink) repoLink.replaceWith(button); else { repoCell.textContent = ''; repoCell.append(button); }
    const links = document.createElement('div'); links.className = 'experiment-detail-links';
    if (repoLink) { repoLink.textContent = 'Repository ↗'; links.append(repoLink); }
    const prLink = row.cells[3].querySelector('a');
    if (prLink) {
      const link = prLink.cloneNode(true);
      link.textContent = `Read PR ${prLink.textContent} ↗`;
      links.append(link);
    }
    panel.append(links);
    const grid = document.createElement('div'); grid.className = 'experiment-detail-grid';
    [['What we found',[2]],['What changed',[6]]].forEach(([label,indices]) => {
      const block = document.createElement('div'); const title = document.createElement('strong'); title.textContent = label;
      block.append(title);
      indices.forEach(i => {
        const text = document.createElement('p'); cells[i].childNodes.forEach(node => text.append(node.cloneNode(true)));
        block.append(text);
      });
      grid.append(block);
    });
    panel.append(grid); cell.append(panel); row.after(detail);
    row.classList.add('experiment-summary-row');
    const toggle = () => { detail.hidden = !detail.hidden; button.setAttribute('aria-expanded', String(!detail.hidden)); };
    button.addEventListener('click', toggle);
    row.addEventListener('click', event => { if (!event.target.closest('a,button,input,select,textarea')) toggle(); });
  });
})();
