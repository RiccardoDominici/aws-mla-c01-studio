/* qbank.js — banco domande: caricamento, validazione (schema v2), filtri,
 * composizione delle simulazioni e stato utente.
 *
 * Responsabilità (solo modello/dati, nessun DOM):
 *  - carica content/questions/<chapterId>.json per ogni capitolo di MLA.app.CHAPTERS
 *    in parallelo: se un file manca il capitolo risulta senza domande, senza
 *    rompere la pagina;
 *  - valida e normalizza ogni domanda secondo lo schema v2: scelta singola
 *    (4 opzioni, answer intero) o risposta multipla (answer array di 2 o 3 indici,
 *    5 o 6 opzioni), più dominio, task ed esami a cui la domanda si applica.
 *    Le domande non valide vengono scartate con un warning in console;
 *  - filtra per capitolo / dominio / esame / tipo / difficoltà / stato / testo /
 *    origine (origine: 'ai' = generate per questo sito, 'esterna' = adattate da
 *    pratica trovata online; le domande senza campo origin contano come 'ai');
 *  - compone le simulazioni d'esame: pesca per dominio secondo i pesi della guida
 *    (metodo dei resti maggiori) e segnala i domini con troppe poche domande;
 *  - persiste le risposte in localStorage (chiave mla-domande), separata da
 *    mla-progress di tracker.js.
 *
 * Espone MLA.qbank. Il rendering sta in qbank-ui.js. */

