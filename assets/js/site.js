/* =========================================================================
   The Vine Organizasyon — site.js
   Bağımlılık yok. Bölümler: menü, ışık zinciri, partiküller (konfeti + ışık),
   kaydırma animasyonları, sayaçlar, hizmet önizlemesi, galeri, video, form.
   ========================================================================= */
(() => {
  'use strict';

  const d = document;
  const root = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => Array.from(c.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  /* Eski sitedeki bölüm adresleri (#contact vb.) yeni karşılıklarına gitsin */
  const ESKI = {
    '#anasayfa': '#icerik', '#hizmetlerimiz': '#hizmetler', '#etkinlik-galerimiz': '#galeri',
    '#musteri-yorumları': '#yorumlar', '#sikca-sorulan-sorular': '#sss', '#contact': '#iletisim',
    '#call-to-action': '#iletisim', '#features-cards': '#hakkimizda',
  };
  try {
    const yeni = ESKI[decodeURIComponent(location.hash)];
    if (yeni && d.querySelector(yeni)) location.replace(yeni);
  } catch (err) { /* bozuk adres: yok say */ }

  /* Dosyadan (file://) açıldığında "./" bağlantıları klasör listesine gitmesin */
  if (location.protocol === 'file:') {
    $$('a[href^="./"]').forEach((a) => {
      a.setAttribute('href', 'index.html' + a.getAttribute('href').slice(2));
    });
  }

  /* ------------------------------------------------------------------ *
   * 1) Partiküller: arkada ışık taneleri + süzülen konfeti,
   *    önde konfeti patlamaları (sayfa açılışı ve düğme tıklamaları)
   * ------------------------------------------------------------------ */
  const Party = (() => {
    const back = $('#sahne-arka');
    const front = $('#sahne-on');
    const noop = { burst() {}, cannons() {}, scroll() {} };
    if (!back || !front || !back.getContext) return noop;

    const bctx = back.getContext('2d');
    const fctx = front.getContext('2d');
    const COLORS = ['#e8483b', '#27afcf', '#ffc666', '#8cc63f', '#f59a23', '#ffffff'];
    const SHAPES = ['rect', 'rect', 'circle', 'tri', 'ribbon'];
    const lights = [];
    const ambient = [];
    const sparks = [];
    const ptr = { x: -9999, y: -9999, vx: 0, vy: 0, nx: 0, ny: 0, t: 0 };
    let W = 0;
    let H = 0;
    let dpr = 1;
    let stageOn = true;
    let backRaf = 0;
    let frontRaf = 0;
    let lastB = 0;
    let lastF = 0;

    /* ışık tanesi dokuları (bir kez çizilir) */
    const sprites = [[255, 198, 102], [255, 232, 196], [255, 150, 138]].map(([r, g, b]) => {
      const c = d.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, `rgba(${r},${g},${b},1)`);
      gr.addColorStop(0.14, `rgba(${r},${g},${b},.8)`);
      gr.addColorStop(0.4, `rgba(${r},${g},${b},.18)`);
      gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = gr;
      x.fillRect(0, 0, 64, 64);
      return c;
    });

    const mkLight = () => {
      const depth = rand(0.25, 1);
      return {
        x: rand(0, W), y: rand(0, H), r: rand(10, 54) * depth + 6, a: rand(0.2, 0.75),
        tw: rand(0.6, 2.2), ph: rand(0, 6.28), vx: rand(-4, 4), vy: rand(-11, -3) * depth,
        depth, s: (Math.random() * 3) | 0,
      };
    };

    const mkBit = (x, y, amb) => {
      const depth = rand(0.45, 1);
      return {
        x, y, vx: 0, vy: 0, base: rand(16, 38) * depth, w: rand(6, 11) * depth, h: rand(9, 16) * depth,
        rot: rand(0, 6.28), vr: rand(-1.6, 1.6), flip: rand(0, 6.28), vf: rand(1.2, 3.6),
        wob: rand(0, 6.28), ws: rand(0.5, 1.4), wa: rand(8, 22),
        color: pick(COLORS), shape: pick(SHAPES), depth, life: 1, alpha: amb ? rand(0.45, 0.85) : 1,
      };
    };

    function size() {
      W = back.clientWidth || innerWidth;
      H = back.clientHeight || innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 2);
      [back, front].forEach((c) => {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      });
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function populate() {
      lights.length = 0;
      ambient.length = 0;
      const nL = Math.round(clamp((W * H) / 42000, 14, 44));
      for (let i = 0; i < nL; i++) lights.push(mkLight());
      if (reduce) return;
      const nA = Math.round(clamp(W / 58, 9, 26));
      for (let i = 0; i < nA; i++) ambient.push(mkBit(rand(0, W), rand(0, H), true));
    }

    function drawBit(ctx, p, a) {
      const f = Math.cos(p.flip);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.abs(f) < 0.12 ? 0.12 : f);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.w * 0.5, 0, 6.283);
        ctx.fill();
      } else if (p.shape === 'tri') {
        ctx.beginPath();
        ctx.moveTo(0, -p.h * 0.55);
        ctx.lineTo(p.w * 0.6, p.h * 0.45);
        ctx.lineTo(-p.w * 0.6, p.h * 0.45);
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'ribbon') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1.6, p.w * 0.28);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-p.h, 0);
        ctx.quadraticCurveTo(-p.h * 0.5, -p.w, 0, 0);
        ctx.quadraticCurveTo(p.h * 0.5, p.w, p.h, 0);
        ctx.stroke();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }

    function stepAmbient(p, dt, time) {
      /* imleç yaklaşınca konfeti savrulur */
      const dx = p.x - ptr.x;
      const dy = p.y - ptr.y;
      const d2 = dx * dx + dy * dy;
      const R = 130;
      if (d2 < R * R) {
        const dist = Math.sqrt(d2) || 1;
        const f = 1 - dist / R;
        p.vx += (dx / dist) * f * 900 * dt + ptr.vx * f * 0.06;
        p.vy += (dy / dist) * f * 900 * dt + ptr.vy * f * 0.06;
        p.vr += f * rand(-40, 40) * dt;
      }
      p.vx -= p.vx * 1.8 * dt;
      p.vy += (p.base - p.vy) * 1.4 * dt;
      p.vr -= (p.vr - clamp(p.vr, -1.6, 1.6)) * 2 * dt;
      p.x += (p.vx + Math.sin(time * p.ws + p.wob) * p.wa) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;
      if (p.y > H + 30) {
        p.y = -30;
        p.x = rand(0, W);
        p.vx = 0;
      } else if (p.y < -60) {
        p.y = H + 20;
      }
      if (p.x < -40) p.x = W + 40;
      else if (p.x > W + 40) p.x = -40;
    }

    function drawLights(time, dt) {
      bctx.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        if (l.y < -60) {
          l.y = H + 60;
          l.x = rand(0, W);
        } else if (l.y > H + 60) {
          l.y = -60;
        }
        if (l.x < -60) l.x = W + 60;
        else if (l.x > W + 60) l.x = -60;
        bctx.globalAlpha = l.a * (0.62 + 0.38 * Math.sin(time * l.tw + l.ph));
        bctx.drawImage(
          sprites[l.s],
          l.x - l.r / 2 + ptr.nx * l.depth * 16,
          l.y - l.r / 2 + ptr.ny * l.depth * 12,
          l.r,
          l.r
        );
      }
      bctx.globalCompositeOperation = 'source-over';
      bctx.globalAlpha = 1;
    }

    function frameBack(t) {
      backRaf = 0;
      const dt = Math.min(0.05, (t - lastB) / 1000 || 0.016);
      lastB = t;
      const time = t / 1000;
      bctx.clearRect(0, 0, W, H);
      drawLights(time, dt);
      for (const p of ambient) {
        stepAmbient(p, dt, time);
        drawBit(bctx, p, p.alpha);
      }
      bctx.globalAlpha = 1;
      ptr.vx *= 0.9;
      ptr.vy *= 0.9;
      if (stageOn && !d.hidden) backRaf = requestAnimationFrame(frameBack);
    }

    function loopBack() {
      if (reduce || backRaf || !stageOn || d.hidden) return;
      lastB = performance.now();
      backRaf = requestAnimationFrame(frameBack);
    }

    function frameFront(t) {
      frontRaf = 0;
      const dt = Math.min(0.05, (t - lastF) / 1000 || 0.016);
      lastF = t;
      const time = t / 1000;
      const drag = Math.pow(0.985, dt * 60);
      fctx.clearRect(0, 0, W, H);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.vy += 980 * dt;
        p.vx *= drag;
        p.vy *= drag;
        if (p.vy > 0) {
          /* inişte kağıt gibi süzülür */
          p.vy = Math.min(p.vy, 230 + p.base * 4);
          p.x += Math.sin(time * p.ws * 3 + p.wob) * p.wa * dt * 2;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.flip += p.vf * dt * 2.2;
        p.life -= dt;
        if (p.life <= 0 || p.y > H + 40) {
          sparks.splice(i, 1);
          continue;
        }
        drawBit(fctx, p, Math.min(1, p.life / 0.7));
      }
      fctx.globalAlpha = 1;
      if (sparks.length) frontRaf = requestAnimationFrame(frameFront);
      else fctx.clearRect(0, 0, W, H);
    }

    function burst(x, y, opts = {}) {
      if (reduce) return;
      const { count = 28, angle = -Math.PI / 2, spread = Math.PI * 1.7, power = 520, scale = 1 } = opts;
      for (let i = 0; i < count; i++) {
        const p = mkBit(x, y, false);
        const a = angle + rand(-0.5, 0.5) * spread;
        const sp = power * rand(0.35, 1);
        p.vx = Math.cos(a) * sp;
        p.vy = Math.sin(a) * sp;
        p.vr = rand(-9, 9);
        p.w *= 1.3 * scale;
        p.h *= 1.3 * scale;
        p.life = rand(2.4, 4.4);
        sparks.push(p);
      }
      if (!frontRaf) {
        lastF = performance.now();
        frontRaf = requestAnimationFrame(frameFront);
      }
    }

    /* iki alt köşeden konfeti topu */
    function cannons() {
      const power = Math.sqrt(2 * 980 * H * 0.86);
      const n = W < 700 ? 44 : 84;
      burst(W * 0.03, H * 1.02, { count: n, angle: -Math.PI * 0.36, spread: 0.75, power, scale: 1.1 });
      burst(W * 0.97, H * 1.02, { count: n, angle: -Math.PI * 0.64, spread: 0.75, power, scale: 1.1 });
    }

    /* sayfa kaydıkça taneler derinliğine göre kayar */
    function scroll(dy) {
      if (reduce || !stageOn) return;
      for (const l of lights) l.y -= dy * l.depth * 0.22;
      for (const p of ambient) p.y -= dy * p.depth * 0.45;
    }

    size();
    populate();
    if (reduce) {
      bctx.clearRect(0, 0, W, H);
      drawLights(0, 0);
    } else {
      loopBack();
    }

    let lastW = W;
    let rt = 0;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const w = back.clientWidth;
        const h = back.clientHeight;
        if (w === lastW && Math.abs(h - H) < 90) return;
        lastW = w;
        size();
        populate();
        if (reduce) drawLights(0, 0);
      }, 180);
    });

    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const now = performance.now();
      if (ptr.x > -999) {
        const dtm = Math.max(8, now - ptr.t);
        ptr.vx = ((e.clientX - ptr.x) / dtm) * 16;
        ptr.vy = ((e.clientY - ptr.y) / dtm) * 16;
      }
      ptr.x = e.clientX;
      ptr.y = e.clientY;
      ptr.nx = e.clientX / W - 0.5;
      ptr.ny = e.clientY / H - 0.5;
      ptr.t = now;
    }, { passive: true });
    root.addEventListener('pointerleave', () => { ptr.x = ptr.y = -9999; });
    d.addEventListener('visibilitychange', loopBack);

    /* yalnızca koyu (sahne) bölümler görünürken çiz */
    if ('IntersectionObserver' in window) {
      const seen = new Set();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
        stageOn = seen.size > 0;
        loopBack();
      });
      $$('[data-stage]').forEach((el) => io.observe(el));
    }

    return { burst, cannons, scroll, ptr };
  })();

  /* tıklanınca konfeti patlatan düğmeler */
  d.addEventListener('click', (e) => {
    const el = e.target.closest('[data-burst]');
    if (el && e.clientX) Party.burst(e.clientX, e.clientY, { count: 30, power: 560 });
  });

  /* ilk ziyarette açılış konfetisi (oturum başına bir kez) */
  addEventListener('load', () => {
    let seen = false;
    try {
      seen = sessionStorage.getItem('vine-konfeti') === '1';
      sessionStorage.setItem('vine-konfeti', '1');
    } catch (err) { /* depolama kapalıysa her açılışta patlar */ }
    if (!seen && scrollY < 240 && !d.hidden) setTimeout(Party.cannons, 650);
  });

  /* ------------------------------------------------------------------ *
   * 2) Üst menü
   * ------------------------------------------------------------------ */
  const header = $('.site-header');
  const toggle = $('.nav-toggle');
  const nav = $('#menu');
  let lastY = scrollY;
  let ticking = false;

  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    if (header) header.classList.toggle('is-stuck', y > 24);
    d.body.classList.toggle('is-scrolled', y > 520);
    Party.scroll(y - lastY);
    lastY = y;
  };
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  onScroll();

  const setMenu = (open) => {
    d.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
  };
  if (toggle && nav) {
    toggle.addEventListener('click', () => setMenu(!d.body.classList.contains('menu-open')));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && d.body.classList.contains('menu-open')) {
        setMenu(false);
        toggle.focus();
      }
    });
    matchMedia('(min-width: 1081px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
  }

  /* iletişim bölümündeyken sabit düğmeler formu örtmesin */
  const contact = $('#iletisim');
  if (contact && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      d.body.classList.toggle('at-contact', e.isIntersecting);
    }, { rootMargin: '-35% 0px 0px 0px' }).observe(contact);
  }

  /* bulunulan bölümü menüde işaretle */
  if ('IntersectionObserver' in window && nav) {
    const links = new Map();
    $$('a[href*="#"]', nav).forEach((a) => {
      const id = a.getAttribute('href').split('#')[1];
      const sec = id && d.getElementById(id);
      if (sec) links.set(sec, a);
    });
    if (links.size) {
      const spy = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          links.forEach((a) => a.removeAttribute('aria-current'));
          const a = links.get(e.target);
          if (a) a.setAttribute('aria-current', 'true');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      /* bağlantısı olmayan bölümler de izlenir ki işaret orada kalksın */
      $$('main > section, main > .sheet > section').forEach((sec) => spy.observe(sec));
    }
  }

  /* ------------------------------------------------------------------ *
   * 3) Işık zinciri: tel + ampuller çizilir, fotoğraflar tele asılır
   * ------------------------------------------------------------------ */
  $$('[data-garland]').forEach((g, gi) => {
    const svg = $('svg', g);
    const hangers = $$('.hanger', g);
    if (!svg) return;
    const NS = 'http://www.w3.org/2000/svg';

    const draw = () => {
      const W = g.clientWidth;
      if (!W) return;
      const wide = W >= 1000;
      const segs = W > 1500 ? 6 : W > 1150 ? 5 : W > 700 ? 4 : 3;
      const segW = W / segs;
      const y0 = 8;
      const sag = clamp(segW * 0.1, 14, 38);
      let path = '';
      let bulbs = '';
      let n = 0;
      for (let i = 0; i < segs; i++) {
        const xa = i * segW;
        path += `M${xa.toFixed(1)},${y0} Q${(xa + segW / 2).toFixed(1)},${y0 + 2 * sag} ${(xa + segW).toFixed(1)},${y0} `;
        const count = Math.max(2, Math.round(segW / 62));
        for (let k = 0; k < count; k++) {
          const t = (k + 0.5) / count;
          const x = xa + t * segW;
          const y = y0 + 4 * sag * t * (1 - t);
          bulbs += `<g class="bulb" style="--i:${n++}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">` +
            `<circle class="bulb__halo" cy="8" r="15" fill="url(#halo-${gi})"/>` +
            `<rect class="bulb__cap" x="-2.2" y="-1" width="4.4" height="5" rx="1.2"/>` +
            `<ellipse class="bulb__glass" cy="8.4" rx="3.9" ry="5"/></g>`;
        }
      }
      const h = y0 + sag + 26;
      svg.setAttribute('width', W);
      svg.setAttribute('height', h);
      svg.setAttribute('viewBox', `0 0 ${W} ${h}`);
      svg.innerHTML =
        `<defs><radialGradient id="halo-${gi}"><stop offset="0" stop-color="#ffc666" stop-opacity=".95"/>` +
        `<stop offset=".34" stop-color="#ffc666" stop-opacity=".3"/><stop offset="1" stop-color="#ffc666" stop-opacity="0"/>` +
        `</radialGradient></defs><path class="wire" d="${path}"/>${bulbs}`;

      hangers.forEach((el) => {
        const fx = parseFloat(wide ? el.dataset.x : el.dataset.xs || el.dataset.x);
        const x = fx * W;
        const i = Math.min(segs - 1, Math.floor(x / segW));
        const t = (x - i * segW) / segW;
        el.style.left = x.toFixed(1) + 'px';
        el.style.top = (y0 + 4 * sag * t * (1 - t)).toFixed(1) + 'px';
      });
      g.classList.add('is-ready');
    };

    draw();
    if ('ResizeObserver' in window) {
      let lw = g.clientWidth;
      new ResizeObserver(() => {
        if (g.clientWidth !== lw) {
          lw = g.clientWidth;
          draw();
        }
      }).observe(g);
    } else {
      addEventListener('resize', draw);
    }

    /* imleç hızına göre hafif rüzgar */
    if (!reduce && Party.ptr) {
      let wt = 0;
      const host = g.closest('section') || g;
      host.addEventListener('pointermove', () => {
        g.style.setProperty('--wind', clamp(Party.ptr.vx * 0.22, -5, 5).toFixed(2));
        clearTimeout(wt);
        wt = setTimeout(() => g.style.setProperty('--wind', 0), 140);
      }, { passive: true });
    }
  });

  /* ------------------------------------------------------------------ *
   * 4) Kaydırınca belirme + sayaçlar
   * ------------------------------------------------------------------ */
  const hasIO = 'IntersectionObserver' in window;
  if (hasIO && !reduce) {
    root.classList.add('anim');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: 0.06 });
    $$('.reveal, .reveal-img').forEach((el) => io.observe(el));

    /* 3000 -> "3000", 10000 -> "10.000" */
    const fmt = (n) => (n >= 10000 ? String(n).replace(/\B(?=(\d{3})+$)/g, '.') : String(n));
    $$('[data-count]').forEach((el) => {
      const target = Number(el.dataset.count);
      if (!target) return;
      el.textContent = '0';
      const cio = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        cio.disconnect();
        const t0 = performance.now();
        const dur = 1300 + Math.min(900, target / 9);
        const tick = (t) => {
          const k = clamp((t - t0) / dur, 0, 1);
          el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - k, 4))));
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, { threshold: 0.6 });
      cio.observe(el);
    });

    /* çağrı bandı görününce bir kez konfeti */
    const band = $('[data-cannon]');
    if (band) {
      const bio = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        bio.disconnect();
        Party.cannons();
      }, { threshold: 0.55 });
      bio.observe(band);
    }
  }

  /* ------------------------------------------------------------------ *
   * 5) Hizmet listesi: satırın üzerine gelince fotoğraf değişir
   * ------------------------------------------------------------------ */
  const pane = $('.svc-preview');
  if (pane) {
    const rows = $$('.svc[data-preview]');
    const cap = $('.svc-preview__cap');
    const imgs = new Map();
    const first = $('img', pane);
    if (first && rows[0]) imgs.set(rows[0], first);

    const ensure = (row) => {
      if (imgs.has(row)) return imgs.get(row);
      const im = new Image();
      im.alt = '';
      im.decoding = 'async';
      im.src = row.dataset.preview;
      pane.appendChild(im);
      imgs.set(row, im);
      return im;
    };
    const show = (row) => {
      const im = ensure(row);
      const on = () => {
        imgs.forEach((el, r) => {
          el.classList.toggle('is-on', el === im);
          r.classList.toggle('is-on', r === row);
        });
        if (cap) cap.textContent = row.dataset.caption || '';
      };
      if (im.complete) on();
      else im.addEventListener('load', on, { once: true });
    };
    rows.forEach((row) => {
      row.addEventListener('pointerenter', () => show(row));
      row.addEventListener('focus', () => show(row));
    });
    if (rows[0]) rows[0].classList.add('is-on');

    /* bölüm yaklaşınca diğer fotoğrafları sırayla, boşta yükle */
    if (hasIO && matchMedia('(min-width: 900px)').matches) {
      const pio = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        pio.disconnect();
        rows.forEach((row, i) => setTimeout(() => ensure(row), 350 * i));
      }, { rootMargin: '200px' });
      pio.observe(pane);
    }
  }

  /* ------------------------------------------------------------------ *
   * 6) Galeri: süzgeç, "daha fazla", büyütücü
   * ------------------------------------------------------------------ */
  $$('[data-gallery]').forEach((grid) => {
    const scope = grid.closest('section') || d;
    const shots = $$('.shot', grid);
    const chips = $$('[data-filter]', scope);
    const more = $('[data-more]', scope);
    let filter = 'all';
    let expanded = !more;

    const apply = () => {
      shots.forEach((s) => {
        const match = filter === 'all' || s.dataset.cat.split(' ').includes(filter);
        const extra = filter === 'all' && !expanded && s.hasAttribute('data-extra');
        s.hidden = !match || extra;
      });
      if (more) more.hidden = expanded || filter !== 'all';
    };
    const update = () => {
      if (reduce || !grid.animate) return apply();
      const ease = 'cubic-bezier(.2,.7,.2,1)';
      grid.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(10px)' }], { duration: 140, easing: 'ease-in' })
        .finished.then(() => {
          apply();
          grid.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: ease });
        });
    };

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        filter = chip.dataset.filter;
        chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        update();
      });
    });
    if (more) {
      more.addEventListener('click', () => {
        expanded = true;
        const firstNew = shots.find((s) => s.hidden && s.hasAttribute('data-extra'));
        update();
        if (firstNew) setTimeout(() => firstNew.focus({ preventScroll: true }), 60);
      });
    }
    apply();
  });

  /* Büyütücü: sayfadaki tüm .shot bağlantıları için tek bir <dialog> */
  const Lightbox = (() => {
    if (!('HTMLDialogElement' in window)) return null;
    const dlg = d.createElement('dialog');
    dlg.className = 'lb';
    dlg.setAttribute('aria-label', 'Fotoğraf görüntüleyici');
    dlg.innerHTML =
      '<div class="lb__bar"><span class="lb__count" aria-live="polite"></span>' +
      '<button class="lb__btn lb__close" type="button" aria-label="Kapat"><svg class="ikon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
      '<div class="lb__stage"><img class="lb__img" alt=""></div>' +
      '<button class="lb__btn lb__prev" type="button" aria-label="Önceki fotoğraf"><svg class="ikon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<button class="lb__btn lb__next" type="button" aria-label="Sonraki fotoğraf"><svg class="ikon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>' +
      '<p class="lb__cap"></p>';
    d.body.appendChild(dlg);
    const img = $('.lb__img', dlg);
    const cap = $('.lb__cap', dlg);
    const count = $('.lb__count', dlg);
    let list = [];
    let idx = 0;
    let opener = null;

    const render = () => {
      const a = list[idx];
      const thumb = $('img', a);
      const full = a.getAttribute('href');
      img.classList.add('is-loading');
      img.src = thumb.currentSrc || thumb.src;       /* önce küçük sürüm, anında */
      img.alt = thumb.alt;
      const big = new Image();
      big.onload = () => {
        if (list[idx] !== a) return;
        img.src = full;
        img.classList.remove('is-loading');
      };
      big.src = full;
      cap.textContent = thumb.alt;
      count.textContent = `${idx + 1} / ${list.length}`;
      /* komşu fotoğrafı önden al */
      const nxt = list[(idx + 1) % list.length];
      if (nxt && nxt !== a) new Image().src = nxt.getAttribute('href');
    };
    const go = (step) => {
      idx = (idx + step + list.length) % list.length;
      render();
    };
    const open = (a) => {
      const grid = a.closest('[data-gallery]') || d;
      list = $$('.shot', grid).filter((s) => !s.hidden);
      idx = Math.max(0, list.indexOf(a));
      opener = a;
      render();
      dlg.showModal();
    };

    $('.lb__close', dlg).addEventListener('click', () => dlg.close());
    $('.lb__prev', dlg).addEventListener('click', () => go(-1));
    $('.lb__next', dlg).addEventListener('click', () => go(1));
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.classList.contains('lb__stage')) dlg.close();
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    });
    dlg.addEventListener('close', () => { if (opener) opener.focus({ preventScroll: true }); });

    /* dokunmatik kaydırma */
    let sx = 0;
    let sy = 0;
    dlg.addEventListener('touchstart', (e) => {
      sx = e.changedTouches[0].clientX;
      sy = e.changedTouches[0].clientY;
    }, { passive: true });
    dlg.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
    }, { passive: true });

    return { open };
  })();

  if (Lightbox) {
    d.addEventListener('click', (e) => {
      const a = e.target.closest('a.shot');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      e.preventDefault();
      Lightbox.open(a);
    });
  }

  /* ------------------------------------------------------------------ *
   * 7) Video: tıklanana kadar YouTube yüklenmez
   * ------------------------------------------------------------------ */
  $$('.video[data-yt]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const fr = d.createElement('iframe');
      fr.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(el.dataset.yt)}?autoplay=1&rel=0`;
      fr.title = el.dataset.title || 'Video';
      fr.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      fr.allowFullscreen = true;
      fr.referrerPolicy = 'strict-origin-when-cross-origin';
      const box = d.createElement('div');
      box.className = 'video is-playing';
      box.appendChild(fr);
      el.replaceWith(box);
    });
  });

  /* ------------------------------------------------------------------ *
   * 8) İletişim formu: mesajı WhatsApp ya da e-postada hazır açar
   * ------------------------------------------------------------------ */
  $$('form[data-wa-form]').forEach((form) => {
    const note = $('.form__note', form);
    const say = (msg, err) => {
      if (!note) return;
      note.textContent = msg;
      note.classList.toggle('is-error', Boolean(err));
    };
    const compose = () => {
      const f = new FormData(form);
      const lines = ['Merhaba, web sitenizden yazıyorum.'];
      const ad = (f.get('ad') || '').toString().trim();
      const tur = (f.get('etkinlik') || '').toString().trim();
      const tarih = (f.get('tarih') || '').toString().trim();
      const mesaj = (f.get('text') || '').toString().trim();
      if (ad) lines.push('Ad: ' + ad);
      if (tur) lines.push('Etkinlik: ' + tur);
      if (tarih) {
        const [y, m, g] = tarih.split('-');
        lines.push('Tarih: ' + (g && m && y ? `${g}.${m}.${y}` : tarih));
      }
      if (mesaj) lines.push('Mesaj: ' + mesaj);
      return { text: lines.join('\n'), tur };
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const { text } = compose();
      const url = `https://wa.me/${form.dataset.waForm}?text=${encodeURIComponent(text)}`;
      const win = window.open(url, '_blank');
      if (win) win.opener = null;
      else location.href = url;
      say('WhatsApp açılıyor. Mesajınız hazır; orada "Gönder"e bastığınızda bize ulaşır.');
      const btn = e.submitter || $('button[type="submit"]', form);
      if (btn) {
        const r = btn.getBoundingClientRect();
        Party.burst(r.left + r.width / 2, r.top, { count: 34, power: 600 });
      }
    });
    const mail = $('[data-mail]', form);
    if (mail) {
      mail.addEventListener('click', () => {
        if (!form.reportValidity()) return;
        const { text, tur } = compose();
        const subject = tur ? `${tur} için bilgi talebi` : 'Organizasyon bilgi talebi';
        location.href = `mailto:${mail.dataset.mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
        say('E-posta uygulamanız açılıyor. Mesajınız hazır; göndermeniz yeterli.');
      });
    }
  });

  /* telif yılı */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
