(() => {
  const root = document.documentElement;
  const key = 'openperfagent-theme';
  try {
    root.dataset.theme = localStorage.getItem(key) === 'light' ? 'light' : 'dark';
  } catch (_) { root.dataset.theme = 'dark'; }
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    function update() {
      const light = root.dataset.theme === 'light';
      button.textContent = light ? 'Dark' : 'Light';
      button.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    }
    button.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(key, root.dataset.theme); } catch (_) {}
      update();
    });
    update();
  });
})();