(function () {
  'use strict';

  var STORAGE_KEY = 'mla-domande';
  var DIFFICULTIES = ['facile', 'media', 'difficile'];
  var DOMAINS = ['1', '2', '3', '4', 'META'];
  var TASKS = ['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '4.1', '4.2', '4.3'];
  var EXAMS = ['C01', 'C02'];
  var TYPES = ['singola', 'multipla'];

  /* Ritmo d'esame: 2,0 minuti a domanda, sia per MLA-C01 (65 in 130) sia per
   * MLA-C02 beta (85 in 170). */
  var MINUTES_PER_QUESTION = 2;

  /* Domande e pesi dei domini per esame, in percentuale (exam guide MLA-C01 v1.0
   * e MLA-C02). I pesi sommano a 100 in entrambi i casi. */
  var EXAM_SPECS = {
    C01: { id: 'C01', label: 'MLA-C01', questions: 65, weights: { '1': 28, '2': 26, '3': 22, '4': 24 } },
    C02: { id: 'C02', label: 'MLA-C02', questions: 85, weights: { '1': 28, '2': 24, '3': 24, '4': 24 } }
  };

  /* ---------- Caricamento ---------- */

  /** Percorso del file domande di un capitolo. */
  function fileFor(chapterId) {
    return 'content/questions/' + chapterId + '.json';
  }

  /** Id dei capitoli dal registro condiviso MLA.app (app.js). */
  function chapterIds() {
    var app = window.MLA && window.MLA.app;
    if (!app || !Array.isArray(app.CHAPTERS)) {
      console.warn('[qbank] MLA.app.CHAPTERS non disponibile: nessun capitolo caricato');
      return [];
    }
    return app.CHAPTERS.map(function (c) { return c.id; });
  }

  function isInt(x) {
    return typeof x === 'number' && isFinite(x) && Math.floor(x) === x;
  }

  function nonEmptyString(x) {
    return typeof x === 'string' && x.length > 0;
  }

  /** Vero se la domanda è a risposta multipla (answer è un array). */
  function isMulti(q) {
    return Array.isArray(q.answer);
  }

  /** Indici delle opzioni corrette, sempre come array. */
  function correctOf(q) {
    return isMulti(q) ? q.answer.slice() : [q.answer];
  }

  /** Vero se la risposta data (indice, array di indici o null) è quella giusta.
   * Multipla: tutto-o-niente, come all'esame. */
  function isCorrect(q, given) {
    if (given === null || given === undefined) return false;
    if (!isMulti(q)) return given === q.answer;
    if (!Array.isArray(given) || given.length !== q.answer.length) return false;
    var sorted = given.slice().sort(function (a, b) { return a - b; });
    return sorted.every(function (v, i) { return v === q.answer[i]; });
  }

  /** Coerenza tra answer e numero di opzioni (schema v2). */
  function validAnswer(o) {
    if (Array.isArray(o.answer)) {
      /* Risposta multipla: 2 o 3 indici distinti; opzioni = corrette + 3 distrattori. */
      var n = o.answer.length;
      if (n !== 2 && n !== 3) return false;
      if (o.options.length !== n + 3) return false;
      var seen = {};
      return o.answer.every(function (v) {
        var ok = isInt(v) && v >= 0 && v < o.options.length && !seen[v];
        seen[v] = true;
        return ok;
      });
    }
    /* Scelta singola: 4 opzioni e indice 0-3. */
    return o.options.length === 4 && isInt(o.answer) && o.answer >= 0 && o.answer <= 3;
  }

  /** Dominio, task ed esami devono esistere e combaciare tra loro. */
  function validClassification(o) {
    var domain = String(o.domain);
    if (DOMAINS.indexOf(domain) === -1) return false;
    var task = String(o.task);
    if (domain === 'META') {
      if (task !== '-') return false;
    } else if (TASKS.indexOf(task) === -1 || task.indexOf(domain + '.') !== 0) {
      return false;
    }
    return Array.isArray(o.exam) && o.exam.length > 0 &&
      o.exam.every(function (e) { return EXAMS.indexOf(e) !== -1; });
  }

  /** Vero se la domanda ha la forma minima attesa dallo schema v2. */
  function isValidQuestion(o) {
    return !!o
      && typeof o.q === 'string' && o.q.trim().length > 0
      && Array.isArray(o.options) && o.options.every(nonEmptyString)
      && validAnswer(o)
      && validClassification(o);
  }

  /** Riempie i campi opzionali con default sensati e forza i tipi. */
  function normalize(o, chapterId, index) {
    var diff = String(o.difficulty || 'media').toLowerCase();
    var origin = String(o.origin || 'ai').toLowerCase();
    var answer = isMulti(o)
      ? o.answer.slice().sort(function (a, b) { return a - b; })
      : o.answer | 0;
    return {
      id: typeof o.id === 'string' && o.id ? o.id : chapterId + '-q' + (index + 1),
      chapter: chapterId,
      q: String(o.q).trim(),
      options: o.options.map(function (x) { return String(x); }),
      answer: answer,
      explain: String(o.explain || ''),
      difficulty: DIFFICULTIES.indexOf(diff) !== -1 ? diff : 'media',
      tags: Array.isArray(o.tags) ? o.tags.map(function (t) { return String(t).toLowerCase(); }) : [],
      source: String(o.source || ''),
      origin: origin === 'esterna' ? 'esterna' : 'ai',
      domain: String(o.domain),
      task: String(o.task),
      exam: EXAMS.filter(function (e) { return o.exam.indexOf(e) !== -1; }),
      todo: Array.isArray(o.todo) ? o.todo.map(String) : []
    };
  }

  /**
   * Carica le domande di tutti i capitoli di MLA.app.CHAPTERS in parallelo.
   * @returns {Promise<{questions:Array, byChapter:Object, missing:string[]}>}
   */
  function load() {
    var ids = chapterIds();
    return Promise.all(ids.map(function (id) {
      return fetch(fileFor(id))
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (json) { return { id: id, data: json }; })
        .catch(function (err) {
          console.warn('[qbank] ' + fileFor(id) + ' non caricato:', err.message);
          return { id: id, data: null };
        });
    })).then(function (results) {
      var questions = [];
      var byChapter = {};
      var missing = [];
      var seen = {};

      results.forEach(function (r) {
        byChapter[r.id] = [];
        if (!Array.isArray(r.data)) { missing.push(r.id); return; }

        r.data.forEach(function (raw, i) {
          if (!isValidQuestion(raw)) {
            console.warn('[qbank] domanda non valida (schema v2) scartata in ' + r.id + ' #' + i, raw);
            return;
          }
          var q = normalize(raw, r.id, i);
          if (seen[q.id]) {            // id duplicato: lo rendo univoco, non lo perdo
            console.warn('[qbank] id duplicato ' + q.id + ', rinominato');
            q.id = q.id + '-' + i;
          }
          seen[q.id] = true;
          questions.push(q);
          byChapter[r.id].push(q);
        });
      });

      console.info('[qbank] caricate ' + questions.length + ' domande su ' +
        ids.length + ' capitoli' + (missing.length ? ' (mancanti: ' + missing.join(', ') + ')' : ''));
      return { questions: questions, byChapter: byChapter, missing: missing };
    });
  }

  /* ---------- Stato utente (localStorage) ---------- */

  /* Shape: { <questionId>: { given: indice | indici[] | null, ok: bool, starred: bool } } */
  function readAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : {};
    } catch (err) {
      console.warn('[qbank] localStorage illeggibile, stato vuoto:', err);
      return {};
    }
  }

  function writeAll(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[qbank] salvataggio stato domande fallito:', err);
    }
  }

  function entryOf(data, qid) {
    return data[qid] || { given: null, ok: null, starred: false };
  }

  var state = {
    key: STORAGE_KEY,

    /** Stato di una singola domanda. */
    get: function (qid) {
      return entryOf(readAll(), qid);
    },

    /** Registra la risposta data (indice o array per la multipla); ritorna la voce aggiornata. */
    record: function (qid, given, ok) {
      var data = readAll();
      data[qid] = Object.assign(entryOf(data, qid), { given: given, ok: !!ok });
      writeAll(data);
      return data[qid];
    },

    /** Segna/desegna una domanda da rivedere. Ritorna il nuovo valore. */
    toggleStar: function (qid) {
      var data = readAll();
      var e = entryOf(data, qid);
      e.starred = !e.starred;
      data[qid] = e;
      writeAll(data);
      return e.starred;
    },

    /** Dimentica la risposta a una domanda (la stellina resta). */
    clearAnswer: function (qid) {
      var data = readAll();
      var e = entryOf(data, qid);
      e.given = null;
      e.ok = null;
      data[qid] = e;
      writeAll(data);
    },

    /** Azzera tutte le risposte; le stelline restano se keepStars. */
    resetAnswers: function (keepStars) {
      var data = readAll();
      var next = {};
      if (keepStars) {
        Object.keys(data).forEach(function (qid) {
          if (data[qid] && data[qid].starred) next[qid] = { given: null, ok: null, starred: true };
        });
      }
      writeAll(next);
      console.info('[qbank] risposte azzerate' + (keepStars ? ' (stelline conservate)' : ''));
    },

    /** Statistiche su un insieme di domande: {total, answered, correct, wrong, starred, pct}. */
    stats: function (questions) {
      var data = readAll();
      var answered = 0, correct = 0, starred = 0;
      questions.forEach(function (q) {
        var e = entryOf(data, q.id);
        if (e.starred) starred++;
        if (e.given === null || e.given === undefined) return;
        answered++;
        if (e.ok) correct++;
      });
      return {
        total: questions.length,
        answered: answered,
        correct: correct,
        wrong: answered - correct,
        starred: starred,
        pct: answered ? Math.round((correct / answered) * 100) : 0
      };
    },

    /** Legge tutto lo stato in un colpo solo (per il rendering di liste lunghe). */
    snapshot: readAll
  };

  /* ---------- Filtri ---------- */

  /**
   * Filtra le domande.
   * @param {Array} questions
   * @param {{chapters:Array, domains:Array, exams:Array, types:Array, difficulties:Array,
   *          statuses:Array, text:string, origins:Array}} f
   *        chapters: array di id capitolo (vuoto = tutti)
   *        domains: sottoinsieme di ['1','2','3','4','META'] (vuoto = tutti)
   *        exams: sottoinsieme di ['C01','C02']: la domanda passa se si applica ad almeno uno
   *        types: sottoinsieme di ['singola','multipla'] (vuoto = tutti)
   *        difficulties: sottoinsieme di ['facile','media','difficile'] (vuoto = tutte)
   *        statuses: sottoinsieme di ['todo','wrong','correct','starred'] (vuoto = tutti;
   *          OR tra stati: la domanda passa se ALMENO uno matcha)
   *        text: ricerca libera su domanda, opzioni, tag e spiegazione
   *        origins: sottoinsieme di ['ai','esterna'] (vuoto = tutte)
   *        Per retrocompatibilità accetta anche il vecchio formato a stringa
   *        singola ({chapter, difficulty, status, origin} con 'all' = nessuna
   *        restrizione): viene convertito nel formato ad array.
   */
  function filter(questions, f) {
    var data = readAll();
    var needle = String(f.text || '').trim().toLowerCase();

    /* Singolo valore (o 'all'/assente) -> array; array già pronto passa com'è. */
    function toList(v) {
      if (Array.isArray(v)) return v;
      if (v === undefined || v === null || v === 'all') return [];
      return [v];
    }

    var chapters = toList(f.chapters !== undefined ? f.chapters : f.chapter);
    var difficulties = toList(f.difficulties !== undefined ? f.difficulties : f.difficulty);
    var statuses = toList(f.statuses !== undefined ? f.statuses : f.status);
    var origins = toList(f.origins !== undefined ? f.origins : f.origin);
    var domains = toList(f.domains);
    var exams = toList(f.exams);
    var types = toList(f.types);

    /* Vero se lo stato persistente della domanda matcha almeno uno stato selezionato. */
    function statusMatch(e, answered) {
      for (var i = 0; i < statuses.length; i++) {
        var s = statuses[i];
        if (s === 'todo' && !answered) return true;
        if (s === 'wrong' && answered && !e.ok) return true;
        if (s === 'correct' && answered && e.ok) return true;
        if (s === 'starred' && e.starred) return true;
      }
      return false;
    }

    return questions.filter(function (q) {
      if (chapters.length && chapters.indexOf(q.chapter) === -1) return false;
      if (domains.length && domains.indexOf(q.domain) === -1) return false;
      if (exams.length && !q.exam.some(function (e) { return exams.indexOf(e) !== -1; })) return false;
      if (types.length && types.indexOf(isMulti(q) ? 'multipla' : 'singola') === -1) return false;
      if (difficulties.length && difficulties.indexOf(q.difficulty) === -1) return false;
      if (origins.length && origins.indexOf(q.origin || 'ai') === -1) return false;

      if (statuses.length) {
        var e = entryOf(data, q.id);
        var answered = e.given !== null && e.given !== undefined;
        if (!statusMatch(e, answered)) return false;
      }

      if (needle) {
        var hay = (q.q + ' ' + q.options.join(' ') + ' ' + q.tags.join(' ') + ' ' + q.explain).toLowerCase();
        if (hay.indexOf(needle) === -1) return false;
      }
      return true;
    });
  }

  /* ---------- Utilità ---------- */

  /** Fisher-Yates su una copia dell'array. */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** n elementi casuali (o tutti se ce ne sono meno). */
  function sample(arr, n) {
    return shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length)));
  }

  /** Solo le domande di formato e tattiche (META) sono escluse dalle simulazioni. */
  function withoutMeta(questions) {
    return questions.filter(function (q) { return q.domain !== 'META'; });
  }

  /** Conteggio delle domande tecniche per dominio: {'1': n, '2': n, '3': n, '4': n}. */
  function countByDomain(questions) {
    var counts = { '1': 0, '2': 0, '3': 0, '4': 0 };
    questions.forEach(function (q) {
      if (counts[q.domain] !== undefined) counts[q.domain]++;
    });
    return counts;
  }

  /** Domande candidate a una simulazione d'esame: quell'esame, META escluse. */
  function examPool(questions, examId) {
    return withoutMeta(questions).filter(function (q) { return q.exam.indexOf(examId) !== -1; });
  }

  /**
   * Ripartisce `total` domande tra i domini secondo i pesi, col metodo dei resti
   * maggiori. Se un dominio non ha abbastanza domande (`available`), il deficit va
   * agli altri domini, prima quelli a peso maggiore.
   * @returns {{quotas:Object, shortfalls:Array<{domain,wanted,have}>, size:number}}
   */
  function allocate(total, weights, available) {
    var keys = Object.keys(weights);
    var sumW = keys.reduce(function (s, k) { return s + weights[k]; }, 0);
    var raw = keys.map(function (k) { return total * weights[k] / sumW; });
    var base = raw.map(Math.floor);
    var left = total - base.reduce(function (s, n) { return s + n; }, 0);

    /* I resti più grandi ricevono la domanda in più; a parità vince l'ordine dei domini. */
    var order = keys.map(function (k, i) { return i; }).sort(function (a, b) {
      return (raw[b] - base[b]) - (raw[a] - base[a]) || a - b;
    });
    for (var j = 0; j < left; j++) base[order[j % order.length]]++;

    var quotas = {};
    var shortfalls = [];
    var deficit = 0;
    keys.forEach(function (k, i) {
      var have = available[k] || 0;
      quotas[k] = Math.min(base[i], have);
      if (base[i] > have) {
        deficit += base[i] - have;
        shortfalls.push({ domain: k, wanted: base[i], have: have });
      }
    });

    /* Compenso con i domini che hanno ancora domande, a peso maggiore per primi. */
    while (deficit > 0) {
      var cand = keys.filter(function (k) { return quotas[k] < (available[k] || 0); });
      if (!cand.length) break;
      cand.sort(function (a, b) { return weights[b] - weights[a] || (a < b ? -1 : 1); });
      quotas[cand[0]]++;
      deficit--;
    }

    var size = keys.reduce(function (s, k) { return s + quotas[k]; }, 0);
    if (shortfalls.length) {
      console.info('[qbank] pesca per dominio con deficit:', JSON.stringify(shortfalls));
    }
    return { quotas: quotas, shortfalls: shortfalls, size: size };
  }

  /**
   * Piano di una simulazione d'esame completa (65 o 85 domande, pesca per dominio).
   * Pesca dal banco intero, ignorando i filtri attivi: serve solo a sapere quante
   * domande finiscono in ogni dominio e quali domini sono a corto.
   * @returns {{exam:string, label:string, target:number, size:number, minutes:number,
   *            poolSize:number, quotas:Object, shortfalls:Array, reduced:boolean}}
   */
  function planExam(questions, examId) {
    var spec = EXAM_SPECS[examId];
    if (!spec) throw new Error('esame sconosciuto: ' + examId);
    var pool = examPool(questions, examId);
    var total = Math.min(spec.questions, pool.length);
    var alloc = allocate(total, spec.weights, countByDomain(pool));
    return {
      exam: examId,
      label: spec.label,
      target: spec.questions,
      size: alloc.size,
      minutes: alloc.size * MINUTES_PER_QUESTION,
      poolSize: pool.length,
      quotas: alloc.quotas,
      shortfalls: alloc.shortfalls,
      reduced: alloc.size < spec.questions
    };
  }

  /** Estrae le domande di un piano dal banco, nelle quote per dominio, in ordine casuale. */
  function drawExam(questions, plan) {
    var pool = examPool(questions, plan.exam);
    var picked = [];
    Object.keys(plan.quotas).forEach(function (domain) {
      var bucket = pool.filter(function (q) { return q.domain === domain; });
      picked = picked.concat(sample(bucket, plan.quotas[domain]));
    });
    return shuffle(picked);
  }

  window.MLA = window.MLA || {};
  window.MLA.qbank = {
    DIFFICULTIES: DIFFICULTIES,
    DOMAINS: DOMAINS,
    TASKS: TASKS,
    EXAMS: EXAMS,
    TYPES: TYPES,
    EXAM_SPECS: EXAM_SPECS,
    MINUTES_PER_QUESTION: MINUTES_PER_QUESTION,
    load: load,
    filter: filter,
    isMulti: isMulti,
    correctOf: correctOf,
    isCorrect: isCorrect,
    shuffle: shuffle,
    sample: sample,
    withoutMeta: withoutMeta,
    countByDomain: countByDomain,
    examPool: examPool,
    allocate: allocate,
    planExam: planExam,
    drawExam: drawExam,
    state: state
  };
})();
