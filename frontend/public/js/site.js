/* Goforge Digital: progressive enhancement. Every link and form also works without JS. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  root.classList.add('js');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  doc.addEventListener('click', function (e) {
    var printBtn = e.target.closest('[data-print]');
    if (printBtn) { e.preventDefault(); window.print(); }
  });

  /* ---------- header ---------- */
  var header = doc.querySelector('[data-header]');
  var parallax = Array.prototype.slice.call(doc.querySelectorAll('[data-parallax]'));
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      if (header) header.classList.toggle('is-scrolled', y > 8);
      if (!reduceMotion && window.innerWidth > 1000) {
        parallax.forEach(function (el) {
          var r = el.getBoundingClientRect();
          var center = r.top + r.height / 2 - window.innerHeight / 2;
          el.style.translate = '0 ' + (center * -parseFloat(el.getAttribute('data-parallax'))).toFixed(1) + 'px';
        });
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var menuBtn = doc.querySelector('[data-menu-btn]');
  var menu = doc.querySelector('[data-menu]');
  function setMenu(open) {
    if (!menuBtn) return;
    menuBtn.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    var label = menuBtn.querySelector('.menu-label');
    if (label) label.textContent = open ? 'Close' : 'Menu';
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true' && !doc.querySelector('dialog[open]')) { setMenu(false); menuBtn.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 1000) setMenu(false); });
  }

  /* ---------- scroll reveal ---------- */
  var revealEls = doc.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window && revealEls.length) {
    root.classList.add('reveal-on');
    doc.querySelectorAll('[data-reveal-group]').forEach(function (group) {
      var items = group.querySelectorAll(':scope > [data-reveal]');
      items.forEach(function (el, i) { el.style.setProperty('--d', Math.min(i * 0.07, 0.42).toFixed(2) + 's'); });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (entry.isIntersecting) { el.classList.add('is-in'); el.classList.remove('is-past'); }
        // Gentle zoom-out once an element has scrolled up and out of view; zooms back in on return.
        else if (el.classList.contains('is-in') && entry.boundingClientRect.top < 0) el.classList.add('is-past');
        else if (entry.boundingClientRect.top > 0) el.classList.remove('is-past');
      });
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0 });
    revealEls.forEach(function (el) {
      // Anything already on screen at load shows straight away.
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) el.classList.add('is-in');
      io.observe(el);
    });
    var lines = doc.querySelectorAll('[data-line]');
    var lio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-drawn'); lio.unobserve(e.target); } });
    }, { threshold: 0.3 });
    lines.forEach(function (l) { lio.observe(l); });
    doc.querySelectorAll('[data-count]').forEach(function (node) {
      var end = Number(node.getAttribute('data-count'));
      if (!end) return;
      var start = performance.now();
      var dur = 900;
      function tick(now) {
        var p = Math.min(1, (now - start) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        node.textContent = String(Math.round(end * eased));
        if (p < 1) requestAnimationFrame(tick);
      }
      node.textContent = '0';
      requestAnimationFrame(tick);
    });
  } else {
    root.classList.add('no-reveal');
  }

  /* ---------- scroll-linked zoom fallback (browsers without CSS view timelines) ---------- */
  var zoomEls = doc.querySelectorAll('[data-zoom]');
  if (zoomEls.length && !reduceMotion && !(window.CSS && CSS.supports && CSS.supports('animation-timeline: view()'))) {
    var zticking = false;
    function zoomFrame() {
      zticking = false;
      if (root.classList.contains('motion-paused')) { zoomEls.forEach(function (el) { el.style.scale = ''; }); return; }
      var vh = window.innerHeight;
      zoomEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        var c = (r.top + r.height / 2) / vh;           // 0 = top of viewport, 1 = bottom
        var d = Math.min(1, Math.abs(c - 0.5) * 1.6);  // distance from the centre
        el.style.scale = (1 - d * 0.06).toFixed(4);
      });
    }
    function zoomTick() { if (!zticking) { zticking = true; window.requestAnimationFrame(zoomFrame); } }
    window.addEventListener('scroll', zoomTick, { passive: true });
    window.addEventListener('resize', zoomTick);
    zoomFrame();
  }

  /* ---------- modals ---------- */
  var openStack = [];
  var supportsDialog = typeof HTMLDialogElement === 'function' && 'showModal' in HTMLDialogElement.prototype;

  function focusables(container) {
    return Array.prototype.filter.call(
      container.querySelectorAll('a[href], button:not([disabled]), input:not([type=hidden]):not([tabindex="-1"]), select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (el) { return el.offsetParent !== null && !el.closest('.hp'); }
    );
  }
  function prefill(scope, name, value) {
    if (!scope || !name) return;
    var form = scope.matches && scope.matches('form') ? scope : scope.querySelector('form');
    if (!form || !form.elements[name]) return;
    form.elements[name].value = value;
    var err = form.querySelector('[data-error-for="' + name + '"]');
    if (err) { err.textContent = ''; var f = err.closest('.field'); if (f) f.classList.remove('has-error'); form.elements[name].removeAttribute('aria-invalid'); }
  }
  function resetSent(dlg) {
    var form = dlg.querySelector('form.is-sent');
    if (form) { form.classList.remove('is-sent'); form.querySelector('[data-form-success]').hidden = true; }
  }
  function openDialog(dlg, opener) {
    if (!dlg || dlg.open) return;
    dlg._opener = opener || doc.activeElement;
    resetSent(dlg);
    setMenu(false);
    dlg.showModal();
    openStack.push(dlg);
    doc.body.classList.add('is-locked');
    var target = dlg.querySelector('form input:not([type=hidden]):not([tabindex="-1"]), form select') || dlg.querySelector('.modal-title');
    var f = focusables(dlg);
    // Focus the first form field for forms, otherwise the close button, so screen readers start at the top.
    if (dlg.querySelector('form')) { var first = f.filter(function (el) { return el.matches('input, select, textarea'); })[0]; (first || f[0]).focus(); }
    else if (f[0]) f[0].focus();
  }
  function closeDialog(dlg, instant, keepFocus) {
    if (!dlg || !dlg.open) return;
    var done = function () {
      dlg.classList.remove('is-closing');
      dlg.close();
      openStack = openStack.filter(function (d) { return d !== dlg; });
      if (!openStack.length) doc.body.classList.remove('is-locked');
      if (!keepFocus && dlg._opener && doc.contains(dlg._opener)) dlg._opener.focus();
    };
    if (instant || reduceMotion) return done();
    dlg.classList.add('is-closing');
    setTimeout(done, 200);
  }

  if (supportsDialog) {
    doc.querySelectorAll('dialog[data-modal]').forEach(function (dlg) {
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); closeDialog(dlg); }); // Esc
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) closeDialog(dlg); // backdrop
        if (e.target.closest('[data-close]')) closeDialog(dlg);
      });
      dlg.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var f = focusables(dlg);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    });
  }

  doc.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-dialog]');
    if (!trigger || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var name = trigger.getAttribute('data-prefill-name');
    var value = trigger.getAttribute('data-prefill-value');
    var current = trigger.closest('dialog[open]');
    var dlg = supportsDialog ? doc.getElementById(trigger.getAttribute('data-dialog')) : null;
    if (dlg) {
      e.preventDefault();
      var opener = current ? current._opener : trigger;
      if (current) closeDialog(current, true, true);
      prefill(dlg, name, value);
      openDialog(dlg, opener);
      return;
    }
    // No dialog on this page (the form is already inline): scroll to it and prefill.
    var formKey = trigger.getAttribute('data-fallback-form');
    var inline = formKey && doc.querySelector('form[data-form="' + formKey + '"]');
    if (inline) {
      e.preventDefault();
      if (current) closeDialog(current, true, true);
      prefill(inline, name, value);
      setMenu(false);
      inline.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      var field = inline.querySelector('input:not([type=hidden]):not([tabindex="-1"])');
      if (field) setTimeout(function () { field.focus({ preventScroll: true }); }, reduceMotion ? 0 : 450);
    }
  });

  /* ---------- admin: change status on select ---------- */
  doc.querySelectorAll('[data-autosubmit]').forEach(function (sel) {
    sel.addEventListener('change', function () { sel.form.requestSubmit ? sel.form.requestSubmit() : sel.form.submit(); });
  });

  /* ---------- forms: validate, save, confirm ---------- */
  function phoneOk(v) { var d = v.replace(/\D/g, ''); return /^[+\d\s\-().]+$/.test(v) && d.length >= 10 && d.length <= 15; }
  function setError(form, name, msg) {
    var el = form.elements[name];
    var out = form.querySelector('[data-error-for="' + name + '"]');
    if (!el || !out) return;
    var field = out.closest('.field');
    out.textContent = msg || '';
    if (msg) { el.setAttribute('aria-invalid', 'true'); if (field) field.classList.add('has-error'); }
    else { el.removeAttribute('aria-invalid'); if (field) field.classList.remove('has-error'); }
  }
  function validate(form) {
    var errors = {};
    Array.prototype.forEach.call(form.querySelectorAll('input, select, textarea'), function (el) {
      if (!el.name || el.type === 'hidden' || el.closest('.hp')) return;
      var v = el.type === 'checkbox' ? (el.checked ? 'yes' : '') : (el.value || '').trim(), msg = '';
      if (el.required && !v) msg = 'This field is required.';
      else if (v && el.minLength > 0 && v.length < el.minLength) msg = 'This looks too short.';
      else if (v && el.maxLength > 0 && v.length > el.maxLength) msg = 'This is too long.';
      else if (v && el.type === 'tel' && !phoneOk(v)) msg = 'Please enter a valid number, for example +91 98765 43210.';
      if (msg) errors[el.name] = msg;
    });
    var track = form.elements.track, note = form.elements.note;
    if (track && note && /^Similar role/.test(track.value) && note.value.trim().length < 5) errors.note = 'Please name the role you want in the note.';
    return errors;
  }

  doc.querySelectorAll('[data-ajax-form]').forEach(function (form) {
    var alertBox = form.querySelector('[data-form-alert]');
    var submit = form.querySelector('[data-submit]');
    var success = form.querySelector('[data-form-success]');
    form.addEventListener('input', function (e) {
      if (e.target.name && e.target.getAttribute('aria-invalid') === 'true') setError(form, e.target.name, validate(form)[e.target.name]);
    });
    form.addEventListener('submit', function (e) {
      if (!window.fetch || !window.FormData) return;
      e.preventDefault();
      var errors = validate(form);
      Array.prototype.forEach.call(form.querySelectorAll('[data-error-for]'), function (o) { var n = o.getAttribute('data-error-for'); setError(form, n, errors[n]); });
      var names = Object.keys(errors);
      if (names.length) { alertBox.textContent = 'Please check the highlighted fields.'; alertBox.hidden = false; form.elements[names[0]].focus(); return; }
      alertBox.hidden = true;
      submit.disabled = true;
      var label = submit.innerHTML;
      submit.textContent = 'Sending…';
      fetch(form.action, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
        credentials: 'same-origin'
      }).then(function (r) {
        return r.json().catch(function () { return { ok: false, message: 'Something went wrong. Please try again.' }; });
      }).then(function (data) {
        submit.disabled = false; submit.innerHTML = label;
        if (!data.ok) {
          if (data.errors) Object.keys(data.errors).forEach(function (n) { setError(form, n, data.errors[n]); });
          alertBox.textContent = data.message || 'Please check the highlighted fields.';
          alertBox.hidden = false;
          var first = data.errors && Object.keys(data.errors)[0];
          if (first && form.elements[first]) form.elements[first].focus();
          return;
        }
        success.querySelector('[data-success-text]').textContent = data.message;
        success.hidden = false;
        form.classList.add('is-sent');
        form.reset();
        success.focus();
      }).catch(function () {
        submit.disabled = false; submit.innerHTML = label;
        alertBox.textContent = 'Could not reach the server. Check your connection, or call us.';
        alertBox.hidden = false;
      });
    });
  });
  /* ---------- admin: confirm destructive actions ---------- */
  document.addEventListener('submit', function (e) {
    var msg = e.target && e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });
  /* ---------- testimonial carousel (user-driven, no autoplay) ---------- */
  doc.querySelectorAll('[data-carousel]').forEach(function (c) {
    var track = c.querySelector('[data-carousel-track]');
    var prev = c.querySelector('[data-carousel-prev]'), next = c.querySelector('[data-carousel-next]');
    function step() { var item = track.querySelector('li'); return item ? item.getBoundingClientRect().width + 16 : track.clientWidth; }
    function sync() {
      var max = track.scrollWidth - track.clientWidth - 2;
      c.classList.toggle('is-static', max <= 0);
      prev.disabled = track.scrollLeft <= 2; next.disabled = track.scrollLeft >= max;
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });

  /* ---------- one control to pause all looping motion (WCAG 2.2.2) ---------- */
  var mt = doc.querySelector('[data-motion-toggle]');
  function setMotion(paused) {
    doc.documentElement.classList.toggle('motion-paused', paused);
    if (mt) { mt.setAttribute('aria-pressed', String(paused)); mt.textContent = paused ? 'Play animations' : 'Pause animations'; }
  }
  var saved = null; try { saved = localStorage.getItem('gf-motion'); } catch (_) {}
  setMotion(saved === 'paused');
  if (mt) mt.addEventListener('click', function () {
    var p = !doc.documentElement.classList.contains('motion-paused');
    setMotion(p); try { localStorage.setItem('gf-motion', p ? 'paused' : 'on'); } catch (_) {}
  });
})();
