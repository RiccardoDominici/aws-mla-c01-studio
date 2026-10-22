/* qbank-ui.js — rendering della pagina "Banco domande" (domande.html).
 *
 * Due modalità:
 *  - Studio: elenco filtrabile, feedback al click (scelta singola) oppure
 *    checkbox + pulsante "Conferma" (risposta multipla), spiegazione sempre
 *    visibile dopo la risposta, stellina "da rivedere".
 *  - Simulazione: due tipi di prova.
 *      · Esame completo (MLA-C02: 85 domande, MLA-C01: 65): pesca dall'intero
 *        banco, senza filtri, solo domande dell'esame scelto, META escluse,
 *        ripartite per dominio secondo i pesi della guida.
 *      · Libera (10, 25, 50 o tutte): pesca dal filtro attivo, META escluse.
 *    Entrambe: 2,0 minuti a domanda, nessun feedback finché non si consegna,
 *    poi punteggio totale, punteggio per dominio e correzione completa.
 *
 * I filtri (capitolo / dominio / esame / tipo / difficoltà / stato / origine /
 * testo) sono a multi-selezione per riga: OR dentro la riga, AND tra righe.
 * La logica di dati, pesca e persistenza sta in qbank.js (MLA.qbank).
 * Il capitolo selezionato è sincronizzato con il query param ?ch=
 * (solo con un capitolo singolo) così le pagine capitolo possono
 * linkare direttamente il proprio sottoinsieme di domande.
 *
 * Espone MLA.qbankUI.init(rootElement). */

