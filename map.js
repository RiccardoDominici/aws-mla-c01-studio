/* map.js — mappa dei capitoli.
 * Su desktop: SVG disegnato a mano in JS, 3 colonne d'area (Fondamenti,
 * Pratica MLOps, Applicazioni). In ogni colonna la colonna sinistra ospita i
 * capitoli di base e quella destra gli approfondimenti (8-14), accanto al
 * capitolo che approfondiscono.
 * Su telefono (<= 640 px): elenco verticale leggibile, stesso stato e stessi link.
 * Le frecce dei prerequisiti non sono scritte a mano: si ricavano dal campo
 * `prereq` del registro MLA.app.CHAPTERS. Solo le coordinate sono fisse
 * (POS e ROUTES): se cambia il registro vanno aggiornate qui.
 * Stato nodi dal tracker; click o Invio → chapter.html?id=...
 * Espone MLA.map.render(container, contentMap). */

(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var NARROW_QUERY = '(max-width: 640px)';
  var W = 176, H = 68;          // dimensioni nodo nello spazio SVG
  var BAND_W = 408, BAND_Y = 14, BAND_H = 440;
  var VIEW_W = 1336, VIEW_H = 470;

  /* Colonne d'area: x della fascia. Il titolo e i nodi sono relativi a queste. */
  var BANDS = [
    { area: 'fondamenti',   x: 8 },
    { area: 'mlops',        x: 464 },
    { area: 'applicazioni', x: 920 }
  ];

  /* Angolo alto-sx di ogni nodo. Righe: y 96, 216, 336 (altezza 68).
   * Colonna base: x = fascia + 16; colonna approfondimenti: x = fascia + 216. */
  var POS = {
    'ch1-exam-guide':        { x: 24,   y: 96  },
    'ch2-data-prep':         { x: 24,   y: 216 },
    'ch8-data-advanced':     { x: 224,  y: 216 },
    'ch3-model-dev':         { x: 480,  y: 96  },
    'ch4-deploy':            { x: 480,  y: 216 },
    'ch5-monitor-security':  { x: 480,  y: 336 },
    'ch9-training-advanced': { x: 680,  y: 96  },
    'ch10-infra-cicd':       { x: 680,  y: 216 },
    'ch11-cost-security':    { x: 680,  y: 336 },
    'ch6-genai':             { x: 936,  y: 96  },
    'ch14-ai-services':      { x: 936,  y: 216 },
    'ch7-practice':          { x: 936,  y: 336 },
    'ch12-genai-rag':        { x: 1136, y: 96  },
    'ch13-genai-agents':     { x: 1136, y: 216 }
  };

  /* Percorsi delle frecce prerequisito, chiave "da>a".
   * Frecce interne a un'area: linea piena, nelle colonne e tra le righe.
   * Frecce tra aree: tratteggiate e attenuate, nei corridoi:
   *   - tra le fasce: x 432 e 448 (A|B), 888 e 904 (B|C);
   *   - tra le righe: y 190 (tra riga 0 e 1), y 310 (tra riga 1 e 2), y 430 (sotto la riga 2).
   * Nessun percorso passa sopra un titolo di fascia (y 40) o dentro un nodo. */
  var ROUTES = {
    'ch1-exam-guide>ch2-data-prep':           'M112,164 V216',
    'ch2-data-prep>ch8-data-advanced':        'M200,250 H224',
    'ch3-model-dev>ch4-deploy':               'M568,164 V216',
    'ch4-deploy>ch5-monitor-security':        'M568,284 V336',
    'ch3-model-dev>ch9-training-advanced':    'M656,130 H680',
    'ch4-deploy>ch10-infra-cicd':             'M656,250 H680',
    'ch5-monitor-security>ch11-cost-security': 'M656,370 H680',
    'ch6-genai>ch14-ai-services':             'M1024,164 V216',
    'ch6-genai>ch12-genai-rag':               'M1112,130 H1136',
    'ch12-genai-rag>ch13-genai-agents':       'M1224,164 V216',
    'ch2-data-prep>ch3-model-dev':            'M112,284 V310 H432 V130 H480',
    'ch2-data-prep>ch6-genai':                'M112,284 V310 H904 V130 H936',
    'ch2-data-prep>ch7-practice':             'M112,284 V310 H888 V370 H936',
    'ch1-exam-guide>ch7-practice':            'M180,164 V190 H448 V430 H1024 V404'
  };

  /* Stato lasciato nel modulo tra un render e l'altro (ridisegno al cambio di layout). */
  var state = { container: null, contentMap: null, listening: false };

  function mk(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function statusBadge(status) {
    return status === 'done' ? '✓' : status === 'doing' ? '▶' : '○';
  }

  /* Archi prerequisito dal registro: una freccia per ogni id in prereq. */
  function prereqEdges() {
    var out = [];
    window.MLA.app.CHAPTERS.forEach(function (c) {
      (c.prereq || []).forEach(function (p) { out.push({ from: p, to: c.id }); });
    });
    return out;
  }

  /* Etichetta della fascia: "Fondamenti · cap 1, 2, 8". */
  function bandLabel(area) {
    var app = window.MLA.app;
    var nums = app.CHAPTERS.filter(function (c) { return c.area === area; })
      .map(function (c) { return c.n; });
    return app.AREAS[area].label + ' · cap ' + nums.join(', ');
  }

  /* Il titolo "breve" di ogni capitolo entra nel nodo; quello completo sta nell'elenco. */
  function nodeCaption(meta, hasContent) {
    return 'CAP ' + meta.n + (hasContent ? '' : ' · IN ARRIVO');
  }

  function buildSvg(contentMap) {
    var app = window.MLA.app, tracker = window.MLA.tracker;
    var svg = mk('svg', {
      viewBox: '0 0 ' + VIEW_W + ' ' + VIEW_H, role: 'img',
      'aria-label': 'Mappa dei ' + app.CHAPTERS.length + ' capitoli del corso'
    });

    var defs = mk('defs', {});
    var marker = mk('marker', {
      id: 'arr', viewBox: '0 0 10 10', refX: 8, refY: 5,
      markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse'
    });
    marker.appendChild(mk('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#8b93a7' }));
    defs.appendChild(marker);
    var markerCross = mk('marker', {
      id: 'arr-cross', viewBox: '0 0 10 10', refX: 8, refY: 5,
      markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
    });
    markerCross.appendChild(mk('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#b3bac8' }));
    defs.appendChild(markerCross);
    svg.appendChild(defs);

    /* Fasce di sfondo delle 3 aree con etichetta. */
    BANDS.forEach(function (b) {
      svg.appendChild(mk('rect', { x: b.x, y: BAND_Y, width: BAND_W, height: BAND_H, rx: 14, class: 'map-band' }));
      var t = mk('text', { x: b.x + 16, y: 40, class: 'map-band-label' });
      t.textContent = bandLabel(b.area);
      svg.appendChild(t);
    });

    /* Frecce prerequisito, sotto i nodi. */
    var edgesG = mk('g', { class: 'map-edges' });
    var drawn = 0;
    prereqEdges().forEach(function (e) {
      var d = ROUTES[e.from + '>' + e.to];
      if (!d) { console.warn('[map] nessun percorso SVG per ' + e.from + ' → ' + e.to); return; }
      var a = app.byId(e.from), b = app.byId(e.to);
      // Tra aree diverse la freccia è tratteggiata e attenuata: è un collegamento lungo.
      var cross = !!(a && b && a.area !== b.area);
      var p = mk('path', {
        d: d, class: 'map-edge' + (cross ? ' map-edge-cross' : ''),
        'marker-end': cross ? 'url(#arr-cross)' : 'url(#arr)'
      });
      var title = mk('title', {});
      title.textContent = (a ? a.short : e.from) + ' → ' + (b ? b.short : e.to);
      p.appendChild(title);
      edgesG.appendChild(p);
      drawn++;
    });
    svg.appendChild(edgesG);

    /* Nodi capitolo. */
    app.CHAPTERS.forEach(function (meta) {
      var pos = POS[meta.id];
      if (!pos) { console.warn('[map] nessuna posizione per ' + meta.id); return; }
      var status = tracker.status(meta.id);
      var hasContent = !!(contentMap && contentMap[meta.id]);

      var g = mk('g', {
        class: 'map-node status-' + status, tabindex: '0', role: 'link',
        'aria-label': 'Capitolo ' + meta.n + ': ' + meta.title +
          (hasContent ? '' : ' (in arrivo)') + ' — stato: ' + status
      });
      g.appendChild(mk('rect', { x: pos.x, y: pos.y, width: W, height: H, rx: 12, class: 'map-node-box' }));

      var badge = mk('text', { x: pos.x + 14, y: pos.y + 26, class: 'map-node-badge' });
      badge.textContent = statusBadge(status);
      g.appendChild(badge);

      var cap = mk('text', { x: pos.x + 38, y: pos.y + 26, class: 'map-node-cap' });
      cap.textContent = nodeCaption(meta, hasContent);
      g.appendChild(cap);

      var t = mk('text', { x: pos.x + 14, y: pos.y + 53, class: 'map-node-title' });
      t.textContent = meta.short;
      g.appendChild(t);

      function go() { window.location.href = 'chapter.html?id=' + encodeURIComponent(meta.id); }
      g.addEventListener('click', go);
      g.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); }
      });
      svg.appendChild(g);
    });

    console.info('[map] mappa SVG: ' + app.CHAPTERS.length + ' nodi, ' + drawn + ' frecce.');
    return svg;
  }

  /* Elenco per telefono: una sezione per area, un link per capitolo. */
  function buildList(contentMap) {
    var app = window.MLA.app, tracker = window.MLA.tracker;
    var root = app.el('div', 'map-list', '');

    Object.keys(app.AREAS).forEach(function (area) {
      var sec = app.el('section', 'map-list-area', '');
      sec.appendChild(app.el('h3', 'map-list-head', ''));
      sec.firstChild.textContent = app.AREAS[area].label;
      var ul = document.createElement('ul');
      ul.className = 'map-list-items';

      app.CHAPTERS.filter(function (c) { return c.area === area; }).forEach(function (meta) {
        var status = tracker.status(meta.id);
        var hasContent = !!(contentMap && contentMap[meta.id]);
        var content = hasContent ? contentMap[meta.id] : null;

        var li = document.createElement('li');
        var a = document.createElement('a');
        a.className = 'map-item status-' + status;
        a.href = 'chapter.html?id=' + encodeURIComponent(meta.id);

        var badge = app.el('span', 'map-item-badge', '');
        badge.textContent = statusBadge(status);
        badge.setAttribute('aria-hidden', 'true');

        var body = app.el('span', 'map-item-body', '');
        var cap = app.el('span', 'map-item-cap', '');
        cap.textContent = nodeCaption(meta, hasContent);
        var title = app.el('span', 'map-item-title', '');
        title.textContent = content ? content.title : meta.title + ' (in arrivo)';
        var req = app.el('span', 'map-item-req', '');
        var prereqs = (meta.prereq || []).map(function (p) {
          var pm = app.byId(p);
          return pm ? 'cap ' + pm.n : p;
        });
        req.textContent = prereqs.length ? 'Richiede: ' + prereqs.join(', ') : 'Nessun prerequisito';

        body.appendChild(cap); body.appendChild(title); body.appendChild(req);
        a.appendChild(badge); a.appendChild(body);
        li.appendChild(a);
        ul.appendChild(li);
      });

      sec.appendChild(ul);
      root.appendChild(sec);
    });

    console.info('[map] elenco per telefono: ' + app.CHAPTERS.length + ' capitoli.');
    return root;
  }

  function isNarrow() {
    return !!(window.matchMedia && window.matchMedia(NARROW_QUERY).matches);
  }

  /** Disegna la mappa (o l'elenco su telefono) dentro container. */
  function render(container, contentMap) {
    state.container = container;
    state.contentMap = contentMap;
    container.innerHTML = '';
    container.appendChild(isNarrow() ? buildList(contentMap) : buildSvg(contentMap));

    // Al cambio di larghezza (rotazione, finestra ridimensionata) si ridisegna nel layout giusto.
    if (!state.listening && window.matchMedia) {
      var mq = window.matchMedia(NARROW_QUERY);
      var onChange = function () {
        if (state.container) render(state.container, state.contentMap);
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
      state.listening = true;
    }
  }

  window.MLA = window.MLA || {};
  window.MLA.map = { render: render };
})();
