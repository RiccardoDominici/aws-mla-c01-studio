#!/usr/bin/env node
/* check_traps.mjs — verifica la sezione "Flashcards".
 *
 * Carica i capitoli reali, esegue l'estrazione di trappole.js (lo stesso codice
 * che gira nel browser) e controlla che ogni elemento sia coerente:
 * tipo noto, slide esistente, testo non vuoto, link alla slide valido.
 * Stampa un riepilogo per capitolo e fallisce se l'estrazione si rompe o se
 * spariscono le trappole più note (una regressione silenziosa del lessico).
 *
 * Uso: node tools/check_traps.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');

/* app.js e trappole.js si aspettano `window`: basta un oggetto vuoto, perché
 * qui non si tocca il DOM. */
global.window = {};
require(join(repo, 'app.js'));
const traps = require(join(repo, 'trappole.js'));

const app = global.window.MLA.app;
const read = (id) => JSON.parse(readFileSync(join(repo, 'content/chapters', id + '.json'), 'utf8'));

const list = app.CHAPTERS.map((meta) => ({
  id: meta.id,
  title: meta.title,
  n: meta.n,
  area: meta.area,
  areaLabel: app.AREAS[meta.area].label,
  data: read(meta.id)
}));
list.push({
  id: 'quick-ref',
  title: 'Scheda di ripasso last-minute',
  n: '★',
  area: 'applicazioni',
  areaLabel: 'Ripasso',
  data: read('quick-ref')
});

const model = traps.extract(list);
const errors = [];

if (!model.counts.total) errors.push('nessun elemento estratto');
if (model.counts.total !== model.counts.trap + model.counts.rule +
    model.counts.numbers + model.counts.system) {
  errors.push('counts.total non coincide con la somma dei tipi');
}

const byId = new Map(list.map((c) => [c.id, c]));

/* Il capitolo 1 è metodo di studio, non contenuto: deve restare fuori. */
for (const id of Object.keys(traps.SKIP_CHAPTERS)) {
  if (model.chapters.some((c) => c.id === id)) {
    errors.push(`capitolo escluso ancora presente: ${id}`);
  }
}

/* Etichette dei filtri: plurali italiani veri, non "+s" (che sembra spagnolo). */
for (const t of traps.TYPES) {
  const label = traps.TYPE_LABEL_PLURAL[t];
  if (!label) errors.push(`plurale mancante per il tipo ${t}`);
  else if (label.endsWith('s')) errors.push(`plurale sospetto per ${t}: "${label}"`);
}
for (const chapter of model.chapters) {
  const src = byId.get(chapter.id);
  if (!src) { errors.push(`capitolo sconosciuto: ${chapter.id}`); continue; }
  const nSlides = src.data.slides.length;
  for (const item of chapter.items) {
    const where = `${chapter.id} slide ${item.slide}`;
    if (!traps.TYPES.includes(item.type)) errors.push(`${where}: tipo sconosciuto "${item.type}"`);
    if (!(item.slide >= 1 && item.slide <= nSlides)) errors.push(`${where}: slide fuori range (1..${nSlides})`);
    if (!item.title) errors.push(`${where}: titolo vuoto`);
    if (item.type === 'trap' || item.type === 'rule') {
      if (!item.text) errors.push(`${where}: testo vuoto`);
    }
    if (item.type === 'numbers' && !(item.rows || []).length) errors.push(`${where}: numeri vuoti`);
    if (item.type === 'system' && !(item.steps || []).length && !(item.tables || []).length) {
      errors.push(`${where}: metodo senza passi né tabelle`);
    }
  }
}

/* Le trappole scritte a mano nei contenuti devono restare riconosciute. */
const mustFind = [
  ['ch2-data-prep', 'La trappola più frequente'],
  ['ch5-monitor-security', 'Tranello d\'esame'],
  ['ch13-genai-agents', 'Trappola KEDA'],
  ['ch6-genai', 'Tranello']
];
for (const [id, title] of mustFind) {
  const chapter = model.chapters.find((c) => c.id === id);
  const found = chapter && chapter.items.some((it) => it.type === 'trap' && it.title === title);
  if (!found) errors.push(`trappola attesa non trovata: ${id} / ${title}`);
}

for (const chapter of model.chapters) {
  const c = { trap: 0, rule: 0, numbers: 0, system: 0 };
  for (const item of chapter.items) c[item.type] += 1;
  console.log(
    `${chapter.id.padEnd(22)} ${String(chapter.items.length).padStart(3)} elementi` +
    ` · ${c.trap} trappole · ${c.rule} regole · ${c.numbers} numeri · ${c.system} metodi`
  );
}
console.log(
  `\nTotale: ${model.counts.total} elementi da ${model.chapters.length} capitoli` +
  ` (${model.counts.trap} trappole, ${model.counts.rule} regole, ` +
  `${model.counts.numbers} blocchi di numeri, ${model.counts.system} metodi).`
);

if (errors.length) {
  console.error('\nErrori:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('OK: estrazione coerente con i capitoli.');
