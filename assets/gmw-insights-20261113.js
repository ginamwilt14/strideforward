/* Research, quotes, and fun facts carousel (BB-8, Nov 13, 2026).
   The slides are plain HTML in the page, so they read fine without this script (a row you can scroll
   sideways). The script adds previous and next, dots, and a gentle advance every 9 seconds that
   pauses on hover, focus, touch, a hidden tab, or the pause button, and never runs for people who
   ask for reduced motion. */
(function () {
  'use strict';
  document.querySelectorAll('[data-gi]').forEach(function (root) {
    var track = root.querySelector('.gi-track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.gi-slide'));
    if (!track || slides.length < 2) return;
    var prev = root.querySelector('[data-gi-prev]');
    var next = root.querySelector('[data-gi-next]');
    var toggle = root.querySelector('[data-gi-toggle]');
    var dotsWrap = root.querySelector('.gi-dots');
    var status = root.querySelector('.gi-status');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var playing = !reduce, inView = false, hovering = false, focused = false, timer = null, current = 0;
    root.classList.add('gi-ready');
    var dots = slides.map(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'gi-dot';
      b.setAttribute('aria-label', 'Show item ' + (i + 1) + ' of ' + slides.length);
      b.addEventListener('click', function () { go(i, true); });
      if (dotsWrap) dotsWrap.appendChild(b);
      s.setAttribute('aria-label', (i + 1) + ' of ' + slides.length);
      return b;
    });
    function nearest() {
      var left = track.scrollLeft, best = 0, d = Infinity;
      slides.forEach(function (s, i) { var x = Math.abs(s.offsetLeft - track.offsetLeft - left); if (x < d) { d = x; best = i; } });
      return best;
    }
    function mark(i) {
      current = i;
      dots.forEach(function (b, j) { b.setAttribute('aria-current', j === i ? 'true' : 'false'); });
    }
    function go(i, user) {
      var n = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[n].offsetLeft - track.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
      mark(n);
      if (user && status) status.textContent = 'Item ' + (n + 1) + ' of ' + slides.length;
      if (user) restart();
    }
    var ticking = false;
    track.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      window.requestAnimationFrame(function () { mark(nearest()); ticking = false; });
    }, { passive: true });
    if (prev) prev.addEventListener('click', function () { go(current - 1, true); });
    if (next) next.addEventListener('click', function () { go(current + 1, true); });
    function canRun() { return playing && inView && !hovering && !focused && !document.hidden; }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function restart() { stop(); if (canRun()) timer = setInterval(function () { go(current + 1, false); }, 9000); }
    function setPlaying(p) {
      playing = p;
      if (toggle) {
        toggle.setAttribute('aria-pressed', p ? 'false' : 'true');
        toggle.setAttribute('aria-label', p ? 'Pause the slides' : 'Play the slides');
        toggle.classList.toggle('is-paused', !p);
      }
      restart();
    }
    if (toggle) {
      if (reduce) { toggle.hidden = true; }
      toggle.addEventListener('click', function () { setPlaying(!playing); });
    }
    root.addEventListener('mouseenter', function () { hovering = true; restart(); });
    root.addEventListener('mouseleave', function () { hovering = false; restart(); });
    root.addEventListener('focusin', function () { focused = true; restart(); });
    root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) { focused = false; restart(); } });
    track.addEventListener('touchstart', function () { setPlaying(false); }, { passive: true });
    document.addEventListener('visibilitychange', restart);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { inView = entries[0].isIntersecting; restart(); }, { threshold: 0.5 }).observe(root);
    } else { inView = true; }
    root.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('a')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1, true); }
    });
    mark(0);
    setPlaying(playing);
  });
})();
