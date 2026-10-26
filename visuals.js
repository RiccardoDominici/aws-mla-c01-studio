/* visuals.js — schemi, tabelle e diagrammi per le slide della lezione.
 *
 * Una slide ha `bullets`: stringhe e/o oggetti. Le stringhe restano elenchi, ma
 * quando il testo è del tipo "termine: definizione" vengono rese come schede con
 * il termine evidenziato, invece che come un muro di punti. Gli oggetti con
 * `kind` esplicito producono uno schema vero (flusso, tabella, barre, confronto).
 *
 * Non tocca la narrazione: l'audio dipende solo da `slides[].narration`, quindi
 * l'arricchimento grafico non manda fuori sincrono il player.
 *
 * Espone `window.MLA.visuals`:
 *   render(bullets) -> nodo DOM | null
 *   hasVisual(bullets) -> bool
 *   isItem(kind) -> bool   (per distinguere le voci gestite qui da quelle di chapter.js)
 *
 * Ogni nodo prodotto è puro DOM con textContent: nessun HTML dai JSON.
 */

(function () {
  'use strict';

  /* ---------- utilità ---------- */

  /** Nodo con classe e testo (mai HTML grezzo). */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }

  /* Su schermo stretto tabelle e formule possono eccedere la larghezza. Il
   * contenitore scorre, ma senza indizio sembra tagliato: si aggiunge una
   * etichetta solo quando c'è davvero qualcosa fuori vista. */
  function markScrollable(box) {
    function check() {
      var over = box.scrollWidth - box.clientWidth;
      box.classList.toggle('is-scrollable', over > 4);
    }
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(check);
      window.addEventListener('resize', check);
    }
    return box;
  }

  /* ---------- rilevamento delle ripetizioni ---------- */

  /* Parole portatrici di significato: articoli e preposizioni non dicono se un
   * testo ripete un altro, i termini tecnici sì. */
  var STOPWORDS = {};
  ('che di e il la per un una in con a da del della i gli le non si su al alla come o più dei ' +
   'delle lo è sono tra fra nel nella ai alle se ma anche quando ogni sua suo questo questa ' +
   'quello quella essere viene possono può con cui dei delle loro ogni').split(/\s+/).forEach(function (w) {
    STOPWORDS[w] = true;
  });

  /** Insieme delle parole "piene" di un testo, minuscole e senza punteggiatura. */
  function keyWords(value) {
    var words = String(value || '').toLowerCase().match(/[a-zàèéìòù0-9_]+/g) || [];
    var set = {};
    words.forEach(function (w) {
      if (w.length > 2 && !STOPWORDS[w]) set[w] = true;
    });
    return set;
  }

  /** Tutte le stringhe foglia di uno schema, unite: serve a capire cosa dice. */
  function specText(spec) {
    var parts = [];
    (function walk(v, key) {
      if (typeof v === 'string') {
        if (key !== 'mml' && key !== 'tone') parts.push(v);
      } else if (Array.isArray(v)) {
        v.forEach(function (x) { walk(x, key); });
      } else if (v && typeof v === 'object') {
        Object.keys(v).forEach(function (k) { walk(v[k], k); });
      }
    })(spec, '');
    return parts.join(' ');
  }

  /* Parole che segnalano un distinguo, una conseguenza o una trappola: sono il
   * motivo per cui una scheda che ripete lo schema vale comunque la pena.
   * Se compaiono, la scheda resta anche quando le parole coincidono. */
  var KEEP_MARKERS = /\b(non|invece|mentre|altrimenti|senza|mai|sempre|solo|tranne|purch|perch|quindi|diverso|differenza|attenzione|tranello|trappola|errore|sbagli|meglio|peggio|unica|eccezione|ricorda)\b/i;

  /** Quota delle parole del testo già presenti nello schema (0..1). */
  function coveredBy(text, specWords) {
    var w = keyWords(text);
    var keys = Object.keys(w);
    if (!keys.length) return 1;
    var hit = 0;
    keys.forEach(function (k) { if (specWords[k]) hit++; });
    return hit / keys.length;
  }

  /** Nodo con classe, figli in ordine. */
  function box(cls, children) {
    var n = el('div', cls);
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /** "Termine: definizione" → {term, def}; null se non è quel formato.
   *  Il due punti deve essere seguito da spazio, e il termine non deve essere
   *  una frase (limite di 52 caratteri) né contenere altri due punti. */
  function splitTerm(text) {
    var m = /^([^:]{2,52}):\s+(\S.*)$/.exec(String(text || '').trim());
    if (!m) return null;
    if (/[.!?]$/.test(m[1])) return null;
    return { term: m[1].trim(), def: m[2].trim() };
  }

  /** Spezza "a → b → c" (anche con ⇒, ⟶, ->) in parti, se sono 2-7. */
  function splitArrow(text) {
    var parts = String(text || '').split(/\s*(?:→|⇒|⟶|->|=>)\s*/).map(function (s) {
      return s.trim();
    }).filter(Boolean);
    return parts.length >= 2 && parts.length <= 7 ? parts : null;
  }

  /** Testo leggibile per l'aria-label di uno schema. */
  function label(parts) {
    return parts.filter(Boolean).join(', ');
  }

  /* ---------- forme di base ---------- */

  /** Badge numerato: dà un ordine visivo anche a un elenco. */
  function stepBadge(n) {
    return el('span', 'v-step', String(n));
  }

  /** Scheda termine + definizione (resa automatica per "X: y"). */
  function termCard(item, i) {
    var card = el('div', 'v-card');
    var head = box('v-card-head', [stepBadge(i + 1), el('span', 'v-card-term', item.term)]);
    card.appendChild(head);
    card.appendChild(el('p', 'v-card-def', item.def));
    return card;
  }

  /** Scheda semplice: il testo intero, senza spezzarlo. */
  function plainCard(text, i) {
    var card = el('div', 'v-card v-card-plain');
    card.appendChild(box('v-card-head', [stepBadge(i + 1)]));
    card.appendChild(el('p', 'v-card-text', text));
    return card;
  }

  /* Un bullet che si apre con un segnale di regola è un avviso, non un punto
   *  d'elenco: va nel riquadro colorato, senza dover annotare il JSON.
   *  Il riconoscimento è lessicale e chiuso: nessun bullet finisce in nota
   *  per caso, come accadrebbe con una soglia di lunghezza.
   *  L'alternanza mette per prime le etichette lunghe: con `regola` prima di
   *  `regola pratica`, il titolo diventerebbe "Regola" + " pratica" nel testo. */
  var NOTE_STARTS = /^(regola pratica|da non confondere|attenzione|tranello|importante|regola|errore|trucco|nota)\b[:\s]*/i;
  function asNote(text) {
    var t = String(text || '').trim();
    var m = NOTE_STARTS.exec(t);
    if (!m) return null;
    var rest = t.slice(m[0].length);
    // "Tranello d'esame: ..." — l'etichetta può portare un qualificatore breve
    // prima dei due punti: va nel titolo, non nel testo della nota.
    var colon = rest.indexOf(':');
    var qualifier = colon > 0 && colon <= 24 && !/[.!?]/.test(rest.slice(0, colon));
    var title = qualifier ? m[1] + ' ' + rest.slice(0, colon) : m[1];
    if (qualifier) rest = rest.slice(colon + 1);
    title = title.trim();
    title = title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
    return { title: title, text: rest.replace(/^[\s:]+/, '').trim() };
  }

  /* ---------- schemi ---------- */

  /** Flusso orizzontale di passi, con frecce. Adatto a pipeline e cicli. */
  function renderFlow(spec) {
    var steps = Array.isArray(spec.steps) ? spec.steps : [];
    var wrap = el('div', 'v-flow' + (spec.vertical ? ' v-flow-v' : ''));
    wrap.setAttribute('role', 'list');
    wrap.setAttribute('aria-label', spec.title || label(steps.map(function (s) {
      return typeof s === 'string' ? s : s.label;
    })));
    steps.forEach(function (s, i) {
      var item = typeof s === 'string' ? { label: s } : (s || {});
      var node = el('div', 'v-flow-step');
      node.setAttribute('role', 'listitem');
      if (item.tone) node.classList.add('tone-' + item.tone);
      node.appendChild(el('span', 'v-flow-num', String(i + 1)));
      node.appendChild(el('span', 'v-flow-label', item.label || ''));
      if (item.sub) node.appendChild(el('span', 'v-flow-sub', item.sub));
      wrap.appendChild(node);
      if (i < steps.length - 1) {
        var arrow = el('span', 'v-flow-arrow', '→');
        arrow.setAttribute('aria-hidden', 'true');
        wrap.appendChild(arrow);
      }
    });
    if (spec.loop) {
      var back = el('div', 'v-flow-loop', '↺ ' + (spec.loop === true ? 'si ripete' : spec.loop));
      wrap.appendChild(back);
    }
    return wrap;
  }

  /** Confronto a colonne (es. "giusto / sbagliato", "prima / dopo"). */
  function renderCompare(spec) {
    var cols = Array.isArray(spec.columns) ? spec.columns : [];
    var wrap = el('div', 'v-compare');
    cols.forEach(function (c) {
      var col = el('div', 'v-compare-col' + (c.tone ? ' tone-' + c.tone : ''));
      col.appendChild(el('h4', 'v-compare-head', c.head || ''));
      var ul = el('ul', 'v-compare-list');
      (c.items || []).forEach(function (t) {
        var li = el('li', null, typeof t === 'string' ? t : (t.text || t.label || ''));
        if (t && typeof t === 'object' && t.bad) li.classList.add('is-bad');
        if (t && typeof t === 'object' && t.good) li.classList.add('is-good');
        ul.appendChild(li);
      });
      col.appendChild(ul);
      wrap.appendChild(col);
    });
    return wrap;
  }

  /** Barre orizzontali con valore (percentuali, tempi, costi). */
  function renderBars(spec) {
    var rows = Array.isArray(spec.rows) ? spec.rows : [];
    var values = rows.map(function (r) { return Math.abs(Number(r.value) || 0); });
    var max = Number(spec.max) > 0 ? Number(spec.max) : (Math.max.apply(null, values) || 1);
    var wrap = el('div', 'v-bars');
    rows.forEach(function (r) {
      var row = el('div', 'v-bar-row' + (r.tone ? ' tone-' + r.tone : ''));
      var head = el('div', 'v-bar-head');
      head.appendChild(el('span', 'v-bar-label', r.label || ''));
      head.appendChild(el('span', 'v-bar-value', r.display != null ? r.display : (r.value + (spec.unit || ''))));
      row.appendChild(head);
      var track = el('div', 'v-bar-track');
      var fill = el('div', 'v-bar-fill');
      fill.style.width = Math.max(0, Math.min(100, (values[rows.indexOf(r)] / max) * 100)) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      if (r.note) row.appendChild(el('p', 'v-bar-note', r.note));
      wrap.appendChild(row);
    });
    return wrap;
  }

  /** Barra unica ripartita in segmenti (pesi che sommano al totale). */
  function renderStack(spec) {
    var rows = Array.isArray(spec.rows) ? spec.rows : [];
    var total = rows.reduce(function (a, r) { return a + (Number(r.value) || 0); }, 0) || 1;
    var wrap = el('div', 'v-stack');
    var bar = el('div', 'v-stack-bar');
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', label(rows.map(function (r) { return r.label + ' ' + r.value + (spec.unit || ''); })));
    rows.forEach(function (r, i) {
      var seg = el('span', 'v-stack-seg seg-' + (i % 6));
      seg.style.width = ((Number(r.value) || 0) / total) * 100 + '%';
      if (r.value) seg.textContent = String(r.value) + (spec.unit || '');
      bar.appendChild(seg);
    });
    wrap.appendChild(bar);
    var legend = el('div', 'v-stack-legend');
    rows.forEach(function (r, i) {
      var item = el('span', 'v-stack-key');
      item.appendChild(el('span', 'v-swatch seg-' + (i % 6)));
      item.appendChild(el('span', null, r.label + (r.note ? ' — ' + r.note : '')));
      legend.appendChild(item);
    });
    wrap.appendChild(legend);
    return wrap;
  }

  /** Tabella compatta con intestazioni; celle con ✓/✗ colorati. */
  function renderTable(spec) {
    var head = Array.isArray(spec.head) ? spec.head : [];
    var rows = Array.isArray(spec.rows) ? spec.rows : [];
    var wrap = markScrollable(el('div', 'v-scroll'));
    var inner = el('div', 'v-table-wrap');
    var table = el('table', 'v-table');
    if (head.length) {
      var trh = el('tr');
      head.forEach(function (h) {
        var th = el('th', null, h);
        th.scope = 'col';
        trh.appendChild(th);
      });
      var thd = el('thead'); thd.appendChild(trh); table.appendChild(thd);
    }
    var tbody = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      (r.cells || r).forEach(function (c, i) {
        var cell = el('td', null, '');
        var v = (c && typeof c === 'object') ? c.v : c;
        if (v === true || v === 'yes') { cell.textContent = '✓'; cell.className = 'v-yes'; }
        else if (v === false || v === 'no') { cell.textContent = '✗'; cell.className = 'v-no'; }
        else if (v === '?') { cell.textContent = '~'; cell.className = 'v-maybe'; }
        else cell.textContent = v == null ? '' : String(v);
        if (i === 0 && r.head) cell.classList.add('v-row-head');
        tr.appendChild(cell);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    inner.appendChild(table);
    wrap.appendChild(inner);
    if (spec.caption) wrap.appendChild(el('p', 'v-caption', spec.caption));
    return wrap;
  }

  /** Livelli sovrapposti: architetture (applicazione → servizio → rete → dati). */
  function renderLayers(spec) {
    var layers = Array.isArray(spec.layers) ? spec.layers : [];
    var wrap = el('div', 'v-layers');
    layers.forEach(function (l) {
      var row = el('div', 'v-layer' + (l.tone ? ' tone-' + l.tone : ''));
      row.appendChild(el('span', 'v-layer-label', l.label || ''));
      if (l.sub) row.appendChild(el('span', 'v-layer-sub', l.sub));
      wrap.appendChild(row);
    });
    return wrap;
  }

  /** Albero di decisione: radice + rami, ciascuno con la sua risposta. */
  function renderTree(spec) {
    var wrap = el('div', 'v-tree');
    if (spec.root) wrap.appendChild(el('div', 'v-tree-root', spec.root));
    var branches = Array.isArray(spec.branches) ? spec.branches : [];
    var grid = el('div', 'v-tree-branches');
    branches.forEach(function (b) {
      var col = el('div', 'v-tree-branch');
      col.appendChild(el('div', 'v-tree-when', b.when || ''));
      col.appendChild(el('div', 'v-tree-then', b.then || ''));
      if (b.note) col.appendChild(el('div', 'v-tree-note', b.note));
      grid.appendChild(col);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  /** Numero grande + etichetta: i valori da ricordare a memoria. */
  function renderStats(spec) {
    var items = Array.isArray(spec.items) ? spec.items : [];
    var wrap = el('div', 'v-stats');
    items.forEach(function (it) {
      var card = el('div', 'v-stat');
      card.appendChild(el('span', 'v-stat-value', it.value || ''));
      card.appendChild(el('span', 'v-stat-label', it.label || ''));
      if (it.note) card.appendChild(el('span', 'v-stat-note', it.note));
      wrap.appendChild(card);
    });
    return wrap;
  }

  /** Riquadro di attenzione: trappola, regola, cosa ricorda l'esame. */
  function renderNote(spec) {
    var wrap = el('div', 'v-note' + (spec.tone ? ' tone-' + spec.tone : ''));
    if (spec.title) wrap.appendChild(el('strong', 'v-note-title', spec.title));
    wrap.appendChild(el('span', null, spec.text || ''));
    return wrap;
  }

  /* ---------- schemi in SVG ---------- */

  var SVGNS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function svgText(x, y, text, attrs) {
    var t = svgEl('text', Object.assign({ x: x, y: y, 'font-size': 11, fill: '#2b2b2b' }, attrs || {}));
    t.textContent = String(text);
    return t;
  }

  var PALETTE = ['#2743a0', '#c0392b', '#1e7d4f', '#b07d10'];

  /** Un pannello con assi 0..1 e le sue curve. Ritorna l'elemento <svg>. */
  function chartPanel(panel) {
    var W = 460, H = 210, M = { l: 40, r: 14, t: 16, b: 30 };
    var iw = W - M.l - M.r, ih = H - M.t - M.b;
    var svg = svgEl('svg', {
      viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': panel.title || 'grafico'
    });
    for (var g = 0; g <= 4; g++) {
      var gy = M.t + (ih * g) / 4;
      svg.appendChild(svgEl('line', {
        x1: M.l, y1: gy, x2: W - M.r, y2: gy,
        stroke: 'rgba(43,43,43,0.14)', 'stroke-width': 1
      }));
      svg.appendChild(svgText(M.l - 6, gy + 4, (1 - g / 4).toFixed(1).replace('.', ','), {
        'text-anchor': 'end', 'font-size': 10, fill: '#5a5a5a'
      }));
    }
    svg.appendChild(svgEl('line', {
      x1: M.l, y1: M.t + ih, x2: W - M.r, y2: M.t + ih, stroke: '#2b2b2b', 'stroke-width': 1.5
    }));
    svg.appendChild(svgEl('line', {
      x1: M.l, y1: M.t, x2: M.l, y2: M.t + ih, stroke: '#2b2b2b', 'stroke-width': 1.5
    }));

    var curves = Array.isArray(panel.curves) ? panel.curves : [];
    curves.forEach(function (c, ci) {
      var pts = Array.isArray(c.points) ? c.points : [];
      if (pts.length < 2) return;
      var color = c.color || PALETTE[ci % PALETTE.length];
      var d = pts.map(function (p, i) {
        var x = M.l + Math.max(0, Math.min(1, +p[0])) * iw;
        var y = M.t + ih - Math.max(0, Math.min(1, +p[1])) * ih;
        return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
      svg.appendChild(svgEl('path', {
        d: d, fill: 'none', stroke: color,
        'stroke-width': 2.5, 'stroke-dasharray': c.dashed ? '6 4' : ''
      }));
      var last = pts[pts.length - 1];
      svg.appendChild(svgEl('circle', {
        cx: M.l + Math.max(0, Math.min(1, +last[0])) * iw,
        cy: M.t + ih - Math.max(0, Math.min(1, +last[1])) * ih,
        r: 3.5, fill: color
      }));
    });

    // punti singoli: la stessa soglia vista sulle due curve (più leggibile
    // di un tratteggio che finisce sotto la curva principale)
    (panel.dots || []).forEach(function (d) {
      var cx = M.l + Math.max(0, Math.min(1, +d[0])) * iw;
      var cy = M.t + ih - Math.max(0, Math.min(1, +d[1])) * ih;
      svg.appendChild(svgEl('circle', {
        cx: cx, cy: cy, r: 5.5, fill: '#c0392b', stroke: '#fffdf4', 'stroke-width': 2
      }));
    });

    if (panel.xLabel) {
      svg.appendChild(svgText(M.l + iw / 2, H - 5, panel.xLabel, {
        'text-anchor': 'middle', 'font-size': 11, fill: '#5a5a5a'
      }));
    }
    if (panel.yLabel) {
      var yl = svgText(11, M.t + ih / 2, panel.yLabel, {
        'text-anchor': 'middle', 'font-size': 11, fill: '#5a5a5a'
      });
      yl.setAttribute('transform', 'rotate(-90 11 ' + (M.t + ih / 2) + ')');
      svg.appendChild(yl);
    }
    return svg;
  }

  function chartLegend(curves) {
    var legend = el('div', 'v-chart-legend');
    curves.forEach(function (c, ci) {
      var k = el('span', 'v-stack-key');
      var sw = el('span', 'v-swatch');
      sw.style.background = c.color || PALETTE[ci % PALETTE.length];
      k.appendChild(sw);
      k.appendChild(el('span', null, c.label || ('serie ' + (ci + 1))));
      legend.appendChild(k);
    });
    return legend;
  }

  /** Grafici a curve su assi 0..1. Ogni figura ha uno o più pannelli con la
   *  propria coppia di assi: ROC (TPR/FPR) e PR (precision/recall) non vanno
   *  disegnate sullo stesso piano, altrimenti la curva non vuol dire nulla.
   *  Serve a mostrare forme che a parole non si capiscono: costo che crolla
   *  con il batch, curva di apprendimento, tradeoff precision/recall. */
  function renderScaling(spec) {
    var wrap = el('div', 'v-chart');
    if (spec.title) wrap.appendChild(el('div', 'v-chart-title', spec.title));
    // forma con pannelli: {panels:[{title,curves,xLabel,yLabel}]}
    var panels = Array.isArray(spec.panels) ? spec.panels : [spec];
    var grid = el('div', 'v-chart-panels' + (panels.length > 1 ? ' is-multi' : ''));
    panels.forEach(function (p) {
      var cell = el('div', 'v-chart-cell');
      if (panels.length > 1 && p.title) cell.appendChild(el('div', 'v-chart-panel-title', p.title));
      cell.appendChild(chartPanel(p));
      if (p.curves && p.curves.length) cell.appendChild(chartLegend(p.curves));
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);
    if (spec.caption) wrap.appendChild(el('p', 'v-caption', spec.caption));
    return wrap;
  }

  /** Matrice 2x2 con etichette: matrice di confusione, costi, rischi. */
  function renderMatrix(spec) {
    var wrap = markScrollable(el('div', 'v-scroll'));
    var inner = el('div', 'v-matrix-wrap');
    var table = el('table', 'v-matrix');
    var cols = spec.cols || ['previsto A', 'previsto B'];
    var rows = spec.rows || ['reale A', 'reale B'];
    var cells = spec.cells || [];
    var thead = el('thead');
    var trh = el('tr');
    trh.appendChild(el('th', 'v-matrix-corner', spec.corner || ''));
    cols.forEach(function (c) { trh.appendChild(el('th', null, c)); });
    thead.appendChild(trh); table.appendChild(thead);
    var tbody = el('tbody');
    rows.forEach(function (r, ri) {
      var tr = el('tr');
      tr.appendChild(el('th', 'v-matrix-rowhead', r));
      (cells[ri] || []).forEach(function (v, ci) {
        var td = el('td', v && v.tone ? 'tone-' + v.tone : null);
        var value = (v && typeof v === 'object') ? v.value : v;
        td.appendChild(el('span', 'v-matrix-value', value == null ? '' : String(value)));
        if (v && typeof v === 'object' && v.note) td.appendChild(el('span', 'v-matrix-note', v.note));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    inner.appendChild(table);
    wrap.appendChild(inner);
    if (spec.caption) wrap.appendChild(el('p', 'v-caption', spec.caption));
    return wrap;
  }

  /** Percorso di richiesta: attori in colonna con frecce, per mostrare chi
   *  parla con chi (CLIENT → ENDPOINT → CONTENITORE → S3, VPC, IAM...). */
  function renderTopology(spec) {
    var wrap = el('div', 'v-topo');
    if (spec.title) wrap.appendChild(el('div', 'v-topo-title', spec.title));
    var nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
    var row = el('div', 'v-topo-row');
    nodes.forEach(function (n, i) {
      var item = typeof n === 'string' ? { label: n } : (n || {});
      var node = el('div', 'v-topo-node' + (item.tone ? ' tone-' + item.tone : '') + (item.ghost ? ' is-ghost' : ''));
      node.appendChild(el('span', 'v-topo-label', item.label || ''));
      if (item.sub) node.appendChild(el('span', 'v-topo-sub', item.sub));
      row.appendChild(node);
      if (i < nodes.length - 1) {
        var arrow = el('span', 'v-topo-arrow', item.arrow || '→');
        arrow.setAttribute('aria-hidden', 'true');
        row.appendChild(arrow);
      }
    });
    wrap.appendChild(row);
    if (Array.isArray(spec.aside) && spec.aside.length) {
      var aside = el('div', 'v-topo-aside');
      spec.aside.forEach(function (a) {
        aside.appendChild(el('span', 'v-topo-tag', typeof a === 'string' ? a : (a.label || '')));
      });
      wrap.appendChild(aside);
    }
    if (spec.caption) wrap.appendChild(el('p', 'v-caption', spec.caption));
    return wrap;
  }

  /** Formula composta con caption: MathML se c'è, altrimenti testo Unicode. */
  function renderFormula(spec) {
    var shell = markScrollable(el('div', 'v-scroll'));
    var wrap = el('div', 'v-formula-box');
    shell.appendChild(wrap);
    var composed = false;
    if (spec.mml) {
      var holder = document.createElement('div');
      holder.innerHTML = String(spec.mml);
      var math = holder.firstElementChild;
      if (math && /^(math|mml:math)$/i.test(math.tagName)) {
        wrap.setAttribute('role', 'math');
        wrap.appendChild(math);
        composed = true;
      }
    }
    if (spec.text) {
      var fb = el('div', 'v-formula-fb', spec.text);
      // senza MathML composto il testo Unicode è l'unica resa possibile
      if (!composed) fb.classList.add('is-only');
      wrap.appendChild(fb);
    }
    if (spec.caption) wrap.appendChild(el('p', 'formula-caption', spec.caption));
    return shell;
  }

  /* ---------- registro degli schemi ---------- */

  var RENDERERS = {
    scaling: renderScaling,
    matrix: renderMatrix,
    topology: renderTopology,
    formula: renderFormula,
    flow: renderFlow,
    compare: renderCompare,
    bars: renderBars,
    stack: renderStack,
    table: renderTable,
    layers: renderLayers,
    tree: renderTree,
    stats: renderStats,
    note: renderNote
  };

  /** Tipi che questa funzione renderizza come blocco a sé. */
  var KINDS = {};
  Object.keys(RENDERERS).forEach(function (k) { KINDS[k] = true; });

  /** Una voce è "visual" se ha un kind tra quelli gestiti. */
  function isItem(b) {
    return !!(b && typeof b === 'object' && KINDS[b.kind]);
  }

  function hasVisual(bullets) {
    return Array.isArray(bullets) && bullets.some(isItem);
  }

  /* ---------- inferenza per le slide senza annotazioni ---------- */

  /** Trasforma un elenco di stringhe in schede: termine/definizione quando il
   *  formato regge, altrimenti testo intero. Il contenuto non viene riscritto. */
  function autoCards(texts, host) {
    var parsed = texts.map(splitTerm);
    var named = parsed.filter(Boolean).length;
    var cls = 'v-cards';
    if (named * 2 >= texts.length) cls += ' v-cards-kv';
    if (texts.length === 1) cls += ' v-cards-single';
    var grid = el('div', cls);
    var notes = [];
    var notesHost = el('div', 'v-notes');
    // numerazione continua sulle sole schede: le note e le voci filtrate non
    // devono lasciare buchi (1, 2, 4 sembrerebbe un errore)
    var n = 0;
    texts.forEach(function (t, i) {
      // `asNote` viene prima di `splitTerm`: "Tranello: ..." ha la forma
      // termine/definizione ma è un riquadro, non una scheda.
      var note = asNote(t);
      if (note) { notes.push(note); return; }
      if (parsed[i]) { grid.appendChild(termCard(parsed[i], n++)); return; }
      grid.appendChild(plainCard(t, n++));
    });
    notes.forEach(function (n) {
      notesHost.appendChild(renderNote({ title: n.title, text: n.text, tone: 'warn' }));
    });
    host.appendChild(grid);
    if (notes.length) host.appendChild(notesHost);
    return grid;
  }

  /**
   * Bullet "a → b → c": diventa uno schema di flusso al posto del testo.
   * Ritorna null se il bullet non è una catena.
   */
  function autoFlowItem(text) {
    var parts = splitArrow(text);
    if (!parts) return null;
    var flow = renderFlow({ steps: parts });
    flow.classList.add('v-block', 'v-block-auto');
    return flow;
  }

  /* ---------- ingresso principale ---------- */

  /**
   * Costruisce la vista della slide, nell'ordine dei bullet:
   * - le voci con `kind` diventano schemi a piena larghezza;
   * - le stringhe diventano schede (termine/definizione quando riconoscibili)
   *   e le catene "a → b → c" diventano un flusso soprastante;
   * - gli oggetti che questo modulo non conosce sono ignorati (li rende
   *   chapter.js con il suo codice esistente).
   * Ritorna un Fragment.
   */
  /* Soglia oltre la quale una scheda ripete uno schema invece di aggiungere
   * qualcosa. Misurata sulle slide reali: le schede che dicevano la stessa cosa
   * di una tabella stavano sopra 0,8; quelle con un dettaglio in più stavano
   * sotto 0,6. */
  var ECHO_RATIO = 0.72;

  /**
   * Bullet da non mostrare: quelli che ripetono uno schema della stessa slide
   * senza aggiungere un distinguo. È una funzione pura, così il renderer e gli
   * strumenti di manutenzione (`tools/prune_echoes.mjs`) usano la stessa regola
   * invece di due euristiche che col tempo divergono.
   * Ritorna {kept, hidden} dove `hidden` sono gli indici tolti.
   */
  function pruneEchoes(bullets) {
    var list = Array.isArray(bullets) ? bullets : [];
    var seen = {};
    list.forEach(function (b) {
      if (isItem(b)) {
        var sw = keyWords(specText(b));
        Object.keys(sw).forEach(function (k) { seen[k] = true; });
      }
    });
    var hasVisuals = Object.keys(seen).length > 0;
    var kept = [], hidden = [];
    list.forEach(function (b, i) {
      if (!hasVisuals || typeof b !== 'string') { kept.push(b); return; }
      // Una scheda numerata ("3. Una Lambda legge...") è un passo: la sua
      // posizione è informazione che la tabella non dà. Si tiene sempre.
      var isStep = /^\s*\d+[.)]\s/.test(b);
      // si toglie solo se non aggiunge un distinguo: "data quality non
      // richiede label" va tenuto anche se le parole sono nella tabella
      if (!isStep && coveredBy(b, seen) >= ECHO_RATIO && !KEEP_MARKERS.test(b)) {
        hidden.push(i);
        return;
      }
      kept.push(b);
    });
    return { kept: kept, hidden: hidden };
  }

  function render(bullets) {
    var frag = document.createDocumentFragment();
    var pruned = pruneEchoes(bullets);
    var list = pruned.kept;
    if (pruned.hidden.length) {
      console.info('[visuals] ' + pruned.hidden.length + ' bullet ripetevano uno schema: nascosti');
    }

    /* gruppi consecutivi di schede; uno schema esplicito chiude il gruppo */
    var run = [];
    function flushRun() {
      if (!run.length) return;
      var host = el('div', 'v-text');
      var flow = run._flow;
      if (flow) host.appendChild(flow);
      var cards = run.map(function (t) { return t; });
      autoCards(cards, host);
      frag.appendChild(host);
      run = [];
    }

    list.forEach(function (b) {
      if (typeof b === 'string' && b.trim()) {
        if (!run._flow) {
          var f = autoFlowItem(b);
          if (f) { run._flow = f; return; } // la catena è già lo schema
        }
        run.push(b);
        return;
      }
      if (isItem(b)) {
        flushRun();
        var node = null;
        try {
          node = RENDERERS[b.kind](b);
          // Il contratto prevede `caption` per tutti gli schemi, ma solo alcuni
          // renderer lo emettevano: quelli che non lo fanno lo ricevono qui,
          // così il campo non viene più ignorato in silenzio.
          if (node && b.caption && !node.querySelector('.v-caption, .formula-caption')) {
            node.appendChild(el('p', 'v-caption', b.caption));
          }
        } catch (err) {
          // una vignetta scritta male non deve far sparire il resto della slide
          console.error('[visuals] schema "' + b.kind + '" non reso: ' + err.message);
        }
        if (node) {
          node.classList.add('v-block');
          frag.appendChild(node);
        } else {
          // ripiego: il testo dello schema resta leggibile
          var plainText = b.text || b.title || b.caption;
          if (plainText) frag.appendChild(renderNote({ title: '', text: plainText }));
        }
      }
    });
    flushRun();
    return frag;
  }

  window.MLA = window.MLA || {};
  window.MLA.visuals = {
    render: render,
    hasVisual: hasVisual,
    isItem: isItem,
    pruneEchoes: pruneEchoes,
    /* esposti per i test e per il controllo qualità */
    _splitTerm: splitTerm,
    _splitArrow: splitArrow,
    _asNote: asNote
  };
})();
