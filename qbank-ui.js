/* qbank-ui.js — rendering della pagina "Banco domande" (domande.html).
 *
 * Due modalità:
 *  - Studio: elenco filtrabile, feedback immediato al click sull'opzione,
 *    spiegazione sempre visibile dopo la risposta, stellina "da rivedere".
 *  - Simulazione: N domande pescate dal set filtrato, timer, nessun feedback
 *    finché non si consegna, poi punteggio e correzione completa.
 *
 * I filtri (capitolo / difficoltà / stato / origine / testo) sono a
 * multi-selezione per riga: OR dentro la riga, AND tra righe diverse.
 * La logica di dati e persistenza sta in qbank.js (MLA.qbank).
 * Il capitolo selezionato è sincronizzato con il query param ?ch=
 * (solo con un capitolo singolo) così le pagine capitolo possono
 * linkare direttamente il proprio sottoinsieme di domande.
 *
 * Espone MLA.qbankUI.init(rootElement). */

(function () {
  'use strict';

  var EXAM_SIZES = [10, 25, 50];
  var EXAM_MINUTES_PER_Q = 2.6;   // ritmo reale MLA-C01: 65 domande in 170 minuti
  var PASS_PCT = 70;              // soglia indicativa di superamento (ufficiale: 720/1000)
  var PAGE_STEP = 15;             // quante domande in più per click su "Mostra altre"

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

  /* Stato della vista, non persistito (tranne il capitolo singolo, che sta nell'URL). */
  var view = {
    mode: 'studio',
    filters: { chapters: [], difficulties: [], statuses: [], text: '', origins: [] },
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

  /** Etichetta breve di un capitolo: "Cap 3 · Training". */
  function chapterLabel(chapterId) {
    var meta = app.byId(chapterId);
    return meta ? 'Cap ' + meta.n + ' · ' + meta.short : chapterId;
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
   * OR dentro la riga, AND tra righe (logica in qbank.filter).
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

    /* Filtro capitolo: il filtro principale richiesto (multi-selezione) */
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

    /* Filtro difficoltà (multi-selezione) */
    filterRow(host, 'difficulties', 'Difficoltà', 'Filtra per difficoltà', 'Tutte', DIFF_FILTERS);

    /* Filtro stato di avanzamento (multi-selezione, OR tra stati) */
    filterRow(host, 'statuses', 'Stato', 'Filtra per stato', 'Tutte', STATUS_FILTERS);

    /* Filtro origine: generate dal sito vs adattate da pratica online (multi-selezione) */
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

  /* ---------- Card domanda ---------- */

  /**
   * Costruisce la card di una domanda.
   * @param {Object} q domanda normalizzata
   * @param {number} num numero progressivo mostrato
   * @param {Object} opts { reveal:bool, interactive:bool, onAnswer:fn, chosen:number|null }
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
    var list = app.el('div', 'qopts', '');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', 'Opzioni di risposta');
    var letters = ['A', 'B', 'C', 'D'];
    var buttons = [];

    q.options.forEach(function (text, i) {
      var b = app.el('button', 'qopt', '');
      b.type = 'button';
      var k = app.el('span', 'qopt-k', letters[i]);
      b.appendChild(k);
      var t = app.el('span', 'qopt-t', '');
      t.textContent = text;
      b.appendChild(t);
      b.addEventListener('click', function () {
        if (opts.onAnswer) opts.onAnswer(i, buttons, card);
      });
      buttons.push(b);
      list.appendChild(b);
    });
    card.appendChild(list);

    var fbHost = app.el('div', 'qfb-host', '');
    card.appendChild(fbHost);

    return { card: card, buttons: buttons, fbHost: fbHost };
  }

  /** Applica lo stile "risposta rivelata" a una card. */
  function reveal(q, buttons, fbHost, chosen, showExplain) {
    buttons.forEach(function (b, i) {
      b.disabled = true;
      b.classList.remove('chosen');
      if (i === q.answer) b.classList.add('ok');
      if (chosen !== null && chosen !== undefined && i === chosen && i !== q.answer) b.classList.add('ko');
    });
    if (!showExplain) return;

    fbHost.innerHTML = '';
    var ok = chosen === q.answer;
    var box = app.el('div', 'qfb ' + (ok ? 'ok' : 'ko'), '');
    var title = app.el('p', 'qfb-title', '');
    if (chosen === null || chosen === undefined) {
      title.textContent = '— Senza risposta. Corretta: ' + ['A', 'B', 'C', 'D'][q.answer] + '.';
    } else {
      title.textContent = ok
        ? '✔ Risposta corretta.'
        : '✘ Sbagliata. La corretta è ' + ['A', 'B', 'C', 'D'][q.answer] + ': ' + q.options[q.answer];
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
    fbHost.appendChild(box);
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
        onAnswer: function (chosen, buttons, card) {
          var ok = chosen === q.answer;
          qbank.state.record(q.id, chosen, ok);
          reveal(q, buttons, built.fbHost, chosen, true);
          card.classList.add(ok ? 'answered-ok' : 'answered-ko');
          addRetry(q, built, card);
          renderStats();
        }
      });

      /* Se era già stata risposta, la card parte già rivelata. */
      if (saved.given !== null && saved.given !== undefined) {
        reveal(q, built.buttons, built.fbHost, saved.given, true);
        built.card.classList.add(saved.ok ? 'answered-ok' : 'answered-ko');
        addRetry(q, built, built.card);
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

  /** Aggiunge il link "riprova" a una card già risposta. */
  function addRetry(q, built, card) {
    if (card.querySelector('.qretry')) return;
    var retry = app.el('button', 'btn ghost small qretry', '↺ Riprova questa');
    retry.type = 'button';
    retry.addEventListener('click', function () {
      qbank.state.clearAnswer(q.id);
      built.fbHost.innerHTML = '';
      card.classList.remove('answered-ok', 'answered-ko');
      built.buttons.forEach(function (b) {
        b.disabled = false;
        b.classList.remove('ok', 'ko', 'chosen');
      });
      retry.remove();
      renderStats();
    });
    built.fbHost.appendChild(retry);
  }

  /* ---------- Modalità simulazione d'esame ---------- */

  function renderExamSetup(host) {
    host.innerHTML = '';
    var box = app.el('section', 'block exam-setup', '');
    box.appendChild(app.el('h2', '', 'Simulazione d’esame'));
    box.appendChild(app.el('p', '',
      'Domande pescate a caso dal set filtrato (' + view.visible.length + ' disponibili), ' +
      'timer di ' + EXAM_MINUTES_PER_Q.toString().replace('.', ',') + ' minuti a domanda come all’esame vero. ' +
      'Nessun feedback finché non consegni.'));

    if (view.visible.length < 5) {
      box.appendChild(app.el('p', 'notice', 'Servono almeno 5 domande nel filtro per avviare una simulazione.'));
      host.appendChild(box);
      return;
    }

    var row = app.el('div', 'qb-row', '');
    row.appendChild(app.el('span', 'qb-label', 'Domande'));
    var group = app.el('div', 'chip-group', '');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Numero di domande');
    EXAM_SIZES.concat([view.visible.length]).filter(function (n, i, arr) {
      return n <= view.visible.length && arr.indexOf(n) === i;
    }).forEach(function (n) {
      var b = app.el('button', 'btn', n === view.visible.length && EXAM_SIZES.indexOf(n) === -1
        ? 'Tutte (' + n + ')' : String(n));
      b.type = 'button';
      b.addEventListener('click', function () { startExam(n); });
      group.appendChild(b);
    });
    row.appendChild(group);
    box.appendChild(row);
    host.appendChild(box);
  }

  function startExam(n) {
    view.exam = {
      questions: qbank.sample(view.visible, n),
      answers: {},
      submitted: false,
      endsAt: Date.now() + Math.round(n * EXAM_MINUTES_PER_Q * 60 * 1000),
      timer: null
    };
    console.info('[qbank-ui] simulazione avviata: ' + n + ' domande');
    renderBody();
  }

  function renderExamRun(host) {
    var exam = view.exam;
    host.innerHTML = '';

    var bar = app.el('div', 'exam-bar', '');
    var counter = app.el('span', 'exam-count', '');
    var clock = app.el('span', 'exam-clock', '');
    clock.setAttribute('role', 'timer');
    clock.setAttribute('aria-live', 'off');
    var submit = app.el('button', 'btn primary', 'Consegna');
    submit.type = 'button';
    submit.addEventListener('click', function () { submitExam(); });
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
        onAnswer: function (chosen, buttons) {
          exam.answers[q.id] = chosen;
          buttons.forEach(function (b, i) { b.classList.toggle('chosen', i === chosen); });
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

  function submitExam() {
    var exam = view.exam;
    if (!exam || exam.submitted) return;
    exam.submitted = true;
    clearInterval(exam.timer);

    /* Le risposte dell'esame confluiscono nello stato persistente:
     * così i filtri "sbagliate" e le statistiche restano coerenti. */
    exam.score = 0;
    exam.questions.forEach(function (q) {
      var given = exam.answers[q.id];
      if (given === undefined) return;
      var ok = given === q.answer;
      if (ok) exam.score++;
      qbank.state.record(q.id, given, ok);
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
    var pct = total ? Math.round((exam.score / total) * 100) : 0;
    var passed = pct >= PASS_PCT;

    var box = app.el('section', 'block exam-result ' + (passed ? 'pass' : 'fail'), '');
    box.appendChild(app.el('h2', '', passed ? '✔ Simulazione superata' : '✘ Sotto la soglia'));
    box.appendChild(app.el('p', 'exam-score', exam.score + ' / ' + total + ' · ' + pct + '%'));
    box.appendChild(app.el('p', 'muted', 'Soglia indicativa di superamento: ' + PASS_PCT +
      '%. Soglia ufficiale AWS: 720/1000.'));

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
      reveal(q, built.buttons, built.fbHost, given === undefined ? null : given, true);
      built.card.classList.add(given === q.answer ? 'answered-ok' : 'answered-ko');
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

    var ids = app.CHAPTERS.map(function (c) { return c.id; });
    qbank.load(ids).then(function (res) {
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
