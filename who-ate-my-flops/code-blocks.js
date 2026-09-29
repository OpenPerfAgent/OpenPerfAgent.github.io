(() => {
  const patterns = {
    python: /(?<comment>#[^\n]*)|(?<string>\bf(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(?<keyword>\b(?:for|in|if|else|return|import|from|def|class|with|as|True|False|None)\b)|(?<number>\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(?<function>\b[A-Za-z_]\w*(?=\())/g,
    json: /(?<string>"(?:\\.|[^"\\])*")|(?<number>-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(?<keyword>\b(?:true|false|null)\b)/g,
    output: /(?<emphasis>\bDIFFUSE\b|\bno single site\b)|(?<number>\b\d[\d,]*(?:\.\d+)?(?:%|ms|GB|\b))/g
  };
  document.querySelectorAll('pre[data-language]').forEach(pre => {
    const code = pre.querySelector('code');
    const source = code.textContent;
    const language = pre.dataset.language;
    const fragment = document.createDocumentFragment();
    let end = 0;
    for (const match of source.matchAll(patterns[language])) {
      fragment.append(document.createTextNode(source.slice(end, match.index)));
      const span = document.createElement('span');
      span.className = 'syntax-' + Object.keys(match.groups).find(key => match.groups[key] !== undefined);
      span.textContent = match[0]; fragment.append(span);
      end = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(source.slice(end)));
    code.replaceChildren(fragment);
    const frame = document.createElement('div'); frame.className = 'code-frame';
    const header = document.createElement('div'); header.className = 'code-header';
    const label = document.createElement('span'); label.textContent = pre.dataset.label || (language === 'python' ? 'Python' : language === 'json' ? 'JSON' : 'Profiler output');
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy';
    copy.setAttribute('aria-label', 'Copy ' + label.textContent);
    const status = document.createElement('span'); status.className = 'code-copy-status'; status.setAttribute('role', 'status');
    let timer;
    copy.addEventListener('click', async () => {
      clearTimeout(timer);
      try {
        await navigator.clipboard.writeText(source);
        copy.textContent = 'Copied'; status.textContent = 'Copied to clipboard.';
      } catch {
        copy.textContent = 'Select text'; status.textContent = 'Copy unavailable. Text selected for manual copying.';
        const range = document.createRange(); range.selectNodeContents(code);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      }
      timer = setTimeout(() => { copy.textContent = 'Copy'; status.textContent = ''; }, 2200);
    });
    header.append(label, status, copy);
    pre.before(frame); frame.append(header, pre);
    pre.tabIndex = 0; pre.setAttribute('aria-label', label.textContent);
  });
})();
