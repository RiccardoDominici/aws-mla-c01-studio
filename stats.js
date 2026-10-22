/* stats.js — numeri del sito calcolati al caricamento della home.
 * - domande: somma delle voci in content/questions/<id>.json per i capitoli del registro
 *   (un file mancante vale zero: il capitolo è "in arrivo");
 * - minuti di audio: somma delle `duration` in content/timing.json (solo capitoli con mp3);
 * - capitoli con audio: su tutte le schede (registro + quick-ref).
 * Se nessun file delle domande si carica o manca timing.json, la voce mostra un testo neutro.
 * Espone MLA.stats.load() → Promise<{questions, minutes, audioChapters, totalChapters}>
 * oppure valori null dove il dato non è disponibile. */

(function () {
  'use strict';

  var QUESTIONS_DIR = 'content/questions/';
  var TIMING_FILE = 'content/timing.json';

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  /** Numero di domande per capitolo; null se il file non si può leggere. */
  function countQuestions(id) {
    return fetchJson(QUESTIONS_DIR + id + '.json')
      .then(function (arr) { return Array.isArray(arr) ? arr.length : 0; })
      .catch(function () { return null; });
  }

  function load() {
    var app = window.MLA.app;
    var ids = app.CHAPTERS.map(function (c) { return c.id; });
    var allScheda = ids.concat(['quick-ref']);

    var questionsP = Promise.all(ids.map(countQuestions));
    var timingP = fetchJson(TIMING_FILE).catch(function (err) {
      console.warn('[stats] ' + TIMING_FILE + ' non caricato:', err.message);
      return null;
    });

    return Promise.all([questionsP, timingP]).then(function (res) {
      var counts = res[0];
      var timing = res[1];
      var loaded = counts.filter(function (c) { return c !== null; });

      var questions = loaded.length
        ? loaded.reduce(function (a, b) { return a + b; }, 0)
        : null;

      var chapters = timing && timing.chapters ? timing.chapters : null;
      var minutes = null;
      var audioChapters = null;
      if (chapters) {
        var sec = 0;
        audioChapters = 0;
        allScheda.forEach(function (id) {
          var entry = chapters[id];
          if (entry && isFinite(+entry.duration)) {
            sec += +entry.duration;
            audioChapters++;
          }
        });
        minutes = Math.round(sec / 60);
      }

      var out = {
        questions: questions,
        minutes: minutes,
        audioChapters: audioChapters,
        totalChapters: allScheda.length
      };
      console.info('[stats] domande=' + out.questions + ' minuti=' + out.minutes +
        ' audio=' + out.audioChapters + '/' + out.totalChapters);
      return out;
    });
  }

  window.MLA = window.MLA || {};
  window.MLA.stats = { load: load };
})();
