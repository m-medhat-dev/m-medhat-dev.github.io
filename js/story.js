(function () {
  'use strict';

  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var lenis = null;

  /* analytics: one guarded call; does nothing until the Umami script is switched on in index.html */
  function track(name, data) {
    try { if (window.umami && window.umami.track) window.umami.track(name, data); } catch (e) {}
  }
  function placeOf(el) {
    if (el.closest('.nav')) return 'nav';
    if (el.closest('#quick')) return 'menu';
    if (el.closest('#drawer')) return 'hero-phone';
    if (el.closest('.contact')) return 'footer';
    var sec = el.closest('section[id]');
    return sec ? sec.id : 'page';
  }
  function fileName(src) { return String(src || '').split('/').pop().replace(/\.[a-z0-9]+$/i, ''); }
  var NAV_OFFSET = 76;

  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  /* ---------- smooth scroll (motion is always on, prefers-reduced-motion is ignored by design) ---------- */
  if (hasGsap && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- anchors and quick view ---------- */
  function jump(target) {
    var el = $(target);
    if (!el) return;
    if (target === '#story' || target === '#top') {
      if (lenis) lenis.scrollTo(0, { duration: 1.2 });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    var isChapter = el.classList.contains('chapter');
    var off = isChapter ? 0 : -NAV_OFFSET;
    if (lenis) {
      lenis.scrollTo(el, { offset: off, duration: 1.4 });
    } else {
      var y = el.getBoundingClientRect().top + window.pageYOffset + off;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }
  var quick = $('#quick'), quickBtn = $('#quickBtn');
  // the menu fades and slides in; it is only set hidden after the close transition so it can animate out
  var quickTimer = null;
  function openQuick() {
    clearTimeout(quickTimer);
    quick.hidden = false;
    void quick.offsetWidth;
    quick.classList.add('show');
    track('menu-open');
    quickBtn.setAttribute('aria-expanded', 'true');
  }
  function closeQuick() {
    if (quick.hidden) return;
    quick.classList.remove('show');
    quickBtn.setAttribute('aria-expanded', 'false');
    clearTimeout(quickTimer);
    quickTimer = setTimeout(function () { if (!quick.classList.contains('show')) quick.hidden = true; }, 240);
  }
  $$('[data-jump]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      jump(a.getAttribute('href'));
      track('jump', { to: a.getAttribute('href').slice(1), place: placeOf(a) });
      if (quick.contains(a)) closeQuick();
    });
  });
  quickBtn.addEventListener('click', function () {
    if (quick.classList.contains('show')) closeQuick(); else openQuick();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeQuick(); });
  document.addEventListener('click', function (e) {
    if (quick.classList.contains('show') && !quick.contains(e.target) && !quickBtn.contains(e.target)) closeQuick();
  });

  /* ---------- safe, debounced ScrollTrigger refresh ---------- */
  var rfT = null, lastH = 0, scrolling = false, scrollT = null;
  window.addEventListener('scroll', function () {
    scrolling = true;
    clearTimeout(scrollT);
    scrollT = setTimeout(function () { scrolling = false; }, 180);
  }, { passive: true });
  function docH() { return document.documentElement.scrollHeight; }
  function softRefresh(force) {
    if (!hasGsap) return;
    clearTimeout(rfT);
    rfT = setTimeout(function run() {
      if (scrolling) { rfT = setTimeout(run, 250); return; }
      var h = docH();
      if (force === true || h !== lastH) { lastH = h; ScrollTrigger.refresh(); }
    }, 250);
  }

  /* ---------- videos: lazy load, play in view, pause and abort out of view ---------- */
  var videos = $$('video[data-src]');
  function loadVideo(v) { if (!v.getAttribute('src')) v.src = v.dataset.src; }
  function abortIfLoading(v) {
    if (v.getAttribute('src') && v.readyState < 3) {
      v.removeAttribute('src');
      v.load();
    }
  }
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var v = en.target;
      if (en.isIntersecting) {
        loadVideo(v);
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
        abortIfLoading(v);
      }
    });
  }, { threshold: 0.25, rootMargin: '200px 0px' }) : null;
  videos.forEach(function (v) {
    v.muted = true;
    v.autoplay = false;
    if (io) io.observe(v);
  });

  /* ---------- lightbox ---------- */
  var lb = $('#lightbox'), lbBody = $('#lbBody');
  function clearLB() {
    $$('video', lbBody).forEach(function (v) {
      v.pause();
      v.removeAttribute('src');
      v.load();
    });
    lbBody.innerHTML = '';
  }
  function openLB(kind, src) {
    clearLB();
    var el;
    if (kind === 'video') {
      el = document.createElement('video');
      el.controls = true; el.loop = true; el.playsInline = true; el.autoplay = true;
      el.src = src;
    } else {
      el = document.createElement('img');
      el.src = src; el.alt = 'Full size preview';
    }
    lbBody.appendChild(el);
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
    if (lenis) lenis.stop();
  }
  function closeLB() {
    clearLB();
    if (lb.close) { if (lb.open) lb.close(); } else lb.removeAttribute('open');
    if (lenis) lenis.start();
  }
  $('#lbClose').addEventListener('click', closeLB);
  lb.addEventListener('cancel', function () { clearLB(); if (lenis) lenis.start(); }); // Esc
  lb.addEventListener('close', function () { clearLB(); if (lenis) lenis.start(); });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target === lbBody) closeLB(); });
  $$('[data-lightbox]').forEach(function (el) {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Open full screen preview');
    var open = function () {
      openLB(el.dataset.lightbox, el.dataset.src);
      track(el.dataset.lightbox === 'video' ? 'video-open' : 'image-open', { item: fileName(el.dataset.src), place: placeOf(el) });
    };
    // links inside a card (e.g. the repo link) open normally instead of the preview
    el.addEventListener('click', function (e) { if (!e.target.closest('a')) open(); });
    el.addEventListener('keydown', function (e) {
      if (e.target.closest('a')) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });

  /* ---------- SmartX tabs: only the active video plays ---------- */
  var tabs = $$('.tabs [role=tab]');
  var panels = $$('.panels .panel');
  function selectTab(i, focus) {
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
      panels[k].classList.toggle('active', on);
      var v = $('video', panels[k]);
      if (v && !on) { v.pause(); v.currentTime = 0; }
    });
    if (focus) tabs[i].focus();
    softRefresh();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(i); track('smartx-tab', { tab: t.textContent.trim() }); });
    t.addEventListener('keydown', function (e) {
      var n = tabs.length;
      if (e.key === 'ArrowRight') { e.preventDefault(); selectTab((i + 1) % n, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); selectTab((i + n - 1) % n, true); }
      if (e.key === 'Home') { e.preventDefault(); selectTab(0, true); }
      if (e.key === 'End') { e.preventDefault(); selectTab(n - 1, true); }
    });
  });

  /* ---------- counters: final values (used when GSAP fails to load) ---------- */
  function setFinalCounters() {
    $$('.num[data-count]').forEach(function (n) {
      n.textContent = (n.dataset.prefix || '').replace('&lt;', '<') + Number(n.dataset.count).toLocaleString('en-US') + (n.dataset.suffix || '');
    });
  }

  if (!hasGsap) {
    setFinalCounters();
    return;
  }

  /* ---------- Venue image pan on hover ---------- */
  var pz = $('.panzoom .pz');
  if (pz && window.matchMedia('(hover: hover)').matches) {
    var pimg = $('img', pz);
    gsap.set(pimg, { scale: 1.7, transformOrigin: '0 0' });
    var qx = gsap.quickTo(pimg, 'x', { duration: 0.6, ease: 'power3.out' });
    var qy = gsap.quickTo(pimg, 'y', { duration: 0.6, ease: 'power3.out' });
    pz.addEventListener('pointermove', function (e) {
      var r = pz.getBoundingClientRect();
      var fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      qx(-fx * r.width * 0.7);
      qy(-fy * r.height * 0.7);
    });
    pz.addEventListener('pointerleave', function () { qx(0); qy(0); });
  }

  /* ---------- Prologue: hamburger to arrow morph ---------- */
  var icon = $('#burgerIcon'), b1 = $('.b1'), b2 = $('.b2'), b3 = $('.b3');
  var drawer = $('#drawer'), scrim = $('#scrim');
  var badgeA = $('.badge-a'), badgeB = $('.badge-b');
  var burger = $('#burger'), rail = $('#rail');
  var drawerRows = $$('.d-row', drawer);
  var pill = $('#dPill'), activeRow = 0;
  var phone = $('#phone');
  gsap.set(drawer, { x: 0, xPercent: -100 });
  function setActive(i) {
    if (i === activeRow && pill._set) return;
    activeRow = i; pill._set = true;
    drawerRows.forEach(function (r, k) { r.classList.toggle('on', k === i); });
    placePill(0.3);
  }
  // rows can be hidden in the short landscape phone (below 900px); the pill hides with them
  function placePill(dur) {
    var r = drawerRows[activeRow], shown = !!r.offsetParent;
    if (shown) pill.style.height = r.offsetHeight + 'px';
    gsap.to(pill, { y: shown ? r.offsetTop : 0, autoAlpha: shown ? 1 : 0, duration: dur, ease: 'power2.out', overwrite: true });
  }
  placePill(0);
  pill._set = true;
  var morph = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut', duration: 1 } });
  morph.to(icon, { rotation: 180, transformOrigin: '50% 50%' }, 0)
       .to(b1, { y: 7.5, x: 1, rotation: -45, scaleX: 0.62 }, 0)
       .to(b2, { scaleX: 0.96 }, 0)
       .to(b3, { y: -7.5, x: 1, rotation: 45, scaleX: 0.62 }, 0)
       .to(drawer, { xPercent: 0, ease: 'none' }, 0)
       .to(scrim, { opacity: 0.45, ease: 'none' }, 0)
       .fromTo(drawerRows, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' }, 0.2)
       .to(badgeA, { opacity: 0, y: -10 }, 0.1)
       .fromTo(badgeB, { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, 0.3);

  var wasFull = false;
  function afterProgress() {
    var full = morph.progress() >= 0.99;
    burger.setAttribute('aria-pressed', String(morph.progress() > 0.5));
    if (full && !wasFull) {
      rail.classList.remove('pulse');
      void rail.offsetWidth;
      rail.classList.add('pulse');
    }
    wasFull = full;
  }
  morph.eventCallback('onUpdate', afterProgress);

  function goTo(p, dur) {
    gsap.to(morph, { progress: p, duration: dur || 0.7, ease: 'power2.out', overwrite: true });
  }

  /* The last input wins: user drags and taps set userTouched, the scroll scrub only
     writes progress when the scroll position really changed (never on refresh). */
  var mm = gsap.matchMedia();
  var dragging = false, lastScroll = null;
  function scrubMorph(self) {
    var y = self.scroll();
    if (lastScroll === null) { lastScroll = y; return; }
    if (dragging || Math.abs(y - lastScroll) < 1) return;
    lastScroll = y;
    goTo(Math.min(1, self.progress / 0.8), 0.25);
  }
  // same scroll behaviour on every size: the page holds while the morph scrubs.
  // Desktop pins the whole prologue; below 900px the text sits above the phone, so the phone stage pins in the middle of the screen.
  mm.add('(min-width: 900px)', function () {
    ScrollTrigger.create({
      trigger: '#story', start: 'top top',
      end: function () { return '+=' + Math.round(window.innerHeight * 1.25); },
      pin: true, pinSpacing: true, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: scrubMorph
    });
  });
  mm.add('(max-width: 899px)', function () {
    ScrollTrigger.create({
      trigger: '.prologue .stage', start: 'center center',
      end: function () { return '+=' + Math.round(window.innerHeight * 0.9); },
      pin: true, pinSpacing: true, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: scrubMorph
    });
  });

  /* Drag anywhere on the phone screen (6px threshold). Progress = distance / drawer width. */
  var touched = false, drag = null, suppressClick = false;
  function drawerW() { return drawer.offsetWidth || 180; }
  function endDrag(e, cancelled) {
    if (!drag) return;
    var d = drag; drag = null;
    if (!d.moved) return;
    dragging = false;
    phone.classList.remove('dragging');
    try { phone.releasePointerCapture(d.id); } catch (err) {}
    var p = morph.progress(), v = d.v;
    var target = v > 0.35 ? 1 : (v < -0.35 ? 0 : (p > 0.5 ? 1 : 0));
    goTo(target, 0.35);
    trackHero('drag');
    suppressClick = true;
    setTimeout(function () { suppressClick = false; }, 0);
  }
  phone.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, p: morph.progress(), moved: false, lx: e.clientX, lt: e.timeStamp, v: 0 };
  });
  phone.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      drag.moved = true; dragging = true; touched = true;
      gsap.killTweensOf(morph);
      phone.classList.add('dragging');
      try { phone.setPointerCapture(e.pointerId); } catch (err) {}
    }
    var dt = e.timeStamp - drag.lt;
    if (dt > 0) drag.v = 0.8 * drag.v + 0.2 * ((e.clientX - drag.lx) / dt);
    drag.lx = e.clientX; drag.lt = e.timeStamp;
    morph.progress(Math.max(0, Math.min(1, drag.p + dx / drawerW())));
  });
  phone.addEventListener('pointerup', endDrag);
  phone.addEventListener('pointercancel', endDrag);
  phone.addEventListener('click', function (e) {
    if (suppressClick) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  var heroTracked = false;
  function trackHero(via) { if (!heroTracked) { heroTracked = true; track('hero-phone', { via: via }); } }
  burger.addEventListener('click', function () {
    touched = true;
    trackHero('tap');
    goTo(morph.progress() < 0.5 ? 1 : 0);
  });
  scrim.addEventListener('click', function () { touched = true; goTo(0); });
  drawerRows.forEach(function (row, i) {
    row.addEventListener('click', function () {
      if (morph.progress() < 0.5) return;
      setActive(i);
      jump(row.getAttribute('data-target'));
    });
  });

  /* ---------- Timeline rail ---------- */
  var glow = $('#railGlow');
  var nodes = $$('.rail-nodes li');
  var secs = $$('[data-node]');
  var fracs = [0, 0.2, 0.4, 0.6, 0.8, 1];
  function calcRail() {
    var max = ScrollTrigger.maxScroll(window) || 1;
    secs.forEach(function (s, i) {
      var top = s.getBoundingClientRect().top + window.pageYOffset - window.innerHeight * 0.5;
      fracs[i] = i === 0 ? 0 : Math.max(0, Math.min(1, top / max));
      if (nodes[i]) nodes[i].style.top = i === 5 ? 'calc(' + (fracs[i] * 100) + '% - 10px)' : (fracs[i] * 100) + '%';
    });
    if (nodes[5]) fracs[5] = Math.min(fracs[5], 0.97);
  }
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: function (self) {
      var p = self.progress;
      glow.style.strokeDashoffset = String(100 - p * 100);
      var cur = 0;
      nodes.forEach(function (li, i) { var on = p >= fracs[i] - 0.002; li.classList.toggle('on', on); if (on) cur = i; });
      if (drawerRows[cur]) setActive(cur >= 6 ? 5 : cur);
    }
  });
  nodes[0].classList.add('on');
  glow.style.strokeDashoffset = '100';
  ScrollTrigger.addEventListener('refresh', calcRail);

  /* ---------- Chapter 1 horizontal arcade (desktop) ---------- */
  mm.add('(min-width: 900px)', function () {
    var wrap = $('#hscroll'), track = $('#htrack');
    var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth + 20); };
    gsap.to(track, {
      x: function () { return -dist(); },
      ease: 'none',
      scrollTrigger: {
        trigger: wrap, start: 'top 90px', end: function () { return '+=' + dist(); },
        pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1
      }
    });
  });

  /* ---------- Split chapters (ch2, ch3): scrubbed cards, indicator, progress bar, sticky-until-bottom text ---------- */
  var splits = $$('.split').map(function (sp) {
    return {
      el: sp, text: $('.split-text', sp), cards: $$('.split-stack .card', sp),
      body: $('.split-ind-body', sp), fill: $('.split-bar i', sp), idx: 0
    };
  });
  function splitWrite(S, i) {
    var c = S.cards[i];
    var nm = $('figcaption b', c) || $('b', c), cp = $('figcaption span', c) || $('p', c);
    $('.split-num', S.body).textContent = '0' + (i + 1) + ' / 0' + S.cards.length;
    $('.split-name', S.body).textContent = nm.textContent;
    $('.split-cap', S.body).textContent = cp.textContent;
  }
  function splitSet(S, i) {
    if (i === S.idx || !S.body) return;
    S.idx = i;
    gsap.to(S.body, {
      opacity: 0, y: -6, duration: 0.12, overwrite: true,
      onComplete: function () {
        splitWrite(S, i);
        gsap.fromTo(S.body, { y: 6 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
      }
    });
  }
  /* text stays sticky until its own bottom is visible: top goes negative when taller than the viewport */
  function splitTops() {
    var desk = window.innerWidth >= 900;
    var navH = $('.nav') ? $('.nav').offsetHeight : 64;
    splits.forEach(function (S) {
      if (!desk) { S.text.style.top = ''; if (S.body) S.body.style.minHeight = ''; return; }
      if (S.body) {
        S.body.style.minHeight = '';
        var mx = 0;
        S.cards.forEach(function (c, i) { splitWrite(S, i); mx = Math.max(mx, S.body.offsetHeight); });
        splitWrite(S, S.idx);
        S.body.style.minHeight = mx + 'px';
      }
      S.text.style.top = Math.min(navH + 32, window.innerHeight - S.text.offsetHeight - 24) + 'px';
    });
  }
  ScrollTrigger.addEventListener('refresh', splitTops);
  window.addEventListener('resize', splitTops);
  mm.add('(min-width: 900px)', function () {
    splits.forEach(function (S) {
      S.cards.forEach(function (c, i) {
        gsap.fromTo(c, { y: 80, opacity: 0.35, scale: 0.96 }, {
          y: 0, opacity: 1, scale: 1, ease: 'none',
          scrollTrigger: { trigger: c, start: 'top 95%', end: 'top 55%', scrub: true }
        });
        ScrollTrigger.create({
          trigger: c, start: 'top 50%', end: 'bottom 50%',
          onToggle: function (self) { if (self.isActive) splitSet(S, i); }
        });
      });
      ScrollTrigger.create({
        trigger: $('.split-stack', S.el), start: 'top 60%', end: 'bottom 60%',
        onUpdate: function (self) { if (S.fill) S.fill.style.transform = 'scaleY(' + self.progress.toFixed(3) + ')'; }
      });
    });
  });
  mm.add('(max-width: 899px)', function () {
    splits.forEach(function (S) {
      S.cards.forEach(function (c) {
        gsap.from(c, { y: 34, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: c, start: 'top 90%', toggleActions: 'play none none reverse' } });
      });
    });
  });

  /* ---------- reveals and counters ---------- */
  {
    $$('.story, .eyebrow, .card:not(.htrack .card):not(.split-stack .card), .gauge:not(.impact .gauge), .repo, .pillars, .showcase, .pipe, .case-card, .agent-flow, .evals').forEach(function (el) {
      if (el.closest('.prologue')) return;
      gsap.from(el, {
        y: 34, opacity: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' }
      });
    });
    gsap.from('.copy > *', { y: 24, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out', delay: 0.15 });

    $$('.num').forEach(function (n) {
      var run = function () {
        if (n.classList.contains('swap')) {
          n.textContent = '1 Month';
          gsap.delayedCall(0.9, function () {
            n.innerHTML = '1 Month &rarr; 1 Week';
            gsap.from(n, { opacity: 0.2, scale: 0.94, duration: 0.6, ease: 'back.out(2)' });
          });
          return;
        }
        var target = Number(n.dataset.count);
        var pre = (n.dataset.prefix || '').replace('&lt;', '<');
        var suf = n.dataset.suffix || '';
        var fmt = function (v) { n.textContent = pre + Math.round(v).toLocaleString('en-US') + suf; };
        var o = { v: 0 };
        gsap.to(o, { v: target, duration: 2, ease: 'power2.out', onUpdate: function () { fmt(o.v); } });
      };
      if (!n.classList.contains('swap')) {
        var pre0 = (n.dataset.prefix || '').replace('&lt;', '<');
        n.textContent = pre0 + '0' + (n.dataset.suffix || '');
      }
      ScrollTrigger.create({ trigger: n, start: 'top 90%', once: true, onEnter: run });
    });
  }

  /* ---------- Case study and agent flows: steps light up in order with the scroll (and go dark again going back) ---------- */
  $$('.flow, .agent-flow').forEach(function (fl) {
    var items = $$('li, .af-step', fl);
    ScrollTrigger.create({
      trigger: fl, start: 'top 85%', end: 'bottom 55%',
      onUpdate: function (self) {
        var n = Math.round(self.progress * items.length);
        items.forEach(function (li, k) { li.classList.toggle('lit', k < n); });
      }
    });
  });

  /* ---------- Eval results count up when the table scrolls in (and reset going back up) ---------- */
  $$('.evals td').forEach(function (td) {
    var m = td.textContent.trim().match(/^([\d.]+)(.*)$/);
    if (!m) return;
    var end = parseFloat(m[1]), suffix = m[2], dec = (m[1].split('.')[1] || '').length;
    var o = { v: 0 };
    var show = function () { td.textContent = o.v.toFixed(dec) + suffix; };
    var tw = gsap.to(o, { v: end, duration: 1.4, ease: 'power2.out', paused: true, onUpdate: show });
    show();
    ScrollTrigger.create({
      trigger: td.closest('table'), start: 'top 85%',
      onEnter: function () { tw.restart(); },
      onLeaveBack: function () { tw.pause(0); show(); }
    });
  });

  /* ---------- Hardware to cloud pipeline ---------- */
  var pipeEl = $('#pipe');
  var steps = [
    ['Physical Machine', 'Sensor'], ['SmartX', 'Gateway (C++)'], ['MQTT', 'Broker'],
    ['Redis', 'Queue'], ['Multi-Tenant', 'PostgreSQL'], ['Live WebSockets', 'Dashboard']
  ];
  var pipeKill = [];
  var NS = 'http://www.w3.org/2000/svg';
  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function buildPipe() {
    pipeKill.forEach(function (k) { k.kill(); });
    pipeKill = [];
    pipeEl.innerHTML = '';
    var vertical = window.innerWidth < 900;
    var pts = steps.map(function (s, i) {
      return vertical ? { x: 30, y: 30 + i * 60 } : { x: 85 + i * 166, y: 56 };
    });
    var svg = mk('svg', { viewBox: vertical ? '0 0 340 360' : '0 0 1000 150', role: 'img', 'aria-label': 'Physical Machine Sensor to SmartX Gateway to MQTT Broker to Redis Queue to Multi-Tenant PostgreSQL to Live WebSockets Dashboard' }, pipeEl);
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x + ' ' + p.y; }).join(' ');
    mk('path', { d: d, class: 'pl' }, svg);
    var pg = mk('path', { d: d, class: 'pg' }, svg);
    var len = pg.getTotalLength();
    pg.style.strokeDasharray = len;
    pg.style.strokeDashoffset = len;
    pts.forEach(function (p, i) {
      mk('circle', { cx: p.x, cy: p.y, r: 13, class: 'pn' }, svg);
      // vertical (below 900px): one-line labels beside each node keep the diagram short
      var t = mk('text', { x: vertical ? p.x + 28 : p.x, y: vertical ? p.y + 5 : p.y + 42, 'text-anchor': vertical ? 'start' : 'middle' }, svg);
      if (vertical) { t.textContent = steps[i].join(' '); return; }
      steps[i].forEach(function (line, k) {
        var ts = mk('tspan', { x: p.x, dy: k ? 17 : 0 }, t);
        ts.textContent = line;
      });
    });
    // the line's head carries the dot; each node it passes keeps a copy of the dot
    var at = [0];
    for (var i = 1; i < pts.length; i++) {
      at.push(at[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    var copies = pts.map(function (p) {
      var c = mk('circle', { cx: p.x, cy: p.y, r: 5.5, class: 'pk' }, svg);
      gsap.set(c, { scale: 0, transformOrigin: '50% 50%' });
      return { el: c, on: false };
    });
    var pk = mk('circle', { cx: pts[0].x, cy: pts[0].y, r: 7, class: 'pk' }, svg);
    var head = { p: 0 };
    function placeHead() {
      var l = head.p * len, q = pg.getPointAtLength(l);
      pg.style.strokeDashoffset = len - l;
      pk.setAttribute('cx', q.x);
      pk.setAttribute('cy', q.y);
      copies.forEach(function (c, k) {
        var on = head.p > 0.002 && l >= at[k] - 0.5;
        if (on === c.on) return;
        c.on = on;
        gsap.to(c.el, { scale: on ? 1 : 0, duration: on ? 0.35 : 0.2, ease: on ? 'back.out(2.4)' : 'power1.in', overwrite: true });
      });
    }
    var draw = gsap.to(head, {
      p: 1, ease: 'none', onUpdate: placeHead,
      scrollTrigger: vertical
        ? { trigger: pipeEl, start: 'top 62%', end: 'bottom 55%', scrub: 0.6 }
        : { trigger: pipeEl, start: 'top 80%', end: 'center 45%', scrub: 0.6 }
    });
    placeHead();
    pipeKill.push(draw.scrollTrigger, draw);
  }
  buildPipe();
  var lastVert = window.innerWidth < 900;
  window.addEventListener('resize', function () {
    var v = window.innerWidth < 900;
    if (v !== lastVert) { lastVert = v; buildPipe(); softRefresh(true); }
  });

  /* ---------- Ch4 drone: parks beside the title word, powers on, scroll-scrubbed flight (left, right, landing) behind the text ---------- */
  (function () {
    var ch4 = $('#ch4'), lane = $('#droneLane'), drone = $('#drone'), shadow = $('#droneShadow');
    var story = ch4 && $('.story', ch4), stage = ch4 && $('.showcase', ch4), word = ch4 && $('.drone-word', ch4);
    var wrap = ch4 && $('.wrap', ch4), title = ch4 && $('h2', ch4);
    if (!ch4 || !lane || !drone || !shadow || !story || !stage || !word || !wrap || !title) return;
    var inner = $('svg', drone), led = $('.led', drone);
    var rotors = $$('.rt', drone).map(function (g) {
      return { bl: $('.bl', g), rb: $('.rb', g) };
    });
    var shadow2 = shadow.cloneNode(false);
    shadow2.removeAttribute('id');
    lane.appendChild(shadow2);
    var STILL = [-14, 11, 19, -9];
    var FEET = 75.2 / 84;
    var LAND = 0.8; // last 20% of the scrub is the vertical landing, so going back it takes off before it moves
    var pathEl = mk('path', {}, mk('svg', { 'aria-hidden': 'true', style: 'position:absolute;width:0;height:0;visibility:hidden' }, lane));
    var geo = null, vis = false, de = 0, off = 0, spin = 0, bobT = 0;
    var OFF = 0.93; // touchdown at OFF, then rotors and LED power down over the rest of the scrub
    var prox = { p: 0 }, pw = { v: 0 };
    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
    var ease = function (x) { return x * x * (3 - 2 * x); };
    function rel(el) {
      var l = 0, t = 0, n = el;
      while (n && n !== ch4) { l += n.offsetLeft; t += n.offsetTop; n = n.offsetParent; }
      return { l: l, t: t, w: el.offsetWidth, h: el.offsetHeight };
    }
    function measure() {
      var mob = window.innerWidth < 900;
      var W = mob ? 64 : clamp(Math.round(window.innerWidth * 0.085), 96, 140);
      var H = W * 84 / 140;
      var S = rel(story), T = rel(stage), Wp = rel(wrap), L = ch4.offsetWidth;
      var cs = getComputedStyle(wrap);
      var cb = ch4.getBoundingClientRect(), wl = word.getClientRects(), wr = wl[wl.length - 1];
      var gap = mob ? 18 : 52;
      var px = wr.right - cb.left + gap + W / 2, py = wr.top - cb.top + wr.height / 2;
      var lines = [], rg = document.createRange();
      rg.selectNodeContents(title);
      [].forEach.call(rg.getClientRects(), function (q) {
        if (q.width < 4 || q.height > wr.height * 1.6) return;
        var k = Math.round(q.top / 6), f = lines.filter(function (z) { return z.k === k; })[0];
        if (f) f.r = Math.max(f.r, q.right); else lines.push({ k: k, r: q.right, c: q.top + q.height / 2 });
      });
      var need = function (z) {
        return lines.reduce(function (m, y) { return Math.abs(y.c - z.c) < H / 2 + 14 ? Math.max(m, y.r) : m; }, 0);
      };
      var room = function (right) { return right + gap + W + 6 <= cb.left + L; };
      var ln = lines.filter(function (z) { return Math.abs(z.c - (wr.top + wr.height / 2)) < 6; })[0];
      if (!ln || need(ln) > wr.right + 2 || !room(wr.right)) {
        var alt = lines.filter(function (z) { return room(need(z)); }).sort(function (u, v) { return u.c - v.c; })[0];
        if (alt) { px = need(alt) - cb.left + gap + W / 2; py = alt.c - cb.top; }
        else { px = L - W / 2 - 8; py = title.getBoundingClientRect().top - cb.top - H / 2 - 4; }
      }
      var cx = T.l + T.w / 2;
      var xl = Math.max(Wp.l + (parseFloat(cs.paddingLeft) || 0), 6) + W / 2;
      var xr = Math.min(Wp.l + Wp.w - (parseFloat(cs.paddingRight) || 0), L - 6) - W / 2;
      var desc = mob ? 30 : 46;
      var landY = T.t - 2 - FEET * H + H / 2;
      var yEnd = landY - desc;
      var y1 = S.t + S.h * 0.3;
      var y2 = S.t + S.h * (mob ? 0.66 : 0.7);
      if (y2 > yEnd - 40) y2 = yEnd - 40;
      if (y1 > y2 - 30) y1 = y2 - 30;
      if (y1 < py + 30) y1 = py + 30;
      var pts = [[px, py], [xl, y1], [xr, y2], [cx, yEnd]];
      var d = 'M' + pts[0][0] + ' ' + pts[0][1];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], h = (b[1] - a[1]) * 0.5;
        d += ' C' + a[0] + ' ' + (a[1] + h) + ' ' + b[0] + ' ' + (b[1] - h) + ' ' + b[0] + ' ' + b[1];
      }
      pathEl.setAttribute('d', d);
      geo = { len: pathEl.getTotalLength(), desc: desc, cx: cx, sy: T.t - 2, W: W, H: H, px: px, py: py };
      drone.style.setProperty('--dw', W + 'px');
      shadow.style.width = shadow2.style.width = Math.round(W * 0.85) + 'px';
      render(prox.p);
    }
    function rotorState(t) {
      for (var i = 0; i < rotors.length; i++) {
        var sx = 1 - spin * 0.88 * Math.abs(Math.sin(t * 38 + i * 1.7));
        rotors[i].bl.setAttribute('transform', 'rotate(' + (STILL[i] * (1 - spin)).toFixed(1) + ') scale(' + sx.toFixed(3) + ' 1)');
        rotors[i].bl.style.opacity = (1 - 0.7 * spin).toFixed(2);
        rotors[i].rb.style.opacity = (0.5 * spin).toFixed(2);
      }
    }
    function ledState(t) {
      var on = clamp(pw.v * 1.6 - 0.2, 0, 1) * (1 - off * 0.85);
      var o = Math.min(1, 0.18 + on * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 4))));
      led.style.opacity = o.toFixed(2);
      led.style.filter = on > 0.02 ? 'drop-shadow(0 0 ' + (2 + 5 * on).toFixed(1) + 'px #ff3b47)' : 'none';
    }
    function render(p) {
      if (!geo) return;
      var pp = Math.min(p / LAND, 1);
      de = p > LAND ? ease(Math.min(1, (p - LAND) / (OFF - LAND))) : 0;
      off = p > OFF ? ease((p - OFF) / (1 - OFF)) : 0;
      var fly = clamp(p / 0.04, 0, 1);
      var pwe = ease(pw.v);
      spin = pwe * (1 - off);
      var len = geo.len * pp;
      var a = pathEl.getPointAtLength(len);
      var b = pathEl.getPointAtLength(Math.min(geo.len, len + 5));
      var c = pathEl.getPointAtLength(Math.max(0, len - 5));
      var dx = b.x - c.x, dist = Math.sqrt(dx * dx + (b.y - c.y) * (b.y - c.y)) || 1;
      var bank = clamp(dx / dist * 12, -12, 12) * (1 - de);
      var lift = 10 * pwe * (1 - de);
      gsap.set(drone, { x: a.x, y: a.y + de * geo.desc - lift, xPercent: -50, yPercent: -50, rotation: bank, opacity: 0.82 + 0.18 * Math.max(de, 1 - fly) });
      gsap.set(shadow, { x: geo.cx, y: geo.sy, xPercent: -50, yPercent: -50, scale: 0.3 + 0.7 * de, opacity: de * 0.9 });
      gsap.set(shadow2, { x: geo.px, y: geo.py + (FEET - 0.5) * geo.H + 3, xPercent: -50, yPercent: -50, scale: 0.8 - 0.15 * pwe, opacity: 0.3 * (1 - fly) * (1 - 0.5 * pwe) });
      rotorState(bobT);
      ledState(bobT);
    }
    function tick(time) {
      if (!vis) return;
      bobT = time;
      inner.style.transform = 'translateY(' + (Math.sin(time * 2.2) * 4 * ease(pw.v) * (1 - de)).toFixed(2) + 'px)';
      rotorState(time);
      ledState(time);
    }
    measure();
    var power = gsap.to(pw, { v: 1, duration: 0.8, ease: 'none', paused: true, onUpdate: function () { render(prox.p); } });
    ScrollTrigger.create({
      trigger: '#ch4 .drone-word', start: 'center 45%', end: 'max',
      onToggle: function (self) { if (self.isActive) power.play(); else power.reverse(); }
    });
    gsap.to(prox, {
      p: 1, ease: 'none', onUpdate: function () { render(prox.p); },
      scrollTrigger: { trigger: '#ch4 .drone-word', start: 'center 32%', endTrigger: stage, end: 'top 58%', scrub: 0.8 }
    });
    ScrollTrigger.create({ trigger: ch4, start: 'top bottom', end: 'bottom top', onToggle: function (self) { vis = self.isActive; } });
    ScrollTrigger.addEventListener('refreshInit', measure);
    gsap.ticker.add(tick);
  })();

  $$('img[loading=lazy]').forEach(function (im) { if (!im.complete) im.addEventListener('load', function () { softRefresh(); }); });
  $$('video').forEach(function (v) { v.addEventListener('loadedmetadata', function () { softRefresh(); }); });
  window.addEventListener('load', function () { lastH = docH(); ScrollTrigger.refresh(); restorePos(); });

  /* ---------- analytics: which chapters visitors reach (no-op until the Umami script is switched on) ---------- */
  $$('section[id], footer[id]').forEach(function (s) {
    ScrollTrigger.create({
      trigger: s, start: 'top 60%', once: true,
      onEnter: function () { track('section-view', { section: s.id }); }
    });
  });
  // contact and outbound clicks, with where on the page they happened
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href'), place = placeOf(a), name = null, data = { place: place };
    if (href.indexOf('calendly.com') > -1) name = 'book-call';
    else if (href.indexOf('mailto:') === 0) name = 'email';
    else if (a.hasAttribute('download')) name = 'cv-download';
    else if (href.indexOf('linkedin.com') > -1) name = 'linkedin';
    else if (href.indexOf('github.com') > -1) { name = 'github'; data.target = href.replace(/^https?:\/\/github\.com\/?/, '') || 'profile'; }
    else if (/^https?:/.test(href)) { name = 'outbound'; data.url = href; }
    if (name) track(name, data);
  });
  // how far down the page people get
  [25, 50, 75, 100].forEach(function (pct) {
    ScrollTrigger.create({
      start: function () { return ScrollTrigger.maxScroll(window) * (pct / 100) - (pct === 100 ? 4 : 0); },
      once: true,
      onEnter: function () { track('scroll-depth', { percent: pct }); }
    });
  });

  /* ---------- crossing the 900px breakpoint: rebuild at the new size and return to the same spot ---------- */
  // desktop and mobile build different pins, paths and layouts, so a clean rebuild beats patching live tweens
  var POS_KEY = 'storyPos', startMobile = window.innerWidth < 900, bpTimer = null;
  function posNow() {
    var mid = window.innerHeight / 2, hit = null;
    $$('section[id], footer[id]').forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (!hit && r.top <= mid && r.bottom >= mid) hit = { id: s.id, f: (mid - r.top) / (r.height || 1) };
    });
    return hit;
  }
  function restorePos() {
    var p = null;
    try { p = JSON.parse(sessionStorage.getItem(POS_KEY)); sessionStorage.removeItem(POS_KEY); } catch (e) {}
    var el = p && document.getElementById(p.id);
    if (!el) return;
    var r = el.getBoundingClientRect();
    var y = Math.max(0, r.top + window.pageYOffset + p.f * r.height - window.innerHeight / 2);
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
    ScrollTrigger.update();
  }
  window.addEventListener('resize', function () {
    if ((window.innerWidth < 900) === startMobile) return;
    clearTimeout(bpTimer);
    bpTimer = setTimeout(function () {
      if ((window.innerWidth < 900) === startMobile) return;
      try { sessionStorage.setItem(POS_KEY, JSON.stringify(posNow())); } catch (e) {}
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      location.reload();
    }, 300);
  });
})();