(function () {
  'use strict';

  var FREE_SIZES = [10, 25, 50];
  var PASS_PCT = 75;              // soglia di superamento; il 720/1000 AWS è un punteggio scalato
  var PAGE_STEP = 15;             // quante domande in più per click su "Mostra altre"
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  var PRESET_ORDER = ['C02', 'C01'];  // il primo preset è quello dell'esame in beta

  var DOMAIN_FILTERS = [
    { id: '1', label: '1 · Dati' },
    { id: '2', label: '2 · Modelli' },
    { id: '3', label: '3 · Deploy' },
    { id: '4', label: '4 · Monitoraggio' },
    { id: 'META', label: 'META · Formato' }
  ];
  var EXAM_FILTERS = [
    { id: 'C01', label: 'MLA-C01' },
    { id: 'C02', label: 'MLA-C02' }
  ];
  var TYPE_FILTERS = [
    { id: 'singola', label: 'Scelta singola' },
    { id: 'multipla', label: 'Risposta multipla' }
  ];
  var DIFF_FILTERS = [
    { id: 'facile', label: 'facile' },
    { id: 'media', label: 'media' },
    { id: 'difficile', label: 'difficile' }
  ];
  var ORIGIN_FILTERS = [
    { id: 'ai', label: '🤖 Generate dal sito' },
    { id: 'esterna', label: '🌐 Da pratica online' }
  ];
  var STATUS_FILTERS = [
    { id: 'todo', label: 'Da fare' },
    { id: 'wrong', label: 'Sbagliate' },
    { id: 'correct', label: 'Corrette' },
    { id: 'starred', label: '★ Da rivedere' }
  ];

  /* Nomi usati nei riepiloghi per dominio (guida MLA-C01, uguali nella MLA-C02). */
  var DOMAIN_NAMES = {
    '1': 'Preparazione dei dati',
    '2': 'Sviluppo dei modelli',
    '3': 'Deploy e orchestrazione',
    '4': 'Monitoraggio, manutenzione e sicurezza',
    'META': 'Formato ed esame'
  };
  var DOMAIN_SHORT = { '1': 'Dati', '2': 'Modelli', '3': 'Deploy', '4': 'Monitoraggio', 'META': 'Formato' };
  var DOMAIN_ORDER = ['1', '2', '3', '4', 'META'];

  /* Stato della vista, non persistito (tranne il capitolo singolo, che sta nell'URL). */
  var view = {
    mode: 'studio',
    filters: { chapters: [], domains: [], exams: [], types: [], difficulties: [], statuses: [], text: '', origins: [] },
    shuffled: false,
    limit: PAGE_STEP,
    all: [],
    byChapter: {},
    missing: [],
    visible: [],
    exam: null
  };

  var nodes = {};   // riferimenti ai contenitori creati una volta sola
  var app, qbank;

  /* ---------- Helper di presentazione ---------- */

  /** Etichetta breve di un capitolo: "Cap 3 · Modelli ML". */
  function chapterLabel(chapterId) {
    var meta = app.byId(chapterId);
    return meta ? 'Cap ' + meta.n + ' · ' + meta.short : chapterId;
  }

  /** Numero con virgola decimale, come lo scrive l'italiano: 2 → "2,0". */
  function decimalIt(n) {
    return n.toFixed(1).replace('.', ',');
  }

  /** Lettere delle opzioni in lista leggibile: [0,2] → "A e C". */
  function joinLetters(indices) {
    var L = indices.map(function (i) { return LETTERS[i]; });
    if (L.length <= 1) return L.join('');
    return L.slice(0, -1).join(', ') + ' e ' + L[L.length - 1];
  }

  /** Bottone-chip riutilizzabile con stato aria-pressed. */
  function chip(label, active, onClick) {
    var b = app.el('button', 'chip' + (active ? ' on' : ''), '');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
    b.addEventListener('click', onClick);
    return b;
  }

  /** Scrive il capitolo corrente nell'URL senza ricaricare la pagina.
   * Solo con un capitolo singolo: ?ch=<id>, altrimenti nessun param. */
  function syncUrl() {
    try {
      var url = new URL(window.location.href);
      if (view.filters.chapters.length === 1) url.searchParams.set('ch', view.filters.chapters[0]);
      else url.searchParams.delete('ch');
      history.replaceState(null, '', url.toString());
    } catch (err) {
      console.warn('[qbank-ui] impossibile aggiornare URL:', err);
    }
  }

  /**
   * Riga filtro a multi-selezione: chip "Tutti/Tutte" (svuota l'array,
   * attiva quando è vuoto) + un chip per valore che fa toggle.
   * OR dentro la riga, AND tra righe diverse (logica in qbank.filter).
   */
  function filterRow(host, key, labelText, ariaText, allLabel, values) {
    var row = app.el('div', 'qb-row', '');
    row.appendChild(app.el('span', 'qb-label', labelText));
    var group = app.el('div', 'chip-group', '');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', ariaText);
    group.appendChild(chip(allLabel, view.filters[key].length === 0, function () {
      clearFilter(key);
    }));
    values.forEach(function (v) {
      var active = view.filters[key].indexOf(v.id) !== -1;
      var b = chip(v.label, active, function () {
        toggleFilter(key, v.id);
      });
      if (v.disabled) b.disabled = true;
      if (v.area) b.classList.add('area-' + v.area);
      group.appendChild(b);
    });
    row.appendChild(group);
    host.appendChild(row);
  }

  /* ---------- Toolbar: modalità + filtri ---------- */

  function renderToolbar(host) {
    host.innerHTML = '';

    /* Selettore modalità */
    var modeRow = app.el('div', 'qb-row', '');
    var modeGroup = app.el('div', 'chip-group', '');
    modeGroup.setAttribute('role', 'group');
    modeGroup.setAttribute('aria-label', 'Modalità');
    modeRow.appendChild(app.el('span', 'qb-label', 'Modalità'));
    [['studio', '📖 Studio'], ['esame', '⏱ Simulazione d’esame']].forEach(function (m) {
      modeGroup.appendChild(chip(m[1], view.mode === m[0], function () {
        if (view.mode === m[0]) return;
        view.mode = m[0];
        view.exam = null;
        console.info('[qbank-ui] modalità: ' + m[0]);
        redraw();
      }));
    });
    modeRow.appendChild(modeGroup);
    host.appendChild(modeRow);

    /* Filtro capitolo: elenca tutti i capitoli di MLA.app, anche quelli senza domande */
    filterRow(host, 'chapters', 'Capitolo', 'Filtra per capitolo',
      'Tutti (' + view.all.length + ')',
      app.CHAPTERS.map(function (c) {
        return {
          id: c.id,
          label: c.n + '. ' + c.short + ' (' + (view.byChapter[c.id] || []).length + ')',
          area: c.area,
          disabled: !(view.byChapter[c.id] || []).length
        };
      }));

    /* Dominio, esame e tipo della domanda (schema v2) */
    filterRow(host, 'domains', 'Dominio', 'Filtra per dominio dell’esame', 'Tutti', DOMAIN_FILTERS);
    filterRow(host, 'exams', 'Esame', 'Filtra per esame', 'Entrambi', EXAM_FILTERS);
    filterRow(host, 'types', 'Tipo', 'Filtra per tipo di domanda', 'Tutti', TYPE_FILTERS);

    /* Difficoltà, stato di avanzamento (OR tra stati), origine */
    filterRow(host, 'difficulties', 'Difficoltà', 'Filtra per difficoltà', 'Tutte', DIFF_FILTERS);
    filterRow(host, 'statuses', 'Stato', 'Filtra per stato', 'Tutte', STATUS_FILTERS);
    filterRow(host, 'origins', 'Origine', 'Filtra per origine delle domande', 'Tutte', ORIGIN_FILTERS);

    /* Ricerca testuale + azioni */
    var fRow = app.el('div', 'qb-row', '');
    var lab = app.el('label', 'qb-label', 'Cerca');
    lab.htmlFor = 'qb-search';
    fRow.appendChild(lab);

    var input = document.createElement('input');
    input.type = 'search';
    input.id = 'qb-search';
    input.className = 'qb-search';
    input.placeholder = 'parola chiave, es. "SageMaker", "Bedrock", "Glue"…';
    input.value = view.filters.text;
    var debounce = null;
    input.addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        view.filters.text = input.value;
        view.limit = PAGE_STEP;
        applyFilters();
        renderBody();
        renderStats();
      }, 180);
    });
    fRow.appendChild(input);

    var shuffleBtn = app.el('button', 'btn ghost small', view.shuffled ? '🔀 Ordine casuale' : '🔀 Mescola');
    shuffleBtn.type = 'button';
    shuffleBtn.addEventListener('click', function () {
      view.shuffled = !view.shuffled;
      view.limit = PAGE_STEP;
      applyFilters();
      renderToolbar(nodes.toolbar);
      renderBody();
    });
    fRow.appendChild(shuffleBtn);

    var resetBtn = app.el('button', 'btn ghost small', '↺ Azzera risposte');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', function () {
      if (!confirm('Azzerare tutte le risposte date? Le domande segnate con ★ restano segnate.')) return;
      qbank.state.resetAnswers(true);
      redraw();
    });
    fRow.appendChild(resetBtn);

    host.appendChild(fRow);
  }

  /** Aggiunge/toglie un valore da una riga filtro e ridisegna il necessario. */
  function toggleFilter(name, value) {
    var list = view.filters[name];
    var i = list.indexOf(value);
    if (i === -1) list.push(value);
    else list.splice(i, 1);
    view.limit = PAGE_STEP;
    if (name === 'chapters') syncUrl();
    applyFilters();
    renderToolbar(nodes.toolbar);
    renderStats();
    renderBody();
  }

  /** Svuota una riga filtro (= "Tutti/Tutte") e ridisegna il necessario. */
  function clearFilter(name) {
    view.filters[name] = [];
    view.limit = PAGE_STEP;
    if (name === 'chapters') syncUrl();
    applyFilters();
    renderToolbar(nodes.toolbar);
    renderStats();
    renderBody();
  }

  /* ---------- Statistiche ---------- */

  function renderStats() {
    var host = nodes.stats;
    host.innerHTML = '';
    var s = qbank.state.stats(view.visible);
    var globalStats = qbank.state.stats(view.all);

    var line = app.el('p', 'qb-stats', '');
    line.appendChild(app.el('strong', '', String(s.total)));
    line.appendChild(document.createTextNode(' domande nel filtro · '));
    line.appendChild(document.createTextNode(s.answered + ' risposte'));
    if (s.answered) {
      line.appendChild(document.createTextNode(' · '));
      var acc = app.el('span', s.pct >= PASS_PCT ? 'qb-ok' : 'qb-ko', s.pct + '% corrette');
      line.appendChild(acc);
      line.appendChild(document.createTextNode(' (' + s.correct + ' giuste, ' + s.wrong + ' sbagliate)'));
    }
    if (s.starred) line.appendChild(document.createTextNode(' · ★ ' + s.starred + ' da rivedere'));
    host.appendChild(line);

    var bar = app.el('div', 'progress-bar qb-bar', '');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Domande affrontate su tutto il banco');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    var pctAll = globalStats.total ? Math.round((globalStats.answered / globalStats.total) * 100) : 0;
    bar.setAttribute('aria-valuenow', String(pctAll));
    var fill = app.el('div', 'progress-fill', '');
    fill.style.width = pctAll + '%';
    bar.appendChild(fill);
    host.appendChild(bar);
    host.appendChild(app.el('p', 'muted small', 'Totale banco: ' + globalStats.answered + ' / ' +
      globalStats.total + ' domande affrontate (' + pctAll + '%).'));
  }

  /* ---------- Opzioni e selezione ---------- */

  /**
   * Costruisce le opzioni di una domanda. Scelta singola: bottoni, un click
   * risponde. Risposta multipla: una checkbox per opzione dentro un'etichetta.
   * Non le inserisce nel DOM: lo fa chi chiama (questionCard).
   * @returns {{list:Element, items:Element[], controls:Element[]}}
   *          items: l'elemento su cui stanno le classi ok/ko/chosen;
   *          controls: ciò che va disabilitato dopo la risposta.
   */
  function buildOptions(q, opts) {
    var list = app.el('div', 'qopts', '');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', 'Opzioni di risposta');
    var multi = qbank.isMulti(q);
    var items = [];
    var controls = [];

    q.options.forEach(function (text, i) {
      var k = app.el('span', 'qopt-k', LETTERS[i]);
      var t = app.el('span', 'qopt-t', '');
      t.textContent = text;

      if (!multi) {
        var b = app.el('button', 'qopt', '');
        b.type = 'button';
        b.appendChild(k);
        b.appendChild(t);
        b.addEventListener('click', function () {
          if (opts.onAnswer) opts.onAnswer(i);
        });
        items.push(b);
        controls.push(b);
        list.appendChild(b);
        return;
      }

      var label = app.el('label', 'qopt qopt-multi', '');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'qcheck';
      input.value = String(i);
      label.appendChild(input);
      label.appendChild(k);
      label.appendChild(t);
      items.push(label);
      controls.push(input);
      list.appendChild(label);
    });
    return { list: list, items: items, controls: controls };
  }

  /**
   * Collega le checkbox di una domanda multipla: tiene la selezione in built.selected,
   * blocca le caselle quando si è già raggiunto il numero di risposte (come all'esame)
   * e chiama onChange a ogni cambio.
   */
  function bindMulti(q, built, onChange) {
    var need = q.answer.length;
    built.selected = [];

    built.setSelected = function (list) {
      built.selected = list.slice().sort(function (a, b) { return a - b; });
      built.controls.forEach(function (inp, i) {
        var on = built.selected.indexOf(i) !== -1;
        inp.checked = on;
        inp.disabled = !on && built.selected.length >= need;
        built.items[i].classList.toggle('chosen', on);
      });
      if (onChange) onChange(built.selected);
    };

    built.controls.forEach(function (inp, i) {
      inp.addEventListener('change', function () {
        var list = built.selected.filter(function (v) { return v !== i; });
        if (inp.checked) list.push(i);
        built.setSelected(list);
      });
    });
  }

  /** Riga "Conferma" + indicazione del numero di risposte, per la multipla in studio. */
  function addConfirm(q, built, onConfirm) {
    var need = q.answer.length;
    var row = app.el('div', 'qconfirm', '');
    var hint = app.el('p', 'qhint', '');
    var btn = app.el('button', 'btn primary', 'Conferma');
    btn.type = 'button';
    btn.addEventListener('click', function () {
      if (!btn.disabled) onConfirm(built.selected.slice());
    });
    row.appendChild(hint);
    row.appendChild(btn);

    built.confirmRow = row;
    built.refreshConfirm = function () {
      var n = built.selected.length;
      hint.textContent = 'Seleziona ' + need + ' risposte: ' + n + ' su ' + need + ' scelte.';
      btn.disabled = n !== need;
    };
    built.refreshConfirm();
    return row;
  }

  /* ---------- Card domanda ---------- */

  /**
   * Costruisce la card di una domanda.
   * @param {Object} q domanda normalizzata
   * @param {number} num numero progressivo mostrato
   * @param {Object} opts { onAnswer(i) per la singola, onSelect(indici) per la multipla,
   *                        onConfirm(indici) per la multipla in studio (aggiunge "Conferma") }
   * @returns {{card, list, items, controls, fbHost, confirmRow, selected, setSelected}}
   */
  function questionCard(q, num, opts) {
    opts = opts || {};
    var card = app.el('article', 'qcard', '');
    card.dataset.qid = q.id;

    /* Intestazione: solo numero + stellina "da rivedere".
       Niente badge di capitolo/difficoltà/origine/tag: rivelerebbero
       indizi utili a indovinare (i filtri in toolbar restano visibili). */
    var head = app.el('div', 'qcard-head', '');
    head.appendChild(app.el('span', 'qnum', 'D' + num));

    var starred = qbank.state.get(q.id).starred;
    var star = app.el('button', 'star' + (starred ? ' on' : ''), starred ? '★' : '☆');
    star.type = 'button';
    star.title = 'Segna come "da rivedere"';
    star.setAttribute('aria-label', 'Segna la domanda ' + num + ' come da rivedere');
    star.setAttribute('aria-pressed', starred ? 'true' : 'false');
    star.addEventListener('click', function () {
      var on = qbank.state.toggleStar(q.id);
      star.classList.toggle('on', on);
      star.textContent = on ? '★' : '☆';
      star.setAttribute('aria-pressed', on ? 'true' : 'false');
      renderStats();
    });
    head.appendChild(star);
    card.appendChild(head);

    /* Testo domanda */
    var qText = app.el('p', 'qtext', '');
    qText.textContent = q.q;
    card.appendChild(qText);

    /* Opzioni */
    var built = buildOptions(q, opts);
    built.card = card;
    card.appendChild(built.list);

    if (qbank.isMulti(q)) {
      bindMulti(q, built, function (selected) {
        if (built.refreshConfirm) built.refreshConfirm();
        if (opts.onSelect) opts.onSelect(selected);
      });
      if (opts.onConfirm) card.appendChild(addConfirm(q, built, opts.onConfirm));
    }

    built.fbHost = app.el('div', 'qfb-host', '');
    card.appendChild(built.fbHost);
    return built;
  }

  /** Vero se una risposta data è vuota (nessuna scelta). */
  function isEmptyGiven(given) {
    if (given === null || given === undefined) return true;
    return Array.isArray(given) && given.length === 0;
  }

  /**
   * Applica lo stile "risposta rivelata" a una card.
   * @param {Object} q domanda
   * @param {Object} built risultato di questionCard
   * @param {number|number[]|null} given risposta data
   * @param {boolean} showExplain se mostrare il riquadro di esito e spiegazione
   */
  function reveal(q, built, given, showExplain) {
    var correct = qbank.correctOf(q);
    var chosen = isEmptyGiven(given) ? [] : (Array.isArray(given) ? given : [given]);

    built.controls.forEach(function (c) { c.disabled = true; });
    built.items.forEach(function (it, i) {
      it.classList.remove('chosen');
      if (correct.indexOf(i) !== -1) it.classList.add('ok');
      else if (chosen.indexOf(i) !== -1) it.classList.add('ko');
    });
    if (built.confirmRow) built.confirmRow.hidden = true;
    if (!showExplain) return;

    built.fbHost.innerHTML = '';
    var answered = chosen.length > 0;
    var ok = qbank.isCorrect(q, given);
    var multi = qbank.isMulti(q);
    var box = app.el('div', 'qfb ' + (ok ? 'ok' : 'ko'), '');
    var title = app.el('p', 'qfb-title', '');

    if (!answered) {
      title.textContent = '— Senza risposta. ' + (multi ? 'Corrette: ' : 'Corretta: ') +
        joinLetters(correct) + '.';
    } else if (ok) {
      title.textContent = '✔ Risposta corretta.';
    } else if (multi) {
      title.textContent = '✘ Sbagliata. Le corrette sono ' + joinLetters(correct) + '.';
    } else {
      title.textContent = '✘ Sbagliata. La corretta è ' + LETTERS[q.answer] + ': ' + q.options[q.answer];
    }
    box.appendChild(title);
    if (q.explain) {
      var p = app.el('p', 'qfb-text', '');
      p.textContent = q.explain;
      box.appendChild(p);
    }
    if (q.source) {
      var src = app.el('p', 'qfb-src', '');
      src.textContent = 'Fonte: ' + q.source;
      box.appendChild(src);
    }
    built.fbHost.appendChild(box);
  }

  /* ---------- Modalità studio ---------- */

  function renderStudy(host) {
    host.innerHTML = '';

    if (!view.visible.length) {
      host.appendChild(app.el('p', 'notice',
        'Nessuna domanda con questi filtri. Prova ad allargare la selezione.'));
      return;
    }

    var list = app.el('div', 'qlist', '');
    var shown = view.visible.slice(0, view.limit);

    shown.forEach(function (q, idx) {
      var saved = qbank.state.get(q.id);
      var built = questionCard(q, idx + 1, {
        onAnswer: function (chosen) {
          var ok = qbank.isCorrect(q, chosen);
          qbank.state.record(q.id, chosen, ok);
          settleCard(q, built, chosen, ok);
        },
        onConfirm: function (selected) {
          var ok = qbank.isCorrect(q, selected);
          qbank.state.record(q.id, selected, ok);
          settleCard(q, built, selected, ok);
        }
      });

      /* Se era già stata risposta, la card parte già rivelata. */
      if (!isEmptyGiven(saved.given)) {
        reveal(q, built, saved.given, true);
        built.card.classList.add(saved.ok ? 'answered-ok' : 'answered-ko');
        addRetry(q, built);
      }

      list.appendChild(built.card);
    });

    host.appendChild(list);

    if (view.visible.length > view.limit) {
      var more = app.el('button', 'btn big qb-more', 'Mostra altre ' +
        Math.min(PAGE_STEP, view.visible.length - view.limit) +
        ' (viste ' + view.limit + ' di ' + view.visible.length + ')');
      more.type = 'button';
      more.addEventListener('click', function () {
        view.limit += PAGE_STEP;
        renderBody();
      });
      host.appendChild(more);
    }
  }

  /** Dopo una risposta in studio: rivela, colora la card e aggiunge "riprova". */
  function settleCard(q, built, given, ok) {
    reveal(q, built, given, true);
    built.card.classList.add(ok ? 'answered-ok' : 'answered-ko');
    addRetry(q, built);
    renderStats();
  }

  /** Aggiunge il link "riprova" a una card già risposta. */
  function addRetry(q, built) {
    if (built.card.querySelector('.qretry')) return;
    var retry = app.el('button', 'btn ghost small qretry', '↺ Riprova questa');
    retry.type = 'button';
    retry.addEventListener('click', function () {
      qbank.state.clearAnswer(q.id);
      built.fbHost.innerHTML = '';
      built.card.classList.remove('answered-ok', 'answered-ko');
      built.controls.forEach(function (c) {
        c.disabled = false;
        if (c.type === 'checkbox') c.checked = false;
      });
      built.items.forEach(function (it) { it.classList.remove('ok', 'ko', 'chosen'); });
      if (built.confirmRow) {
        built.selected = [];
        built.confirmRow.hidden = false;
        built.refreshConfirm();
      }
      retry.remove();
      renderStats();
    });
    built.fbHost.appendChild(retry);
  }

  /* ---------- Modalità simulazione d'esame: impostazione ---------- */

  /** Riga "Domande per dominio" leggibile: "Dati 18 · Modelli 17 · ...". */
  function quotaText(quotas) {
    return ['1', '2', '3', '4'].map(function (d) {
      return DOMAIN_SHORT[d] + ' ' + (quotas[d] || 0);
    }).join(' · ');
  }

  /** Avvisi su domini a corto di domande, per la schermata iniziale. */
  function shortfallNotices(plan) {
    var notes = [];
    plan.shortfalls.forEach(function (s) {
      notes.push('Dominio ' + s.domain + ' (' + DOMAIN_NAMES[s.domain] + '): ' + s.have +
        ' domande disponibili su ' + s.wanted + ' richieste. Le ' + (s.wanted - s.have) +
        ' mancanti sono prese dagli altri domini.');
    });
    if (plan.reduced && !plan.shortfalls.length) {
      notes.push('Il banco ha solo ' + plan.poolSize + ' domande per ' + plan.label +
        ': la simulazione sarà di ' + plan.size + ' domande.');
    }
    return notes;
  }

  function renderExamSetup(host) {
    host.innerHTML = '';
    var minutes = qbank.MINUTES_PER_QUESTION;
    var box = app.el('section', 'block exam-setup', '');
    box.appendChild(app.el('h2', '', 'Simulazione d’esame'));
    box.appendChild(app.el('p', '',
      'Ogni simulazione dà ' + decimalIt(minutes) + ' minuti a domanda, il ritmo dell’esame vero ' +
      '(MLA-C01: 65 domande in 130 minuti; MLA-C02: 85 domande in 170 minuti). ' +
      'Nessun feedback finché non consegni. Le domande a risposta multipla si correggono ' +
      'tutto-o-niente, come all’esame.'));

    /* Esami completi: ignorano i filtri, pescano per dominio */
    box.appendChild(app.el('h3', 'exam-sub', 'Esame completo'));
    box.appendChild(app.el('p', 'muted small',
      'Pescano dall’intero banco, senza applicare i filtri: solo domande dell’esame scelto, ' +
      'META escluse, ripartite per dominio secondo i pesi della guida.'));

    PRESET_ORDER.forEach(function (examId) {
      var spec = qbank.EXAM_SPECS[examId];
      var plan = qbank.planExam(view.all, examId);
      var row = app.el('div', 'qb-preset', '');

      var b = app.el('button', 'btn primary big',
        'Simula ' + spec.label + ': ' + spec.questions + ' domande, ' + (spec.questions * minutes) + ' minuti');
      b.type = 'button';
      b.disabled = plan.size === 0;
      b.addEventListener('click', function () { startPreset(plan); });
      row.appendChild(b);

      if (plan.size) {
        row.appendChild(app.el('p', 'muted small',
          'Domande disponibili per ' + spec.label + ': ' + plan.poolSize + '. Quote: ' +
          quotaText(plan.quotas) + '.'));
      }
      shortfallNotices(plan).forEach(function (msg) {
        row.appendChild(app.el('p', 'notice', msg));
      });
      if (!plan.size) {
        row.appendChild(app.el('p', 'notice', 'Nessuna domanda ' + spec.label + ' nel banco.'));
      }
      box.appendChild(row);
    });

    /* Simulazioni libere: pescano dal filtro attivo */
    box.appendChild(app.el('h3', 'exam-sub', 'Simulazione libera'));
    var pool = qbank.withoutMeta(view.visible);
    box.appendChild(app.el('p', 'muted small',
      'Pesca dal filtro attivo (' + pool.length + ' domande disponibili, META escluse), a ' +
      decimalIt(minutes) + ' minuti a domanda.'));

    if (pool.length < 5) {
      box.appendChild(app.el('p', 'notice', 'Servono almeno 5 domande tecniche nel filtro per avviare una simulazione libera.'));
      host.appendChild(box);
      return;
    }

    var row = app.el('div', 'qb-row', '');
    row.appendChild(app.el('span', 'qb-label', 'Domande'));
    var group = app.el('div', 'chip-group', '');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Numero di domande');
    FREE_SIZES.concat([pool.length]).filter(function (n, i, arr) {
      return n <= pool.length && arr.indexOf(n) === i;
    }).forEach(function (n) {
      var label = n === pool.length && FREE_SIZES.indexOf(n) === -1 ? 'Tutte (' + n + ')' : String(n);
      var btn = app.el('button', 'btn', label);
      btn.type = 'button';
      btn.addEventListener('click', function () { startFree(n); });
      group.appendChild(btn);
    });
    row.appendChild(group);
    box.appendChild(row);
    host.appendChild(box);
  }

  /* ---------- Modalità simulazione d'esame: avvio e svolgimento ---------- */

  /** Avvia un esame completo dal piano calcolato (pesca per dominio dal banco intero). */
  function startPreset(plan) {
    var questions = qbank.drawExam(view.all, plan);
    console.info('[qbank-ui] esame completo ' + plan.label + ': ' + questions.length +
      ' domande, quote ' + JSON.stringify(plan.quotas));
    beginExam({
      title: plan.label + ' · ' + questions.length + ' domande',
      questions: questions,
      minutes: questions.length * qbank.MINUTES_PER_QUESTION
    });
  }

  /** Avvia una simulazione libera: n domande dal filtro attivo, META escluse. */
  function startFree(n) {
    var questions = qbank.sample(qbank.withoutMeta(view.visible), n);
    console.info('[qbank-ui] simulazione libera: ' + questions.length + ' domande');
    beginExam({
      title: questions.length + ' domande · filtro attivo',
      questions: questions,
      minutes: questions.length * qbank.MINUTES_PER_QUESTION
    });
  }

  /** Stato di una simulazione in corso o consegnata. */
  function beginExam(cfg) {
    view.exam = {
      title: cfg.title,
      questions: cfg.questions,
      answers: {},          // id domanda -> indice (singola) o indici (multipla); assente = senza risposta
      submitted: false,
      endsAt: Date.now() + Math.round(cfg.minutes * 60 * 1000),
      timer: null,
      score: 0,
      byDomain: {}
    };
    renderBody();
  }

  function renderExamRun(host) {
    var exam = view.exam;
    host.innerHTML = '';

    var bar = app.el('div', 'exam-bar', '');
    var title = app.el('span', 'exam-title', exam.title);
    var counter = app.el('span', 'exam-count', '');
    var clock = app.el('span', 'exam-clock', '');
    clock.setAttribute('role', 'timer');
    clock.setAttribute('aria-live', 'off');
    var submit = app.el('button', 'btn primary', 'Consegna');
    submit.type = 'button';
    submit.addEventListener('click', function () { submitExam(); });
    bar.appendChild(title);
    bar.appendChild(counter);
    bar.appendChild(clock);
    bar.appendChild(submit);
    host.appendChild(bar);

    function updateCounter() {
      counter.textContent = 'Risposte ' + Object.keys(exam.answers).length + ' / ' + exam.questions.length;
    }

    var list = app.el('div', 'qlist', '');
    exam.questions.forEach(function (q, idx) {
      var built = questionCard(q, idx + 1, {
        onAnswer: function (chosen) {
          exam.answers[q.id] = chosen;
          built.items.forEach(function (b, i) { b.classList.toggle('chosen', i === chosen); });
          updateCounter();
        },
        onSelect: function (selected) {
          if (selected.length) exam.answers[q.id] = selected;
          else delete exam.answers[q.id];
          updateCounter();
        }
      });
      list.appendChild(built.card);
    });
    host.appendChild(list);
    updateCounter();

    var submit2 = app.el('button', 'btn primary big qb-more', 'Consegna e correggi');
    submit2.type = 'button';
    submit2.addEventListener('click', function () { submitExam(); });
    host.appendChild(submit2);

    /* Timer: aggiorna ogni secondo, consegna automatica allo scadere. */
    function tick() {
      var left = Math.max(0, exam.endsAt - Date.now());
      var m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      clock.textContent = '⏱ ' + m + ':' + (s < 10 ? '0' : '') + s;
      clock.classList.toggle('urgent', left < 60000);
      if (left <= 0) {
        clearInterval(exam.timer);
        console.info('[qbank-ui] tempo scaduto: consegna automatica');
        submitExam();
      }
    }
    clearInterval(exam.timer);
    exam.timer = setInterval(tick, 1000);
    tick();
  }

  /** Corregge la simulazione: punteggio totale, per dominio, e persistenza delle risposte. */
  function submitExam() {
    var exam = view.exam;
    if (!exam || exam.submitted) return;
    exam.submitted = true;
    clearInterval(exam.timer);

    /* Le risposte dell'esame confluiscono nello stato persistente:
     * così i filtri "sbagliate" e le statistiche restano coerenti. */
    exam.score = 0;
    exam.byDomain = {};
    exam.questions.forEach(function (q) {
      var given = exam.answers[q.id];
      var answered = given !== undefined;
      var ok = answered && qbank.isCorrect(q, given);
      var d = exam.byDomain[q.domain] || (exam.byDomain[q.domain] = { ok: 0, total: 0 });
      d.total++;
      if (ok) { d.ok++; exam.score++; }
      if (answered) qbank.state.record(q.id, given, ok);
    });
    console.info('[qbank-ui] simulazione consegnata: ' + exam.score + '/' + exam.questions.length);
    renderBody();
    renderStats();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderExamResult(host) {
    var exam = view.exam;
    host.innerHTML = '';
    var total = exam.questions.length;
    var exact = total ? (exam.score * 100) / total : 0;
    var pct = Math.round(exact);
    var passed = exact >= PASS_PCT;

    var box = app.el('section', 'block exam-result ' + (passed ? 'pass' : 'fail'), '');
    box.appendChild(app.el('h2', '', passed ? '✔ Simulazione superata' : '✘ Sotto la soglia'));
    box.appendChild(app.el('p', 'exam-score', exam.score + ' / ' + total + ' · ' + pct + '%'));
    box.appendChild(app.el('p', 'muted small',
      'Soglia: ' + PASS_PCT + ' per cento. Il 720/1000 di AWS è un punteggio scalato, non una percentuale di ' +
      'risposte giuste: il ' + PASS_PCT + ' per cento è un margine prudente.'));

    /* Punteggio per dominio */
    var dl = app.el('ul', 'qdomscore', '');
    DOMAIN_ORDER.forEach(function (d) {
      var s = exam.byDomain[d];
      if (!s) return;
      var dpct = Math.round((s.ok * 100) / s.total);
      var li = app.el('li', dpct >= PASS_PCT ? 'qb-ok' : 'qb-ko', '');
      li.textContent = 'Dominio ' + d + ' · ' + DOMAIN_NAMES[d] + ': ' + s.ok + ' su ' + s.total +
        ' (' + dpct + '%)';
      dl.appendChild(li);
    });
    box.appendChild(dl);

    var again = app.el('button', 'btn primary', 'Nuova simulazione');
    again.type = 'button';
    again.addEventListener('click', function () {
      view.exam = null;
      renderBody();
    });
    box.appendChild(again);
    host.appendChild(box);

    /* Correzione: tutte le domande rivelate, con spiegazione. */
    var list = app.el('div', 'qlist', '');
    exam.questions.forEach(function (q, idx) {
      var given = exam.answers[q.id];
      var built = questionCard(q, idx + 1, {});
      reveal(q, built, given === undefined ? null : given, true);
      built.card.classList.add(qbank.isCorrect(q, given) ? 'answered-ok' : 'answered-ko');
      list.appendChild(built.card);
    });
    host.appendChild(list);
  }

  /* ---------- Orchestrazione ---------- */

  function applyFilters() {
    var res = qbank.filter(view.all, view.filters);
    view.visible = view.shuffled ? qbank.shuffle(res) : res;
  }

  function renderBody() {
    var host = nodes.body;
    if (view.mode === 'studio') { renderStudy(host); return; }
    if (!view.exam) { renderExamSetup(host); return; }
    if (view.exam.submitted) { renderExamResult(host); return; }
    renderExamRun(host);
  }

  function redraw() {
    applyFilters();
    renderToolbar(nodes.toolbar);
    renderStats();
    renderBody();
  }

  /* ---------- Init ---------- */

  function init(root) {
    app = window.MLA.app;
    qbank = window.MLA.qbank;

    root.innerHTML = '';
    nodes.toolbar = app.el('section', 'qb-toolbar', '');
    nodes.stats = app.el('section', 'qb-statsbox', '');
    nodes.body = app.el('section', 'qb-body', '');
    root.appendChild(nodes.toolbar);
    root.appendChild(nodes.stats);
    root.appendChild(nodes.body);

    nodes.body.appendChild(app.el('p', 'muted', 'Caricamento domande…'));

    /* Capitolo preselezionato via ?ch= (link dalle pagine capitolo). */
    var pre = app.getQueryParam('ch');
    if (pre && app.byId(pre)) view.filters.chapters = [pre];

    qbank.load().then(function (res) {
      view.all = res.questions;
      view.byChapter = res.byChapter;
      view.missing = res.missing;

      if (!view.all.length) {
        nodes.body.innerHTML = '';
        nodes.body.appendChild(app.el('p', 'notice',
          '📦 Banco domande non disponibile: i file content/questions/*.json non sono stati caricati.'));
        return;
      }
      if (res.missing.length) {
        var w = app.el('p', 'notice', '');
        w.textContent = '📦 Domande non ancora disponibili per: ' +
          res.missing.map(chapterLabel).join(', ') + '.';
        nodes.stats.parentNode.insertBefore(w, nodes.stats);
      }
      redraw();
    });
  }

  window.MLA = window.MLA || {};
  window.MLA.qbankUI = { init: init };
})();
