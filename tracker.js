/* tracker.js — progressi corso in localStorage (chiave mla-progress).
 * Shape: { <id>: { done: bool, quizBest: number|null, visited: bool } }
 * Stato nodo: "done" | "doing" | "todo".
 * Nessuna dipendenza: espone l'oggetto globale MLA.tracker. */

(function () {
  'use strict';

  var KEY = 'mla-progress';

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : {};
    } catch (err) {
      console.warn('[tracker] localStorage illeggibile, uso memoria vuota:', err);
      return {};
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[tracker] salvataggio progressi fallito:', err);
    }
  }

  function entry(id) {
    var data = load();
    return data[id] || { done: false, quizBest: null, visited: false };
  }

  function patch(id, fields) {
    var data = load();
    data[id] = Object.assign({ done: false, quizBest: null, visited: false }, data[id], fields);
    save(data);
    return data[id];
  }

  var tracker = {
    key: KEY,

    /** Stato di un capitolo: "done" | "doing" | "todo". */
    status: function (id) {
      var e = entry(id);
      if (e.done) return 'done';
      if (e.visited || e.quizBest !== null) return 'doing';
      return 'todo';
    },

    /** Segna il capitolo come visitato (chiamato aprendo chapter.html). */
    markVisited: function (id) {
      return patch(id, { visited: true });
    },

    /** Segna il capitolo come completato. */
    markDone: function (id) {
      return patch(id, { done: true, visited: true });
    },

    /** Rimuove il completamento (riapre il capitolo). */
    markUndone: function (id) {
      return patch(id, { done: false });
    },

    /** Registra un punteggio quiz (0..total); tiene il migliore. Ritorna {best, isNewBest}. */
    recordQuiz: function (id, score) {
      var e = entry(id);
      var prev = typeof e.quizBest === 'number' ? e.quizBest : null;
      var best = prev === null ? score : Math.max(prev, score);
      patch(id, { quizBest: best, visited: true });
      return { best: best, isNewBest: prev === null || score > prev };
    },

    getQuizBest: function (id) {
      return entry(id).quizBest;
    },

    isDone: function (id) {
      return !!entry(id).done;
    },

    /** Riepilogo avanzamento: { done, total, pct }. */
    progress: function (ids) {
      var done = ids.filter(function (id) { return entry(id).done; }).length;
      var total = ids.length;
      return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0 };
    },

    /** Azzera tutti i progressi (usato in debug / pagina home). */
    resetAll: function () {
      save({});
    }
  };

  window.MLA = window.MLA || {};
  window.MLA.tracker = tracker;
})();
