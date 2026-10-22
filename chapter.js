/* chapter.js — pagina chapter.html (pagina a TAB).
 * Tab: "Lezione guidata" | "Riassunto" | "Parole chiave" | "Quiz".
 * - Riassunto / Parole chiave: contenuto esistente spostato nelle tab.
 * - Quiz: render esistente di quiz.js (+ nota per le schede senza quiz).
 * - Lezione guidata: player custom + slide sincronizzata + trascrizione karaoke.
 *   Frasi da content/timing.json (contratto {version,gap_sec,chapters:{id:
 *   {audio,duration,sentences:[{t0,t1,slide,text}]}}}); se manca o senza voce
 *   per l'id si usa il fallback (split dello script + tempi/slide equamente
 *   distribuiti). Se manca proprio il file audio: messaggio esistente, slide
 *   manuali, trascrizione statica. Bottone "Segna come completato" fuori tab.
 * NON toccare: tracker.js, quiz.js, app.js (usati solo via MLA.*). */

(function () {
  'use strict';

  var SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  var TABS = [
    { id: 'lezione', label: 'Lezione guidata' },
    { id: 'riassunto', label: 'Riassunto' },
    { id: 'parole', label: 'Parole chiave' },
    { id: 'quiz', label: 'Quiz' }
  ];

  /* Stesso splitter del TTS: frasi su [.!?…], sub-split oltre 300ch su [,;:] */
  function splitScript(script) {
    var parts = String(script || '')
      .split(/(?<=[.!?…])\s+/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
    var out = [];
    parts.forEach(function (p) {
      if (p.length > 300) {
        p.split(/(?<=[,;:])\s+/).map(function (s) { return s.trim(); })
          .filter(Boolean).forEach(function (s) { out.push(s); });
      } else {
        out.push(p);
      }
    });
    return out;
  }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return '–:––';
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function estimateDuration(script) {
    var words = String(script || '').split(/\s+/).filter(Boolean).length;
    return Math.max(30, (words / 850) * 60); // 850 parole/minuto
  }

  /* Normalizza gli indici slide del timing: se qualche valore supera
   * l'indice massimo, il generatore usava base-1 → si scala di uno. */
  function normSlide(s, nSlides) {
    var v = parseInt(s, 10);
    if (!isFinite(v)) return 0;
    return Math.min(Math.max(0, v), Math.max(0, nSlides - 1));
  }

  function normalizeTiming(entry, nSlides) {
    if (!entry || !Array.isArray(entry.sentences) || !entry.sentences.length) return null;
    var max = 0;
    entry.sentences.forEach(function (s) {
      var v = parseInt(s.slide, 10);
      if (isFinite(v) && v > max) max = v;
    });
    var shift = (max >= nSlides) ? 1 : 0; // valori base-1 rilevati
    return entry.sentences.map(function (s) {
      return {
        t0: +s.t0 || 0,
        t1: (+s.t1 > +s.t0) ? +s.t1 : (+s.t0 + 1),
        slide: normSlide((parseInt(s.slide, 10) || 0) - shift, nSlides),
        text: String(s.text || '')
      };
    });
  }

  /* Frasi con la slide di appartenenza, dalle narrazioni di ogni slide.
   * Ritorna null se anche una sola slide non ha `narration`. */
  function narrationItems(slides) {
    if (!Array.isArray(slides) || !slides.length) return null;
    var complete = slides.every(function (s) {
      return s && typeof s.narration === 'string' && s.narration.trim();
    });
    if (!complete) return null;
    var out = [];
    slides.forEach(function (s, i) {
      splitScript(s.narration).forEach(function (text) { out.push({ text: text, slide: i }); });
    });
    return out;
  }

  /* Frasi senza timing reale (audio assente o timing.json mancante). Le slide
   * vengono dalle narrazioni se ci sono; i tempi sono proporzionali ai caratteri. */
  function fallbackSentences(ch, duration, nSlides) {
    var items = narrationItems(ch.slides) || splitScript(ch.script).map(function (text, i, all) {
      return { text: text, slide: Math.min(nSlides - 1, Math.floor((i * nSlides) / all.length)) };
    });
    if (!items.length) return [];
    var total = items.reduce(function (acc, it) { return acc + it.text.length; }, 0) || 1;
    var done = 0;
    return items.map(function (it) {
      var t0 = (duration * done) / total;
      done += it.text.length;
      return { t0: t0, t1: (duration * done) / total, slide: Math.min(nSlides - 1, it.slide), text: it.text };
    });
  }

  /* HEAD audio/<id>.mp3 poi .wav → url oppure null (nessun errore in console). */
  function checkAudio(chapterId) {
    var candidates = ['audio/' + chapterId + '.mp3', 'audio/' + chapterId + '.wav'];
    function tryNext(i) {
      if (i >= candidates.length) return Promise.resolve(null);
      return fetch(candidates[i], { method: 'HEAD' }).then(function (res) {
        // Un file mancante può tornare 200 con la pagina HTML (fallback del server):
        // accetto solo una risposta audio.
        var type = res.headers.get('Content-Type') || '';
        if (res.ok && /^audio\//.test(type)) return candidates[i];
        return tryNext(i + 1);
      }).catch(function () { return tryNext(i + 1); });
    }
    return tryNext(0);
  }

  function loadTimingEntry(chapterId) {
    return fetch('content/timing.json').then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      if (json && json.chapters && json.chapters[chapterId]) return json.chapters[chapterId];
      return null;
    }).catch(function () { return null; }); // fallback: nessun rumore in console
  }

  /* ---------- TAB accessibili (role=tablist/tab/tabpanel + frecce) ---------- */

  function buildTabs(host, chapterId) {
    var app = window.MLA.app;
    var tabsEl = app.el('div', 'tabs', '');
    var list = app.el('div', 'tablist', '');
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Sezioni del capitolo');
    var panels = {};
    var tabBtns = [];

    TABS.forEach(function (t, i) {
      var btn = app.el('button', 'tab', app.esc(t.label));
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.id = 'tab-' + chapterId + '-' + t.id;
      btn.setAttribute('aria-controls', 'panel-' + chapterId + '-' + t.id);
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.tabIndex = i === 0 ? 0 : -1;
      list.appendChild(btn);
      tabBtns.push(btn);

      var panel = app.el('section', 'block tabpanel', '');
      panel.id = 'panel-' + chapterId + '-' + t.id;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', btn.id);
      panel.tabIndex = 0;
      if (i !== 0) panel.hidden = true;
      panels[t.id] = panel;
    });
    tabsEl.appendChild(list);
    TABS.forEach(function (t) { tabsEl.appendChild(panels[t.id]); });

    function activate(idx, focus) {
      tabBtns.forEach(function (b, j) {
        var on = j === idx;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
        panels[TABS[j].id].hidden = !on;
        if (on && focus) b.focus();
      });
    }

    tabBtns.forEach(function (btn, i) {
      btn.addEventListener('click', function () { activate(i, false); });
    });
    list.addEventListener('keydown', function (ev) {
      var cur = tabBtns.indexOf(document.activeElement);
      if (cur === -1) return;
      var next = null;
      if (ev.key === 'ArrowRight') next = (cur + 1) % tabBtns.length;
      else if (ev.key === 'ArrowLeft') next = (cur - 1 + tabBtns.length) % tabBtns.length;
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = tabBtns.length - 1;
      if (next !== null) { ev.preventDefault(); activate(next, true); }
    });

    host.appendChild(tabsEl);
    return {
      panels: panels,
      isActive: function (tabId) { return !panels[tabId].hidden; }
    };
  }

  /* ---------- Lezione guidata: player + slide sync + karaoke ---------- */

  function firstSentenceOfSlide(sentences, slideIdx) {
    for (var i = 0; i < sentences.length; i++) {
      if (sentences[i].slide === slideIdx) return sentences[i];
    }
    return null;
  }

  function sentenceAt(sentences, t) {
    for (var i = sentences.length - 1; i >= 0; i--) {
      if (t >= sentences[i].t0) return i;
    }
    return 0;
  }

  function renderLesson(panel, chapterId, ch, audioUrl, timingEntry) {
    var app = window.MLA.app;
    panel.innerHTML = '';
    var slides = Array.isArray(ch.slides) ? ch.slides : [];
    var nSlides = Math.max(1, slides.length);
    var audioMissing = !audioUrl;

    /* --- stato frasi: timing reale o fallback --- */
    var sentences = normalizeTiming(timingEntry, nSlides) || [];
    var isFallback = !sentences.length;
    var duration = (timingEntry && isFinite(+timingEntry.duration) && +timingEntry.duration > 0)
      ? +timingEntry.duration : 0;

    var audio = null;
    if (!audioMissing) {
      audio = document.createElement('audio');
      audio.src = audioUrl;
      audio.preload = 'metadata';
      // niente controlli nativi: controlli custom qui sotto
    }

    /* --- player custom --- */
    var playerWrap = app.el('div', 'player', '');
    if (audioMissing) {
      playerWrap.appendChild(app.el('p', 'notice audio-missing',
        '🎧 Audio in preparazione: puoi già studiare slide e trascrizione. La lezione parlata arriverà a breve.'));
      panel.appendChild(playerWrap);
    } else {
      var row = app.el('div', 'player-row', '');
      var btnPlay = app.el('button', 'btn', '▶ Ascolta');
      btnPlay.type = 'button';
      btnPlay.setAttribute('aria-label', 'Riproduci o metti in pausa');
      var btnBack = app.el('button', 'btn slide-nav', '−10s');
      btnBack.type = 'button';
      btnBack.setAttribute('aria-label', 'Indietro di 10 secondi');
      var btnFwd = app.el('button', 'btn slide-nav', '+10s');
      btnFwd.type = 'button';
      btnFwd.setAttribute('aria-label', 'Avanti di 10 secondi');
      var time = app.el('span', 'time', fmtTime(0) + ' / ' + fmtTime(duration));
      time.setAttribute('aria-live', 'off');
      var speeds = app.el('span', 'speed-group', '');
      speeds.setAttribute('role', 'group');
      speeds.setAttribute('aria-label', 'Velocità di riproduzione');
      SPEEDS.forEach(function (sp) {
        var b = app.el('button', 'btn ghost speed-btn', String(sp).replace('.', ',') + '×');
        b.type = 'button';
        b.dataset.speed = String(sp);
        b.setAttribute('aria-pressed', sp === 1 ? 'true' : 'false');
        if (sp === 1) b.classList.add('on');
        b.addEventListener('click', function () {
          audio.playbackRate = sp;
          speeds.querySelectorAll('.speed-btn').forEach(function (x) {
            var on = x === b;
            x.setAttribute('aria-pressed', on ? 'true' : 'false');
            x.classList.toggle('on', on);
          });
        });
        speeds.appendChild(b);
      });
      row.appendChild(btnPlay); row.appendChild(btnBack); row.appendChild(btnFwd);
      row.appendChild(time); row.appendChild(speeds);
      playerWrap.appendChild(row);

      var seekWrap = app.el('div', 'seek-wrap', '');
      var seek = document.createElement('input');
      seek.type = 'range';
      seek.className = 'seek';
      seek.min = '0'; seek.max = '1000'; seek.value = '0';
      seek.setAttribute('aria-label', 'Avanzamento audio');
      seekWrap.appendChild(seek);
      var ticks = app.el('div', 'seek-ticks', '');
      ticks.setAttribute('aria-hidden', 'true');
      seekWrap.appendChild(ticks);
      playerWrap.appendChild(seekWrap);
      playerWrap.appendChild(audio);
      panel.appendChild(playerWrap);
    }

    /* --- slide (UNA visibile alla volta, riusa .slide-card) --- */
    var slideIdx = 0;
    var card = app.el('div', 'slide-card', '');
    var counter = app.el('div', 'slide-counter', '');
    var body = app.el('div', 'slide-body', '');
    var prev = app.el('button', 'btn slide-nav', '←');
    var next = app.el('button', 'btn slide-nav', '→');
    prev.type = next.type = 'button';
    prev.setAttribute('aria-label', 'Slide precedente');
    next.setAttribute('aria-label', 'Slide successiva');

    /* Task6: render dei bullet formula (oggetti) come MathML nativo.
     * I bullet stringa passano da app.esc() come prima; gli oggetti
     * {formula_mml, formula_fb, caption, kind:'formula'} vengono composti
     * come <math> sanificato (whitelist tag, nessun attributo attivo) con
     * fallback Unicode (formula_fb) se il browser non compone MathML.
     * Gli oggetti {kind:'diagnosis', title, text} restano testuali in un
     * riquadro diagnosi. NON toccare: goSlide/seek/transcript/quiz. */
    var MML_ALLOW = { math: 1, mrow: 1, mi: 1, mn: 1, mo: 1, mfrac: 1, msqrt: 1,
      msub: 1, msup: 1, msubsup: 1, mover: 1, munder: 1, munderover: 1, mtext: 1 };
    function cleanMml(node) {
      var kids = node.childNodes ? Array.prototype.slice.call(node.childNodes) : [];
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (k.nodeType === 1) {
          var tag = String(k.tagName || k.nodeName || '').toLowerCase().replace(/^(math|mml):/, '');
          if (!MML_ALLOW[tag]) { node.removeChild(k); continue; }
          if (k.attributes) {
            var attrs = Array.prototype.slice.call(k.attributes);
            for (var j = 0; j < attrs.length; j++) {
              var an = String(attrs[j].name || '').toLowerCase();
              if (an !== 'display' && an !== 'xmlns') k.removeAttribute(attrs[j].name);
            }
          }
          cleanMml(k);
        } else if (k.nodeType !== 3) {
          node.removeChild(k);
        }
      }
      return node;
    }
    var mathmlSupport = null;
    function hasMathML() {
      if (mathmlSupport !== null) return mathmlSupport;
      mathmlSupport = true;
      try {
        var t = document.createElement('div');
        t.style.cssText = 'position:absolute;visibility:hidden;top:0;left:0;';
        t.innerHTML = '<math xmlns="http://www.w3.org/1998/Math/MathML">' +
          '<mfrac><mi>x</mi><mi>y</mi></mfrac></math>';
        document.body.appendChild(t);
        var h = t.offsetHeight || 0;
        document.body.removeChild(t);
        // senza supporto MathML la frazione resta testo inline su una riga
        mathmlSupport = h > 24;
      } catch (e) { mathmlSupport = true; }
      try { document.documentElement.classList.toggle('no-mathml', !mathmlSupport); } catch (e2) { /* noop */ }
      return mathmlSupport;
    }
    function renderBullet(b) {
      if (b && typeof b === 'object' && typeof b.formula_mml === 'string') {
        hasMathML();
        var clean = document.createElement('div');
        clean.innerHTML = String(b.formula_mml);
        var m = clean.firstChild;
        var tag = m && m.nodeType === 1
          ? String(m.tagName || m.nodeName || '').toLowerCase().replace(/^(math|mml):/, '') : '';
        if (tag === 'math') {
          cleanMml(m);
          var box = document.createElement('div');
          box.className = 'formula';
          box.setAttribute('role', 'math');
          if (b.formula_fb) box.setAttribute('aria-label', String(b.formula_fb));
          box.appendChild(m);
          var fb = document.createElement('div');
          fb.className = 'formula-fb';
          fb.textContent = b.formula_fb || '';
          box.appendChild(fb);
          var li = document.createElement('li');
          li.className = 'has-formula';
          li.appendChild(box);
          if (b.caption) {
            var cap = document.createElement('div');
            cap.className = 'formula-caption';
            cap.textContent = String(b.caption);
            li.appendChild(cap);
          }
          return li.outerHTML;
        }
        return '<li>' + app.esc(b.formula_fb || b.caption || '') + '</li>';
      }
      if (b && typeof b === 'object' && b.kind === 'diagnosis') {
        var d = document.createElement('li');
        d.className = 'has-diagnosis';
        var t2 = document.createElement('div');
        t2.className = 'diagnosis-title';
        t2.textContent = (b.title || 'Diagnosi');
        var p2 = document.createElement('div');
        p2.className = 'diagnosis-text';
        p2.textContent = b.text || '';
        d.appendChild(t2); d.appendChild(p2);
        return d.outerHTML;
      }
      return '<li>' + app.esc(typeof b === 'string' ? b : JSON.stringify(b)) + '</li>';
    }

    function drawSlide() {
      if (!slides.length) {
        body.innerHTML = '<p class="muted">Slide in arrivo per questo capitolo.</p>';
        counter.textContent = '0 / 0';
        prev.disabled = next.disabled = true;
        return;
      }
      var s = slides[slideIdx];
      counter.textContent = (slideIdx + 1) + ' / ' + slides.length;
      var bullets = (Array.isArray(s.bullets) ? s.bullets : [])
        .map(renderBullet).join('');
      body.innerHTML = '<h3>' + app.esc(s.title || ('Slide ' + (slideIdx + 1))) + '</h3>' +
        (bullets ? '<ul>' + bullets + '</ul>' : '');
      prev.disabled = slideIdx === 0;
      next.disabled = slideIdx === slides.length - 1;
    }

    function goSlide(i, doSeek) {
      if (!slides.length) return;
      slideIdx = Math.min(Math.max(0, i), slides.length - 1);
      drawSlide();
      // navigare le slide = seek all'inizio di quella slide (mai fuori sync)
      if (doSeek && audio && sentences.length && isFinite(audio.duration) && audio.duration > 0) {
        var first = firstSentenceOfSlide(sentences, slideIdx);
        if (first) {
          try { audio.currentTime = Math.max(0, first.t0 + 0.01); } catch (e) { /* seek non pronto */ }
        }
      }
    }

    prev.addEventListener('click', function () { goSlide(slideIdx - 1, true); });
    next.addEventListener('click', function () { goSlide(slideIdx + 1, true); });
    // frecce tastiera solo quando la tab Lezione è attiva
    document.addEventListener('keydown', function onKey(ev) {
      if (!document.body.contains(card)) { document.removeEventListener('keydown', onKey); return; }
      if (panel.hidden) return;
      if (document.activeElement === seek) return; // lo slider usa già le frecce
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); goSlide(slideIdx - 1, true); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); goSlide(slideIdx + 1, true); }
    });

    var bar = app.el('div', 'slide-bar', '');
    bar.appendChild(prev); bar.appendChild(counter); bar.appendChild(next);
    card.appendChild(body); card.appendChild(bar);
    panel.appendChild(card);
    drawSlide();

    /* --- trascrizione karaoke --- */
    var transcript = app.el('div', 'transcript', '');
    transcript.setAttribute('aria-label', 'Trascrizione della lezione');
    panel.appendChild(transcript);
    var sentEls = [];
    var lastManualScroll = 0;
    transcript.addEventListener('scroll', function () { lastManualScroll = Date.now(); });

    function buildTranscript(list) {
      transcript.innerHTML = '';
      sentEls = [];
      list.forEach(function (s, i) {
        var p = app.el('p', 'sentence', app.esc(s.text));
        p.dataset.i = String(i);
        if (!audioMissing) {
          p.classList.add('clickable');
          p.tabIndex = 0;
          p.setAttribute('role', 'button');
          p.setAttribute('aria-label', 'Vai al punto ' + fmtTime(s.t0));
          p.addEventListener('click', function () { seekTo(s.t0); });
          p.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); seekTo(s.t0); }
          });
        }
        transcript.appendChild(p);
        sentEls.push(p);
      });
    }

    function seekTo(t) {
      if (!audio) return;
      try {
        audio.currentTime = Math.max(0, t + 0.01);
        if (audio.paused) highlightAt(t); // feedback immediato anche in pausa
      } catch (e) { /* seek non pronto */ }
    }

    var curIdx = -1;
    function highlightAt(t) {
      if (!sentences.length || !sentEls.length) return;
      var i = sentenceAt(sentences, t);
      if (i === curIdx) return;
      curIdx = i;
      sentEls.forEach(function (p, j) { p.classList.toggle('active', j === i); });
      // auto-scroll solo se l'utente non ha scrollato negli ultimi 5s
      if (Date.now() - lastManualScroll > 5000 && sentEls[i]) {
        try { sentEls[i].scrollIntoView({ block: 'nearest' }); } catch (e) { /* noop */ }
      }
      // avanza la slide da sola al cambio frase con slide diversa (solo mentre suona)
      if (audio && !audio.paused && sentences[i] && sentences[i].slide !== slideIdx) {
        slideIdx = sentences[i].slide;
        drawSlide();
      }
    }

    function paintTicks() {
      if (!ticks || !sentences.length || !duration) return;
      ticks.innerHTML = '';
      for (var s = 1; s < nSlides; s++) {
        var first = firstSentenceOfSlide(sentences, s);
        if (!first) continue;
        var mark = app.el('span', 'seek-tick', '');
        mark.style.left = (100 * first.t0 / duration) + '%';
        mark.title = 'Slide ' + (s + 1);
        ticks.appendChild(mark);
      }
    }

    function finalize(list, dur) {
      sentences = list;
      duration = dur;
      buildTranscript(sentences);
      if (!audioMissing) paintTicks();
      curIdx = -1;
      if (audio && isFinite(audio.currentTime)) highlightAt(audio.currentTime);
    }

    /* --- wiring audio --- */
    if (!audioMissing) {
      var seeking = false;
      seek.addEventListener('pointerdown', function () { seeking = true; });
      window.addEventListener('pointerup', function () { seeking = false; });
      seek.addEventListener('input', function () {
        if (!isFinite(audio.duration) || !audio.duration) return;
        try { audio.currentTime = (parseFloat(seek.value) / 1000) * audio.duration; } catch (e) { /* noop */ }
      });
      btnPlay.addEventListener('click', function () {
        if (audio.paused) { audio.play().catch(function () { /* autoplay bloccato */ }); }
        else audio.pause();
      });
      btnBack.addEventListener('click', function () {
        try { audio.currentTime = Math.max(0, audio.currentTime - 10); } catch (e) { /* noop */ }
      });
      btnFwd.addEventListener('click', function () {
        try { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 10); } catch (e) { /* noop */ }
      });

      function drawPlay() {
        btnPlay.textContent = audio.paused ? '▶ Ascolta' : '⏸ Pausa';
      }
      audio.addEventListener('play', drawPlay);
      audio.addEventListener('pause', drawPlay);

      audio.addEventListener('loadedmetadata', function () {
        var dur = isFinite(audio.duration) && audio.duration > 0
          ? audio.duration : estimateDuration(ch.script);
        time.textContent = fmtTime(0) + ' / ' + fmtTime(dur);
        if (isFallback) {
          finalize(fallbackSentences(ch, dur, nSlides), dur);
        } else {
          finalize(sentences, dur);
        }
      });
      audio.addEventListener('timeupdate', function () {
        if (!isFinite(audio.duration) || !audio.duration) return;
        if (!seeking) seek.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
        time.textContent = fmtTime(audio.currentTime) + ' / ' + fmtTime(audio.duration);
        highlightAt(audio.currentTime);
      });
      audio.addEventListener('ended', drawPlay);
    }

    /* --- prima pittura: fallback subito (dura finché i metadata arrivano) --- */
    // Senza audio non ci sono tempi reali: la trascrizione segue le narrazioni.
    if (isFallback || audioMissing) {
      var dur0 = duration > 0 ? duration : estimateDuration(ch.script);
      finalize(fallbackSentences(ch, dur0, nSlides), dur0);
    } else {
      finalize(sentences, duration > 0 ? duration : estimateDuration(ch.script));
    }
    if (audioMissing) {
      console.info('[chapter] lezione senza audio per ' + chapterId + ' (trascrizione statica)');
    }
  }

  /* ---------- bottone completamento (fuori dalle tab, in fondo) ---------- */

  function renderDoneButton(host, chapterId) {
    var app = window.MLA.app, tracker = window.MLA.tracker;
    host.innerHTML = '';
    var btn = app.el('button', 'btn primary big', '');
    function draw() {
      var done = tracker.isDone(chapterId);
      btn.textContent = done ? '✓ Completato — clicca per riaprire' : 'Segna come completato';
      btn.classList.toggle('done', done);
    }
    btn.addEventListener('click', function () {
      if (tracker.isDone(chapterId)) tracker.markUndone(chapterId);
      else tracker.markDone(chapterId);
      draw();
    });
    host.appendChild(btn);
    draw();
  }

  /* ---------- fonti online del capitolo (in fondo al Riassunto) ---------- */

  /* Elenco di link da ch.sources = [{title, url}]. Solo URL https; titolo e url
   * passano da textContent (mai HTML grezzo dai JSON). Ritorna null se non c'è nulla. */
  function renderSources(list) {
    var app = window.MLA.app;
    var items = (Array.isArray(list) ? list : []).filter(function (s) {
      return s && typeof s.url === 'string' && /^https:\/\//.test(s.url);
    });
    if (!items.length) return null;

    var box = app.el('section', 'chapter-sources', '');
    box.appendChild(app.el('h3', '', 'Fonti online'));
    var ul = document.createElement('ul');
    items.forEach(function (s) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = String(s.title || s.url);
      li.appendChild(a);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    return box;
  }

  /* ---------- init ---------- */

  function init() {
    var app = window.MLA.app, tracker = window.MLA.tracker;
    var id = app.getQueryParam('id');
    var root = document.getElementById('chapter-root');
    if (!id) {
      root.innerHTML = '<p class="muted">Nessun capitolo selezionato. <a href="index.html">Torna alla mappa</a>.</p>';
      return;
    }
    var meta = app.byId(id);
    if (!meta && id !== 'quick-ref') {
      root.innerHTML = '<p class="muted">Capitolo sconosciuto: ' + app.esc(id) +
        '. <a href="index.html">Torna alla mappa</a>.</p>';
      return;
    }
    /* quick-ref: voce extra non in mappa; metadati ricostruiti dai contenuti. */
    if (!meta) {
      meta = { id: id, n: '★', area: 'applicazioni', short: 'Ripasso', title: 'Ripasso last-minute' };
    }

    tracker.markVisited(id);

    Promise.all([app.loadContent(), loadTimingEntry(id), checkAudio(id)]).then(function (res) {
      var ch = res[0].chapters[id];
      var timingEntry = res[1];
      var audioUrl = res[2];
      root.innerHTML = '';
      var head = app.el('div', 'chapter-head', '');
      head.appendChild(app.el('a', 'back', '← Mappa'));
      head.firstChild.href = 'index.html';
      head.appendChild(app.el('span', 'area-tag area-' + meta.area,
        app.AREAS[meta.area].label + ' · Cap ' + meta.n));
      root.appendChild(head);

      if (!ch) {
        root.appendChild(app.el('h1', '', app.esc(meta.title)));
        root.appendChild(app.el('p', 'notice',
          '📦 Contenuti in arrivo per questo capitolo: riassunto, slide, audio e quiz saranno pubblicati a breve.'));
        var quizBox = app.el('section', 'block', '<h2>Quiz</h2>');
        window.MLA.quiz.render(quizBox, { id: id, quiz: [] });
        root.appendChild(quizBox);
        var doneHost = app.el('div', 'done-row', '');
        root.appendChild(doneHost);
        renderDoneButton(doneHost, id);
        return;
      }

      root.appendChild(app.el('h1', '', app.esc(ch.title)));

      var tabs = buildTabs(root, id);

      /* Tab Lezione guidata */
      tabs.panels.lezione.appendChild(app.el('h2', '', 'Lezione guidata'));
      renderLesson(tabs.panels.lezione, id, ch, audioUrl, timingEntry);

      /* Tab Riassunto: testo integrale */
      tabs.panels.riassunto.appendChild(app.el('h2', '', 'Riassunto'));
      if (ch.summary) tabs.panels.riassunto.appendChild(app.el('p', '', app.esc(ch.summary)));
      else tabs.panels.riassunto.appendChild(app.el('p', 'muted', 'Riassunto in arrivo per questo capitolo.'));
      var sourcesBox = renderSources(ch.sources);
      if (sourcesBox) tabs.panels.riassunto.appendChild(sourcesBox);

      /* Tab Parole chiave: contenuto integrale */
      tabs.panels.parole.appendChild(app.el('h2', '', 'Parole chiave'));
      var kws = Array.isArray(ch.keywords) ? ch.keywords : [];
      if (kws.length) {
        var dl = document.createElement('dl');
        dl.className = 'keywords';
        kws.forEach(function (k) {
          var dt = document.createElement('dt'); dt.textContent = k.term || '';
          var dd = document.createElement('dd'); dd.textContent = k.def || '';
          dl.appendChild(dt); dl.appendChild(dd);
        });
        tabs.panels.parole.appendChild(dl);
      } else {
        tabs.panels.parole.appendChild(app.el('p', 'muted', 'Parole chiave in arrivo per questo capitolo.'));
      }

      /* Tab Quiz: render esistente + nota per le schede senza quiz */
      tabs.panels.quiz.appendChild(app.el('h2', '', 'Quiz'));
      if (!Array.isArray(ch.quiz) || !ch.quiz.length) {
        tabs.panels.quiz.appendChild(app.el('p', 'notice',
          'Nessun quiz per questa scheda — è un ripasso rapido.'));
      }
      var quizHost = app.el('div', '', '');
      tabs.panels.quiz.appendChild(quizHost);
      window.MLA.quiz.render(quizHost, ch);

      /* Ponte verso il banco domande già filtrato su questo capitolo. */
      var qlink = app.el('p', 'chapter-qlink', '');
      var a = app.el('a', '', 'Vai al banco domande di questo capitolo →');
      a.href = 'domande.html?ch=' + encodeURIComponent(id);
      qlink.appendChild(document.createTextNode('Vuoi allenarti ancora? '));
      qlink.appendChild(a);
      tabs.panels.quiz.appendChild(qlink);

      /* Bottone completamento fuori dalle tab, in fondo */
      var doneHost2 = app.el('div', 'done-row', '');
      root.appendChild(doneHost2);
      renderDoneButton(doneHost2, id);

      console.info('[chapter] renderizzato ' + id +
        (timingEntry ? ' (timing reale)' : ' (fallback trascrizione)') +
        (audioUrl ? '' : ' (audio mancante)'));
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
