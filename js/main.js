// Close offcanvas, then smooth-scroll to the section
(function () {
  const offcanvasEl = document.getElementById('mobileMenu');
  if (!offcanvasEl) return;

  const header = document.querySelector('.header');
  const headerOffset = header ? header.offsetHeight : 0;

  const offcanvas =
    bootstrap.Offcanvas.getInstance(offcanvasEl) ||
    new bootstrap.Offcanvas(offcanvasEl);

  // Any link inside the mobile menu that points to a hash
  const menuLinks = offcanvasEl.querySelectorAll('a[href^="#"]');

  menuLinks.forEach((a) => {
    a.addEventListener('click', (e) => {
      const hash = a.getAttribute('href');
      // Ignore just "#"
      if (!hash || hash === '#') return;

      const targetEl = document.querySelector(hash);
      if (!targetEl) return; // let browser handle it if no target

      e.preventDefault();

      // After the offcanvas is fully hidden, do the scroll
      const doScroll = () => {
        const y =
          targetEl.getBoundingClientRect().top + window.pageYOffset - headerOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      };

      offcanvasEl.addEventListener('hidden.bs.offcanvas', doScroll, { once: true });
      offcanvas.hide();
    });
  });
})();

// Header: white on hero, black elsewhere
(() => {
  const hero   = document.querySelector('#home');     // your hero section
  const header = document.querySelector('.header');
  if (!hero || !header) return;

  // Keep the header height out of the intersection so we flip right at the top edge
  const headerHeight = header.getBoundingClientRect().height || 80;

  const io = new IntersectionObserver(([entry]) => {
    // If any part of the hero is intersecting (after accounting for header),
    // we use the "on-hero" style; otherwise we fall back to default.
    document.body.classList.toggle('on-hero', entry.isIntersecting);
  }, {
    root: null,
    // Nudge the top boundary down by the header height so the switch happens as the
    // hero slips under the header
    rootMargin: `-${Math.round(headerHeight)}px 0px 0px 0px`,
    threshold: 0
  });

  io.observe(hero);

  // Initial state (in case the page loads mid-scroll)
  const heroBox = hero.getBoundingClientRect();
  const onHero = heroBox.top < headerHeight && heroBox.bottom > 0;
  document.body.classList.toggle('on-hero', onHero);
})();


/* ===============================
   Polaroid Carousel — flex + autoslow
   =============================== */
window.addEventListener('DOMContentLoaded', function(){
  const scroller = document.getElementById('polaroidCarousel') || document.querySelector('.polaroid-scroller');
  const track    = document.getElementById('polaroidTrack')     || (scroller && scroller.querySelector('.polaroid-track'));
  if (!scroller || !track) return;

  // Ensure horizontal scroll is enabled
  scroller.style.overflowX = 'auto';

  // --- Image sources
  const basePath = 'images/photo-carousel/'; // adjust if yours differ
  const files = Array.from({length: 23}, (_,i)=> String(i+1).padStart(2,'0') + '.jpg');

  const buildSet = () => files.map(name => {
    const li = document.createElement('li');
    li.className = 'polaroid-card';
    li.innerHTML = `
      <a class="polaroid" href="${basePath}${name}" target="_blank" rel="noopener">
        <div class="polaroid-media">
          <img loading="lazy" src="${basePath}${name}" alt="Wedding photo ${name.replace('.jpg','')}">
        </div>
      </a>`;
    return li;
  });

  // Build 3 sets for seamless wrap
  [buildSet(), buildSet(), buildSet()].flat().forEach(el => track.appendChild(el));

  const thirdWidth = () => track.scrollWidth / 3;

  const cardStep = () => {
    const c = track.querySelector('.polaroid-card');
    if (!c) return 0;
    const gap = parseFloat(getComputedStyle(track).gap || '0');
    return c.getBoundingClientRect().width + gap;
  };

  // Start at middle set
  const goMiddle = () => { scroller.scrollLeft = thirdWidth(); };
  goMiddle();
  setTimeout(goMiddle, 150); // re-centre after initial paint

  // --- Auto-scroll (slowed by ~65% vs 0.8 px/tick)
  let paused = false, dragging = false;
  let pxPerTick = 0.28;     // was 0.8; 0.28 ≈ 35% speed (65% slower)
  let tickMs    = 16;       // ~60fps driver

  const stepOnce = () => {
    if (!paused && !dragging) {
      scroller.scrollLeft += pxPerTick;

      // seamless wrap
      const third = thirdWidth();
      const margin = Math.max(cardStep()*2, 100);
      if (scroller.scrollLeft > third*2 - margin) scroller.scrollLeft -= third;
      if (scroller.scrollLeft < margin)           scroller.scrollLeft += third;
    }
  };

  // Run with setInterval (plus it keeps moving even if rAF is throttled)
  const intervalId = setInterval(stepOnce, tickMs);

  // Pause/resume on hover/focus
  scroller.addEventListener('mouseenter', ()=> paused = true);
  scroller.addEventListener('mouseleave', ()=> paused = false);
  scroller.addEventListener('focusin',    ()=> paused = true);
  scroller.addEventListener('focusout',   ()=> paused = false);

  // Pointer drag
  let startX = 0, startLeft = 0;
  const onDown = (e) => {
    dragging = true; scroller.classList.add('dragging'); paused = true;
    startX = (e.touches ? e.touches[0].clientX : e.clientX);
    startLeft = scroller.scrollLeft;
  };
  const onMove = (e) => {
    if (!dragging) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    scroller.scrollLeft = startLeft - (x - startX);
    e.preventDefault();
  };
  const onUp = () => {
    dragging = false; scroller.classList.remove('dragging'); paused = false;
  };

  scroller.addEventListener('pointerdown', onDown, {passive:false});
  window.addEventListener('pointermove', onMove, {passive:false});
  window.addEventListener('pointerup', onUp, {passive:true});
  scroller.addEventListener('touchstart', onDown, {passive:true});
  window.addEventListener('touchmove', onMove, {passive:false});
  window.addEventListener('touchend', onUp, {passive:true});
  window.addEventListener('touchcancel', onUp, {passive:true});

  // Re-centre after resize
  let t; window.addEventListener('resize', ()=>{ clearTimeout(t); t=setTimeout(goMiddle,120); });
});
