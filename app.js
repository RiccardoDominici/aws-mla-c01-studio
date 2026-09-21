/* app.js — utilità condivise + caricamento contenuti.
 * Unisce content/chapters-1.json e content/chapters-2.json con fetch.
 * Funziona anche se uno dei due manca: i capitoli assenti risultano
 * "contenuti in arrivo". Espone l'oggetto globale MLA.app. */

(function () {
  'use strict';

  var FILES = ['content/chapters-1.json', 'content/chapters-2.json'];

  /* Metadati statici: fallback quando i JSON non sono (ancora) disponibili
   * e sorgente di verità per ordine, aree e label dei 7 capitoli. */
  var CHAPTERS = [
    { id: 'ch1-exam-guide',      n: 1, area: 'fondamenti',   short: 'Guida esame',   title: "Guida all'esame MLA-C01" },
    { id: 'ch2-data-prep',       n: 2, area: 'fondamenti',   short: 'Data Prep',     title: 'Data Preparation for ML' },
    { id: 'ch3-model-dev',       n: 3, area: 'mlops',        short: 'Modelli ML',    title: 'Sviluppo modelli ML' },
    { id: 'ch4-deploy',          n: 4, area: 'mlops',        short: 'Deploy',        title: 'Deployment e orchestrazione' },
    { id: 'ch5-monitor-security',n: 5, area: 'mlops',        short: 'Monitor',       title: 'Monitoraggio e sicurezza' },
    { id: 'ch6-genai',           n: 6, area: 'applicazioni', short: 'GenAI',         title: 'GenAI su AWS: Bedrock e RAG' },
    { id: 'ch7-practice',        n: 7, area: 'applicazioni', short: 'Casi pratici',  title: "Strategia d'esame e casi pratici" }
  ];

  var AREAS = {
    fondamenti:   { label: 'Fondamenti',    ids: ['ch1-exam-guide', 'ch2-data-prep'] },
    mlops:        { label: 'Pratica MLOps', ids: ['ch3-model-dev', 'ch4-deploy', 'ch5-monitor-security'] },
    applicazioni: { label: 'Applicazioni',  ids: ['ch6-genai', 'ch7-practice'] }
  };

  function isValidChapter(obj) {
    return obj && typeof obj.id === 'string' && typeof obj.title === 'string';
  }

  /** Carica e unisce i due JSON. Ritorna { chapters: Map id->oggetto, missing: [file...] }. */
  function loadContent() {
    return Promise.all(FILES.map(function (f) {
      return fetch(f)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (json) { return { file: f, data: json }; })
        .catch(function (err) {
          console.warn('[app] ' + f + ' non caricato:', err.message);
          return { file: f, data: null };
        });
    })).then(function (results) {
      var map = {};
      var missing = [];
      results.forEach(function (r) {
        if (!Array.isArray(r.data)) { missing.push(r.file); return; }
        r.data.forEach(function (ch) {
          if (isValidChapter(ch)) map[ch.id] = ch;
          else console.warn('[app] voce capitolo non valida in ' + r.file + ':', ch);
        });
      });
      return { chapters: map, missing: missing };
    });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  window.MLA = window.MLA || {};
  window.MLA.app = {
    CHAPTERS: CHAPTERS,
    AREAS: AREAS,
    loadContent: loadContent,
    esc: esc,
    el: el,
    getQueryParam: getQueryParam,
    byId: function (id) {
      return CHAPTERS.filter(function (c) { return c.id === id; })[0] || null;
    }
  };
})();
