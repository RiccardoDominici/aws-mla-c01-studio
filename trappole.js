/* trappole.js — sezione "Trappole d'esame e mnemonica".
 *
 * Estrae dalle slide di tutti i capitoli i riquadri che servono a non cadere
 * nei tranelli: i bullet `kind: "note"` (tranelli, regole, distinzioni), i
 * blocchi `kind: "stats"` (numeri da ricordare) e, sulle slide di metodo, i
 * passi dei flussi e le tabelle di mapping. Niente viene copiato a mano:
 * tutto nasce dai JSON dei capitoli, così la sezione resta allineata.
 *
 * La classificazione tra "trappola" e "regola" è lessicale e chiusa (titolo
 * del riquadro, poi parole esplicite nel testo): un riquadro non cambia
 * gruppo per caso. In caso di dubbio finisce tra le regole, mai fuori.
 *
 * Espone MLA.traps.extract(list) (puro, usato anche da tools/check_traps.mjs)
 * e MLA.traps.init() per la pagina trappole.html. */

(function (root) {
  'use strict';

  var MLA = root.MLA = root.MLA || {};

  /* Titoli che segnalano una trappola o una distinzione che l'esame sfrutta.
   * Le parole sono volutamente al plurale/parziale: "Limiti di S3 Vectors",
   * "I tranelli ricorrenti", "L'errore" devono entrare tutti. */
  var TRAP_TITLE = /(tranell|trappol|da non confondere|error|eccezion|limite|buco|premessa superata|numero aggiornato|valore vecchio|mossa sbagliata|il sintomo|il costo nascosto|dove non|perché non|perche non|^attenzione)/i;
  /* Parole esplicite nel testo: valgono anche se il titolo è neutro. */
  var TRAP_TEXT = /(tranell|trappol)/i;
  /* Slide che sono un sistema mnemonico: metodo, checklist, mapping, numeri. */
  var SYSTEM_SLIDE = /(metodo|checklist|pattern|tattica|mapping|numeri da (memorizzare|conoscere))/i;
  /* Stesse etichette che visuals.js trasforma in riquadro: una stringa che
   * inizia così è una nota anche se non è un oggetto `kind: "note"`. */
  var NOTE_STARTS = /^(regola pratica|da non confondere|attenzione|tranello|importante|regola|errore|trucco|nota)\b[:\s]*/i;

  var TYPES = ['trap', 'rule', 'numbers', 'system'];
  var TYPE_LABEL = {
    trap: 'Trappola',
    rule: 'Regola',
    numbers: 'Numeri',
    system: 'Metodo'
  };
  var TYPE_ICON = {
    trap: '🪤',
    rule: '📌',
    numbers: '🔢',
    system: '🧠'
  };

  function str(v) { return typeof v === 'string' ? v : ''; }

  /** Testo leggibile di una cella di tabella ({v, head} oppure stringa). */
  function cellText(c) {
    if (c && typeof c === 'object') return str(c.v != null ? c.v : c.label);
    return str(c);
  }

  /** "Trappola" o "Regola" per un bullet `kind: "note"`. */
  function classifyNote(note) {
    var title = str(note && note.title);
    var text = str(note && note.text);
    if (TRAP_TITLE.test(title) || TRAP_TEXT.test(title + ' ' + text)) return 'trap';
    return 'rule';
  }

  /**
   * Riconosce una stringa che inizia con un'etichetta di nota e la divide in
   * titolo e testo, con la stessa regola di visuals.js (il qualificatore breve
   * prima dei due punti resta nel titolo: "Tranello d'esame: ...").
   * @returns {{title:string,text:string}|null}
   */
  function asNoteString(text) {
    var t = str(text).trim();
    var m = NOTE_STARTS.exec(t);
    if (!m) return null;
    var rest = t.slice(m[0].length);
    var colon = rest.indexOf(':');
    var qualifier = colon > 0 && colon <= 24 && !/[.!?]/.test(rest.slice(0, colon));
    var title = qualifier ? m[1] + ' ' + rest.slice(0, colon) : m[1];
    if (qualifier) rest = rest.slice(colon + 1);
    title = title.trim();
    title = title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
    return { title: title, text: rest.replace(/^[\s:]+/, '').trim() };
  }

  /**
   * Estrae gli elementi da un elenco di capitoli già caricati.
   * @param {Array<{id:string,title:string,n:number,area:string,areaLabel:string,data:Object}>} list
   * @returns {{chapters:Array, counts:Object}} capitoli con almeno un elemento.
   */
  function extract(list) {
    var chapters = [];
    var counts = { trap: 0, rule: 0, numbers: 0, system: 0, total: 0 };

    (Array.isArray(list) ? list : []).forEach(function (c) {
      var data = c && c.data;
      if (!data || !Array.isArray(data.slides)) return;
      var items = [];

      data.slides.forEach(function (slide, si) {
        var bullets = Array.isArray(slide && slide.bullets) ? slide.bullets : [];
        var slideNo = si + 1;
        var slideTitle = str(slide && slide.title);

        bullets.forEach(function (b) {
          if (typeof b === 'string') {
            var parsed = asNoteString(b);
            if (!parsed || !parsed.text) return;
            items.push({
              type: classifyNote(parsed),
              slide: slideNo,
              slideTitle: slideTitle,
              title: parsed.title,
              text: parsed.text
            });
            return;
          }
          if (!b || typeof b !== 'object') return;

          if (b.kind === 'note') {
            var text = str(b.text);
            if (!text) return;
            items.push({
              type: classifyNote(b),
              slide: slideNo,
              slideTitle: slideTitle,
              title: str(b.title) || 'Da ricordare',
              text: text
            });
            return;
          }

          if (b.kind === 'stats') {
            var rows = (Array.isArray(b.items) ? b.items : []).map(function (it) {
              return {
                value: str(it && it.value),
                label: str(it && it.label),
                note: str(it && it.note)
              };
            }).filter(function (r) { return r.value || r.label; });
            if (rows.length) {
              items.push({
                type: 'numbers',
                slide: slideNo,
                slideTitle: slideTitle,
                title: slideTitle || 'Numeri da ricordare',
                rows: rows
              });
            }
          }
        });

        /* Slide di metodo: passi dei flussi e tabelle (mapping, checklist). */
        if (SYSTEM_SLIDE.test(slideTitle)) {
          var steps = [];
          var tables = [];
          bullets.forEach(function (b) {
            if (!b || typeof b !== 'object') return;
            if (b.kind === 'flow') {
              (Array.isArray(b.steps) ? b.steps : []).forEach(function (s, i) {
                var step = (s && typeof s === 'object') ? s : { label: s };
                steps.push({
                  label: str(step.label) || String(i + 1),
                  sub: str(step.sub)
                });
              });
            }
            if (b.kind === 'table') {
              var head = (Array.isArray(b.head) ? b.head : []).map(cellText);
              var body = (Array.isArray(b.rows) ? b.rows : []).map(function (r) {
                return (Array.isArray(r) ? r : []).map(cellText);
              });
              if (head.length || body.length) tables.push({ head: head, rows: body });
            }
          });
          if (steps.length || tables.length) {
            items.push({
              type: 'system',
              slide: slideNo,
              slideTitle: slideTitle,
              title: slideTitle,
              steps: steps,
              tables: tables
            });
          }
        }
      });

      if (!items.length) return;

      /* Ordine stabile: per slide, poi trappole → regole → numeri → metodi. */
      items.sort(function (a, b) {
        if (a.slide !== b.slide) return a.slide - b.slide;
        return TYPES.indexOf(a.type) - TYPES.indexOf(b.type);
      });

      items.forEach(function (it) { counts[it.type] += 1; counts.total += 1; });
      chapters.push({
        id: c.id,
        title: c.title,
        n: c.n,
        area: c.area,
        areaLabel: c.areaLabel || c.area,
        items: items
      });
    });

    return { chapters: chapters, counts: counts };
  }

  /* ---------- pagina trappole.html ---------- */

  var state = { q: '', ch: '', tipo: '' };

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function matches(item, chId) {
    if (state.ch && chId !== state.ch) return false;
    if (state.tipo && item.type !== state.tipo) return false;
    if (!state.q) return true;
    var q = state.q.toLowerCase();
    var hay = [item.title, item.text, item.slideTitle].join(' ');
    if (item.rows) {
      item.rows.forEach(function (r) { hay += ' ' + r.value + ' ' + r.label + ' ' + r.note; });
    }
    if (item.steps) {
      item.steps.forEach(function (s) { hay += ' ' + s.label + ' ' + s.sub; });
    }
    if (item.tables) {
      item.tables.forEach(function (t) {
        hay += ' ' + t.head.join(' ') + ' ' + t.rows.map(function (r) { return r.join(' '); }).join(' ');
      });
    }
    return hay.toLowerCase().indexOf(q) !== -1;
  }

  function slideLink(chapterId, slideNo, slideTitle) {
    var a = el('a', 'trap-open', 'Apri la slide →');
    a.href = 'chapter.html?id=' + encodeURIComponent(chapterId) + '&slide=' + slideNo;
    a.setAttribute('aria-label', 'Apri la slide ' + slideNo + ' del capitolo' +
      (slideTitle ? ': ' + slideTitle : ''));
    return a;
  }

  function numberList(rows) {
    var dl = el('dl', 'trap-number-list');
    rows.forEach(function (r) {
      dl.appendChild(el('dt', '', r.value));
      var dd = el('dd', '', r.label);
      if (r.note) dd.appendChild(el('span', 'trap-note', ' — ' + r.note));
      dl.appendChild(dd);
    });
    return dl;
  }

  function stepList(steps) {
    var ol = el('ol', 'trap-steps');
    steps.forEach(function (s) {
      var li = el('li');
      li.appendChild(el('strong', '', s.label));
      if (s.sub) li.appendChild(el('span', 'trap-sub', ' — ' + s.sub));
      ol.appendChild(li);
    });
    return ol;
  }

  function tableBox(table) {
    var wrap = el('div', 'trap-table-wrap');
    var t = el('table', 'trap-table');
    if (table.head.length) {
      var thead = el('thead');
      var hr = el('tr');
      table.head.forEach(function (h) { hr.appendChild(el('th', '', h)); });
      thead.appendChild(hr);
      t.appendChild(thead);
    }
    var tbody = el('tbody');
    table.rows.forEach(function (row) {
      var tr = el('tr');
      row.forEach(function (c) { tr.appendChild(el('td', '', c)); });
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    wrap.appendChild(t);
    return wrap;
  }

  function card(chapter, item) {
    var art = el('article', 'trap-card trap-type-' + item.type);
    var meta = el('p', 'trap-meta');
    meta.appendChild(el('span', 'trap-badge trap-badge-' + item.type,
      TYPE_ICON[item.type] + ' ' + TYPE_LABEL[item.type]));
    var src = 'Cap ' + chapter.n + ' · Slide ' + item.slide;
    if (item.slideTitle) src += ' · ' + item.slideTitle;
    meta.appendChild(el('span', 'trap-source', src));
    art.appendChild(meta);

    art.appendChild(el('h3', 'trap-title', item.title));

    if (item.type === 'numbers') {
      art.appendChild(numberList(item.rows || []));
    } else if (item.type === 'system') {
      if (item.steps && item.steps.length) art.appendChild(stepList(item.steps));
      (item.tables || []).forEach(function (t) { art.appendChild(tableBox(t)); });
    } else {
      art.appendChild(el('p', 'trap-text', item.text));
    }

    var foot = el('p', 'trap-foot');
    foot.appendChild(slideLink(chapter.id, item.slide, item.slideTitle));
    art.appendChild(foot);
    return art;
  }

  /** Filtri nello URL: un link può riaprire la pagina già filtrata. */
  function syncUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      ['q', 'ch', 'tipo'].forEach(function (k) {
        if (state[k]) params.set(k, state[k]);
        else params.delete(k);
      });
      var qs = params.toString();
      history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
    } catch (e) { /* URL non aggiornabile: nessun problema */ }
  }

  function render(host, model) {
    host.innerHTML = '';

    var toolbar = el('section', 'trap-toolbar');
    toolbar.setAttribute('aria-label', 'Filtra trappole e mnemonica');

    var searchId = 'trap-search';
    var label = el('label', 'trap-field', 'Cerca');
    label.setAttribute('for', searchId);
    var input = document.createElement('input');
    input.type = 'search';
    input.id = searchId;
    input.className = 'trap-search';
    input.placeholder = 'parola chiave, servizio, numero…';
    input.value = state.q;
    label.appendChild(input);
    toolbar.appendChild(label);

    var chId = 'trap-chapter';
    var chLabel = el('label', 'trap-field', 'Capitolo');
    chLabel.setAttribute('for', chId);
    var select = document.createElement('select');
    select.id = chId;
    select.className = 'trap-select';
    var all = el('option', '', 'Tutti i capitoli');
    all.value = '';
    select.appendChild(all);
    model.chapters.forEach(function (c) {
      var o = el('option', '', 'Cap ' + c.n + ' · ' + c.title);
      o.value = c.id;
      select.appendChild(o);
    });
    select.value = state.ch;
    if (state.ch && !model.chapters.some(function (c) { return c.id === state.ch; })) {
      state.ch = '';
      select.value = '';
    }
    chLabel.appendChild(select);
    toolbar.appendChild(chLabel);

    var chips = el('div', 'trap-chips');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Tipo di elemento');
    var chipDefs = [{ id: '', label: 'Tutte' }].concat(TYPES.map(function (t) {
      return { id: t, label: TYPE_ICON[t] + ' ' + TYPE_LABEL[t] + 's' };
    }));
    var chipEls = [];
    chipDefs.forEach(function (d) {
      var b = el('button', 'btn ghost small trap-chip', d.label);
      b.type = 'button';
      b.dataset.tipo = d.id;
      b.addEventListener('click', function () {
        state.tipo = d.id;
        paint();
      });
      chipEls.push(b);
      chips.appendChild(b);
    });
    toolbar.appendChild(chips);
    host.appendChild(toolbar);

    var live = el('p', 'trap-count muted');
    live.setAttribute('aria-live', 'polite');
    host.appendChild(live);

    var results = el('div', 'trap-results');
    host.appendChild(results);

    /* Le schede si ridisegnano a ogni filtro; la barra resta ferma, così la
     * ricerca non perde il fuoco mentre si scrive. */
    function paint() {
      chipEls.forEach(function (b) {
        b.setAttribute('aria-pressed', b.dataset.tipo === state.tipo ? 'true' : 'false');
      });
      results.innerHTML = '';
      var shown = 0;
      model.chapters.forEach(function (c) {
        var mine = c.items.filter(function (it) { return matches(it, c.id); });
        if (!mine.length) return;
        shown += mine.length;
        var section = el('section', 'trap-group');
        var h2 = el('h2', 'trap-group-title');
        h2.id = 'cap-' + c.id;
        h2.appendChild(el('span', 'trap-group-n', 'Cap ' + c.n));
        h2.appendChild(document.createTextNode(' ' + c.title));
        h2.appendChild(el('span', 'trap-group-count', String(mine.length)));
        section.appendChild(h2);
        mine.forEach(function (it) { section.appendChild(card(c, it)); });
        results.appendChild(section);
      });
      live.textContent = shown + (shown === 1 ? ' elemento' : ' elementi') +
        ' su ' + model.counts.total + ' raccolti da tutti i capitoli';
      if (!shown) {
        results.appendChild(el('p', 'notice',
          'Nessun elemento corrisponde ai filtri. Prova a togliere la ricerca o a scegliere "Tutte".'));
      }
      syncUrl();
    }

    input.addEventListener('input', function () {
      state.q = input.value.trim();
      paint();
    });
    select.addEventListener('change', function () {
      state.ch = select.value;
      paint();
    });

    paint();
  }

  function init() {
    var host = document.getElementById('trappole-root');
    if (!host) return;
    var app = MLA.app;
    if (!app) {
      host.innerHTML = '<p class="notice">Caricamento non disponibile: ricarica la pagina.</p>';
      return;
    }

    /* Filtri iniziali dal link (es. dalla pagina di un capitolo). */
    state.q = (app.getQueryParam('q') || '').trim();
    state.ch = app.getQueryParam('ch') || '';
    var tipo = app.getQueryParam('tipo') || '';
    state.tipo = TYPES.indexOf(tipo) !== -1 ? tipo : '';

    var list = app.CHAPTERS.map(function (meta) {
      return {
        id: meta.id,
        title: meta.title,
        n: meta.n,
        area: meta.area,
        areaLabel: app.AREAS[meta.area] ? app.AREAS[meta.area].label : meta.area,
        data: null
      };
    });
    list.push({
      id: 'quick-ref', title: 'Scheda di ripasso last-minute', n: '★',
      area: 'applicazioni', areaLabel: 'Ripasso', data: null
    });

    app.loadContent().then(function (res) {
      list.forEach(function (c) { c.data = res.chapters[c.id] || null; });
      var model = extract(list);
      render(host, model);
      console.info('[trappole] ' + model.counts.total + ' elementi da ' +
        model.chapters.length + ' capitoli: ' + model.counts.trap + ' trappole, ' +
        model.counts.rule + ' regole, ' + model.counts.numbers + ' blocchi di numeri, ' +
        model.counts.system + ' metodi');
    }).catch(function (err) {
      console.warn('[trappole] caricamento capitoli fallito:', err);
      host.innerHTML = '<p class="notice">Non riesco a caricare i contenuti dei capitoli. Riprova tra poco.</p>';
    });
  }

  MLA.traps = {
    TYPES: TYPES,
    TYPE_LABEL: TYPE_LABEL,
    classifyNote: classifyNote,
    asNoteString: asNoteString,
    extract: extract,
    init: init
  };

  if (typeof module === 'object' && module.exports) module.exports = MLA.traps;
})(typeof window !== 'undefined' ? window : globalThis);
