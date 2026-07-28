(() => {
  'use strict';
  let loading = false;
  let taps = 0;
  let tapTimer = 0;

  function openAdmin() {
    if (loading || window.ServerBloomAdmin) {
      window.ServerBloomAdmin?.open();
      return;
    }
    loading = true;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'assets/css/admin.css?v=3';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'assets/js/admin.js?v=3';
    script.onload = () => window.ServerBloomAdmin?.open();
    script.onerror = () => { loading = false; };
    document.body.appendChild(script);
  }

  document.addEventListener('keydown', event => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      openAdmin();
    }
  });
  document.querySelector('.brand .logo')?.addEventListener('click', event => {
    event.preventDefault();
    clearTimeout(tapTimer);
    taps += 1;
    tapTimer = setTimeout(() => { taps = 0; }, 1800);
    if (taps >= 7) {
      taps = 0;
      openAdmin();
    }
  });
})();
