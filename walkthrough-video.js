(() => {
  const shell = document.querySelector('.video-option-shell');
  const video = shell?.querySelector('video');
  const cover = shell?.querySelector('.walkthrough-cover');
  if (!video || !cover) return;
  cover.hidden = false;
  video.controls = false;
  video.tabIndex = -1;
  const reveal = () => { cover.hidden = true; video.controls = true; video.removeAttribute('tabindex'); };
  cover.addEventListener('click', () => {
    reveal();
    video.focus();
    video.play().catch(() => { video.controls = true; });
  });
  video.addEventListener('play', reveal);
})();
