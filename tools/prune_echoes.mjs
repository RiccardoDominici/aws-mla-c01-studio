#!/usr/bin/env node
/* tools/prune_echoes.mjs — toglie dal JSON i bullet che ripetono uno schema.
 *
 *   node tools/prune_echoes.mjs --dry-run content/chapters/*.json
 *   node tools/prune_echoes.mjs content/chapters/ch5-monitor-security.json
 *
 * `visuals.js` già non mostra queste schede: restano nel JSON solo perché sono
 * state scritte prima degli schemi. Questo script allinea il dato alla vista,
 * usando la stessa funzione del renderer (`MLA.visuals.pruneEchoes`) e non una
 * copia della regola: se la soglia cambia, cambia per entrambi.
 *
 * Tocca solo `slides[].bullets`. La narrazione e `script` non si toccano:
 * l'audio è sintetizzato da quelli, e `tools/check_slides.py` lo verifica
 * confrontando con git.
 *
 * Le specifiche in `tools/slide_specs/` sono la fonte di verità degli schemi:
 * dopo aver potato il JSON va aggiornata anche la spec, altrimenti il prossimo
 * `apply_slides.py` rimette le schede.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const DRY = process.argv.includes('--dry-run');
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));

if (!files.length) {
  console.error('uso: node tools/prune_echoes.mjs [--dry-run] <capitolo.json>...');
  process.exit(2);
}

/* visuals.js è un IIFE che si aggancia a window: si esegue in un contesto finto
 * con un DOM minimo, solo per leggere MLA.visuals.pruneEchoes. */
const stubNode = () => ({
  className: '', textContent: '', style: {}, firstElementChild: null,
  classList: { add() {}, toggle() {}, contains: () => false },
  setAttribute() {}, appendChild() {}, addEventListener() {},
});
const sandbox = {
  window: { requestAnimationFrame() {}, addEventListener() {} },
  document: {
    createElement: stubNode,
    createElementNS: stubNode,
    createDocumentFragment: stubNode,
  },
  console,
};
sandbox.window.MLA = {};
vm.createContext(sandbox);
vm.runInContext(readFileSync(new URL('../visuals.js', import.meta.url), 'utf8'), sandbox);
const { pruneEchoes } = sandbox.window.MLA.visuals;

let totalRemoved = 0, totalBefore = 0, worst = [];

for (const file of files) {
  const chapter = JSON.parse(readFileSync(file, 'utf8'));
  let removed = 0, before = 0;
  (chapter.slides || []).forEach((slide, i) => {
    const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];
    before += bullets.length;
    const { kept, hidden } = pruneEchoes(bullets);
    if (!hidden.length) return;
    removed += hidden.length;
    if (hidden.length >= 3) worst.push(`${file.split('/').pop()} s${i}: ${hidden.length} schede ripetute`);
    slide.bullets = kept;
  });
  totalRemoved += removed;
  totalBefore += before;
  if (removed && !DRY) {
    writeFileSync(file, JSON.stringify(chapter, null, 2) + '\n');
  }
  if (removed) console.log(`${file}: ${removed} bullet tolti su ${before}`);
}

console.log(`\n${DRY ? '[dry run] ' : ''}tolti ${totalRemoved} bullet su ${totalBefore}`);
if (worst.length) {
  console.log('\nslide più ripetitive:');
  worst.slice(0, 12).forEach(w => console.log('  ' + w));
}
if (totalRemoved && DRY) console.log('\nrilancia senza --dry-run per applicare.');
