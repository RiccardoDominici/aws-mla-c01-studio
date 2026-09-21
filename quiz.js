/* quiz.js — quiz di fine capitolo.
 * Radio button, punteggio, spiegazioni, salvataggio best in tracker.
 * Espone MLA.quiz.render(container, chapter). */

(function () {
  'use strict';

  function render(container, chapter) {
    var app = window.MLA.app, tracker = window.MLA.tracker;
    container.innerHTML = '';

    var quiz = Array.isArray(chapter.quiz) ? chapter.quiz : [];
    if (!quiz.length) {
      container.appendChild(app.el('p', 'muted', 'Quiz in arrivo per questo capitolo.'));
      return;
    }

    var form = app.el('form', 'quiz', '');
    var fieldsets = [];

    quiz.forEach(function (item, qi) {
      var fs = app.el('fieldset', 'quiz-q', '');
      var legend = app.el('legend', '', '<strong>Q' + (qi + 1) + '.</strong> ' + app.esc(item.q));
      fs.appendChild(legend);

      var opts = Array.isArray(item.options) ? item.options : [];
      opts.forEach(function (opt, oi) {
        var label = app.el('label', 'quiz-opt', '');
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = 'q' + qi;
        input.value = String(oi);
        label.appendChild(input);
        label.appendChild(document.createTextNode(' ' + opt));
        fs.appendChild(label);
      });

      var fb = app.el('div', 'quiz-feedback', '');
      fb.hidden = true;
      fs.appendChild(fb);

      form.appendChild(fs);
      fieldsets.push({ item: item, fs: fs, fb: fb });
    });

    var actions = app.el('div', 'quiz-actions', '');
    var submit = app.el('button', 'btn primary', 'Verifica risposte');
    submit.type = 'submit';
    actions.appendChild(submit);

    var best = tracker.getQuizBest(chapter.id);
    var total = quiz.length;
    var result = app.el('p', 'quiz-result', best === null
      ? 'Non hai ancora svolto questo quiz.'
      : 'Miglior punteggio: ' + best + ' / ' + total + '.');
    actions.appendChild(result);
    form.appendChild(actions);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var score = 0;
      fieldsets.forEach(function (f, qi) {
        var checked = f.fs.querySelector('input[name="q' + qi + '"]:checked');
        var given = checked ? parseInt(checked.value, 10) : -1;
        var ok = given === f.item.answer;
        if (ok) score++;

        f.fb.hidden = false;
        f.fb.className = 'quiz-feedback ' + (ok ? 'ok' : 'ko');
        f.fb.innerHTML =
          (ok ? '✔ Esatta. ' : '✘ Sbagliata. Risposta corretta: <strong>' +
            app.esc((f.item.options || [])[f.item.answer]) + '</strong>. ') +
          (f.item.explain ? app.esc(f.item.explain) : '');
      });
      var rec = tracker.recordQuiz(chapter.id, score);
      result.textContent = 'Punteggio: ' + score + ' / ' + total +
        ' · Migliore: ' + rec.best + ' / ' + total +
        (rec.isNewBest ? ' (nuovo record!)' : '');
      console.info('[quiz] ' + chapter.id + ': punteggio ' + score + '/' + total);
      form.querySelectorAll('input[type="radio"]').forEach(function (i) { i.disabled = true; });
      submit.textContent = 'Riprova';
      submit.type = 'button';
      submit.onclick = function () { render(container, chapter); };
    });

    container.appendChild(form);
  }

  window.MLA = window.MLA || {};
  window.MLA.quiz = { render: render };
})();
