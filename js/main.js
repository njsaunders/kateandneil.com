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
