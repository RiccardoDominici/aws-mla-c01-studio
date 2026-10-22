/* app.js — utilità condivise + caricamento contenuti.
 * Carica content/chapters/<id>.json per ogni capitolo del registro CHAPTERS
 * (14 capitoli, 3 aree) più la scheda extra "quick-ref" (ripasso, non in mappa).
 * Un file mancante non rompe nulla: quel capitolo risulta "in arrivo".
 * Espone l'oggetto globale MLA.app. */

(function () {
  'use strict';

  var CONTENT_DIR = 'content/chapters/';
  var EXTRA_IDS = ['quick-ref'];

  /* Registro dei capitoli: fonte di verità per ordine, aree, prerequisiti
   * e label. "short" è l'etichetta breve usata in mappa e nei filtri.
   * Gli id e i prerequisiti devono coincidere con docs/todo.json e con i
   * file content/chapters/<id>.json. */
  var CHAPTERS = [
    { id: 'ch1-exam-guide',       n: 1,  area: 'fondamenti',   short: 'Guida esame',  title: "Guida all'esame MLA-C01",
      prereq: [] },
    { id: 'ch2-data-prep',        n: 2,  area: 'fondamenti',   short: 'Data Prep',    title: 'Data Preparation for ML',
      prereq: ['ch1-exam-guide'] },
    { id: 'ch3-model-dev',        n: 3,  area: 'mlops',        short: 'Modelli ML',   title: 'Sviluppo modelli ML',
      prereq: ['ch2-data-prep'] },
    { id: 'ch4-deploy',           n: 4,  area: 'mlops',        short: 'Deploy',       title: 'Deployment e orchestrazione',
      prereq: ['ch3-model-dev'] },
    { id: 'ch5-monitor-security', n: 5,  area: 'mlops',        short: 'Monitor',      title: 'Monitoraggio e sicurezza',
      prereq: ['ch4-deploy'] },
    { id: 'ch6-genai',            n: 6,  area: 'applicazioni', short: 'GenAI',        title: 'GenAI su AWS: Bedrock e RAG',
      prereq: ['ch2-data-prep'] },
    { id: 'ch7-practice',         n: 7,  area: 'applicazioni', short: 'Casi pratici', title: "Strategia d'esame e casi pratici",
      prereq: ['ch1-exam-guide', 'ch2-data-prep'] },
    { id: 'ch8-data-advanced',    n: 8,  area: 'fondamenti',   short: 'Dati avanzati', title: 'Dati in profondità: storage, qualità, etichette e bias',
      prereq: ['ch2-data-prep'] },
    { id: 'ch9-training-advanced', n: 9, area: 'mlops',        short: 'Training avanzato', title: 'Training avanzato, algoritmi built-in e spiegabilità',
      prereq: ['ch3-model-dev'] },
    { id: 'ch10-infra-cicd',      n: 10, area: 'mlops',        short: 'Infra e CI/CD', title: 'Infrastruttura come codice, container e CI/CD',
      prereq: ['ch4-deploy'] },
    { id: 'ch11-cost-security',   n: 11, area: 'mlops',        short: 'Costi e sicurezza', title: 'Costi, osservabilità e sicurezza avanzata',
      prereq: ['ch5-monitor-security'] },
    { id: 'ch12-genai-rag',       n: 12, area: 'applicazioni', short: 'RAG',          title: 'GenAI: modelli di fondazione, embedding e RAG avanzato',
      prereq: ['ch6-genai'] },
    { id: 'ch13-genai-agents',    n: 13, area: 'applicazioni', short: 'Agenti',       title: 'GenAI in produzione: valutazione, agenti e costi',
      prereq: ['ch12-genai-rag'] },
    { id: 'ch14-ai-services',     n: 14, area: 'applicazioni', short: 'Servizi AI',   title: 'Servizi AI pronti e catalogo dei servizi d\'esame',
      prereq: ['ch6-genai'] }
  ];

  var AREAS = {
    fondamenti:   { label: 'Fondamenti',   ids: ['ch1-exam-guide', 'ch2-data-prep', 'ch8-data-advanced'] },
    mlops:        { label: 'Pratica MLOps', ids: ['ch3-model-dev', 'ch4-deploy', 'ch5-monitor-security',
                                                  'ch9-training-advanced', 'ch10-infra-cicd', 'ch11-cost-security'] },
    applicazioni: { label: 'Applicazioni', ids: ['ch6-genai', 'ch7-practice', 'ch12-genai-rag',
                                                  'ch13-genai-agents', 'ch14-ai-services'] }
  };

  function fileFor(id) {
    return CONTENT_DIR + id + '.json';
  }

  function isValidChapter(obj, id) {
    return obj && typeof obj === 'object' && obj.id === id && typeof obj.title === 'string';
  }

  /** Carica un capitolo. Ritorna { id, data } con data = null se non disponibile. */
  function loadOne(id) {
    return fetch(fileFor(id))
      .then(function (res) {
        if (!res.ok) {
          var err = new Error('HTTP ' + res.status);
          err.status = res.status;
          throw err;
        }
        return res.json();
      })
      .then(function (json) {
        if (!isValidChapter(json, id)) {
          console.warn('[app] ' + fileFor(id) + ': oggetto capitolo non valido (id o title mancanti)');
          return { id: id, data: null };
        }
        return { id: id, data: json };
      })
      .catch(function (err) {
        // 404 = capitolo ancora senza contenuti: non è un errore di codice.
        if (err.status === 404) console.info('[app] ' + id + ' in arrivo (nessun file)');
        else console.warn('[app] ' + fileFor(id) + ' non caricato:', err.message);
        return { id: id, data: null };
      });
  }

  /** Carica tutti i capitoli del registro più le schede extra in parallelo.
   * Ritorna { chapters: Map id->oggetto, missing: [id...] }. */
  function loadContent() {
    var ids = CHAPTERS.map(function (c) { return c.id; }).concat(EXTRA_IDS);
    return Promise.all(ids.map(loadOne)).then(function (results) {
      var map = {};
      var missing = [];
      results.forEach(function (r) {
        if (r.data) map[r.id] = r.data;
        else missing.push(r.id);
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
