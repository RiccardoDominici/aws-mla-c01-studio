/* map.js — mappa mentale interattiva (SVG disegnato a mano in JS).
 * 3 macro-aree, 7 nodi capitolo, frecce dei prerequisiti:
 *   ch1→ch2, ch1→ch6, ch1→ch7, ch2→ch3, ch3→ch4, ch4→ch5,
 *   ch4↔ch6, ch5↔ch6, ch6→ch7.
 * Colore nodi dallo stato tracker; click → chapter.html?id=...
 * Espone MLA.map.render(svgContainer, contentMap). */

(function () {
  'use strict';

  var W = 200, H = 64; // dimensioni nodo

  /* Posizione (x,y = angolo alto-sx del rettangolo) nello spazio 960x600. */
  var POS = {
    'ch1-exam-guide':       { x: 70,  y: 110 },
    'ch2-data-prep':        { x: 70,  y: 400 },
    'ch3-model-dev':        { x: 380, y: 60  },
    'ch4-deploy':           { x: 380, y: 260 },
    'ch5-monitor-security': { x: 380, y: 450 },
    'ch6-genai':            { x: 690, y: 140 },
    'ch7-practice':         { x: 690, y: 390 }
  };

  /* Frecce prerequisiti come path SVG espliciti (from → to, bidir?). */
  var EDGES = [
    { from: 'ch1-exam-guide', to: 'ch2-data-prep', d: 'M170,174 L170,392', bidir: false, dash: false },
    { from: 'ch1-exam-guide', to: 'ch6-genai',     d: 'M270,142 C450,142 520,172 682,172', bidir: false, dash: true },
    { from: 'ch1-exam-guide', to: 'ch7-practice',  d: 'M110,174 C70,260 45,360 45,480 L45,565 L770,565 C785,565 790,545 790,462', bidir: false, dash: true },
    { from: 'ch2-data-prep',  to: 'ch3-model-dev', d: 'M230,400 C300,300 320,200 372,120', bidir: false, dash: true },
    { from: 'ch3-model-dev',  to: 'ch4-deploy',    d: 'M480,124 L480,252', bidir: false, dash: false },
    { from: 'ch4-deploy',     to: 'ch5-monitor-security', d: 'M480,324 L480,442', bidir: false, dash: false },
    { from: 'ch6-genai',      to: 'ch5-monitor-security', d: 'M790,204 L592,470', bidir: true, dash: false },
    { from: 'ch4-deploy',     to: 'ch6-genai',     d: 'M560,260 C600,230 640,200 682,180', bidir: true, dash: false },
    { from: 'ch6-genai',      to: 'ch7-practice',  d: 'M790,204 L790,382', bidir: false, dash: true }
  ];

  var NS = 'http://www.w3.org/2000/svg';

  function mk(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  /* Spezza un titolo in max 2 righe da ~20 caratteri. */
  function wrapTitle(title) {
    var words = String(title).split(/\s+/);
    var lines = [''];
    words.forEach(function (w) {
      var last = lines[lines.length - 1];
      if ((last + ' ' + w).trim().length > 20 && lines.length < 2) lines.push(w);
      else lines[lines.length - 1] = (last + ' ' + w).trim();
    });
    return lines.slice(0, 2);
  }

  function statusBadge(status) {
    return status === 'done' ? '✓' : status === 'doing' ? '▶' : '○';
  }

  function render(container, contentMap) {
    var app = window.MLA.app, tracker = window.MLA.tracker;
    container.innerHTML = '';

    var svg = mk('svg', {
      viewBox: '0 0 960 600', role: 'img',
      'aria-label': 'Mappa mentale dei 7 capitoli del corso MLA-C01'
    });

    var defs = mk('defs', {});
    [['arr', '#8b93a7'], ['arr-done', '#34d399']].forEach(function (pair) {
      var m = mk('marker', {
        id: pair[0], viewBox: '0 0 10 10', refX: 8, refY: 5,
        markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse'
      });
      var p = mk('path', { d: 'M0,0 L10,5 L0,10 z', fill: pair[1] });
      m.appendChild(p);
      defs.appendChild(m);
    });
    svg.appendChild(defs);

    /* Fasce di sfondo delle 3 macro-aree. */
    var bands = [
      { x: 20, w: 300, label: 'Fondamenti · cap 1–2' },
      { x: 340, w: 280, label: 'Pratica MLOps · cap 3–4–5' },
      { x: 640, w: 300, label: 'Applicazioni · cap 6–7' }
    ];
    bands.forEach(function (b) {
      svg.appendChild(mk('rect', { x: b.x, y: 14, width: b.w, height: 572, rx: 14, class: 'map-band' }));
      var t = mk('text', { x: b.x + 16, y: 40, class: 'map-band-label' });
      t.textContent = b.label;
      svg.appendChild(t);
    });

    /* Frecce prerequisiti (sotto i nodi). */
    var edgesG = mk('g', { class: 'map-edges' });
    EDGES.forEach(function (e) {
      var p = mk('path', {
        d: e.d, class: 'map-edge' + (e.dash ? ' dashed' : ''),
        'marker-end': 'url(#arr)'
      });
      if (e.bidir) p.setAttribute('marker-start', 'url(#arr)');
      var title = mk('title', {});
      var a = app.byId(e.from), b = app.byId(e.to);
      title.textContent = (a ? a.short : e.from) + (e.bidir ? ' ↔ ' : ' → ') + (b ? b.short : e.to);
      p.appendChild(title);
      edgesG.appendChild(p);
    });
    svg.appendChild(edgesG);

    /* Nodi capitolo. */
    app.CHAPTERS.forEach(function (meta) {
      var pos = POS[meta.id];
      var status = tracker.status(meta.id);
      var content = (contentMap || {})[meta.id];
      var title = content ? content.title : meta.title + ' (in arrivo)';

      var g = mk('g', {
        class: 'map-node status-' + status, tabindex: '0', role: 'link',
        'aria-label': 'Capitolo ' + meta.n + ': ' + title + ' — stato: ' + status
      });

      g.appendChild(mk('rect', { x: pos.x, y: pos.y, width: W, height: H, rx: 12, class: 'map-node-box' }));

      var badge = mk('text', { x: pos.x + 14, y: pos.y + 25, class: 'map-node-badge' });
      badge.textContent = statusBadge(status);
      g.appendChild(badge);

      var cap = mk('text', { x: pos.x + 34, y: pos.y + 25, class: 'map-node-cap' });
      cap.textContent = 'CAP ' + meta.n + ' · ' + meta.short.toUpperCase();
      g.appendChild(cap);

      wrapTitle(title).forEach(function (line, i) {
        var t = mk('text', { x: pos.x + 14, y: pos.y + 44 + i * 15, class: 'map-node-title' });
        t.textContent = line;
        g.appendChild(t);
      });

      function go() { window.location.href = 'chapter.html?id=' + encodeURIComponent(meta.id); }
      g.addEventListener('click', go);
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); }
      });

      svg.appendChild(g);
    });

    container.appendChild(svg);
    console.info('[map] mappa renderizzata: 7 nodi, ' + EDGES.length + ' frecce.');
  }

  window.MLA = window.MLA || {};
  window.MLA.map = { render: render };
})();
