#!/usr/bin/env python3
"""Controllo di copertura: ogni voce di docs/todo.json e' spiegata nella teoria e allenata nel banco?

Uso:
    python3 tools/check_coverage.py              # tabella per voce + riepilogo per gruppo
    python3 tools/check_coverage.py --json       # output macchina (JSON su stdout)

Per ogni voce che ha `regex` (espressioni cercate senza distinzione di maiuscole):
  - TEORIA: conta le occorrenze in content/chapters/*.json (summary, keywords, titoli,
    bullet e narration delle slide). La voce e' presente in teoria se compare nel
    capitolo di almeno uno dei `targets` che sono capitoli.
  - BANCO: conta le domande di content/questions/*.json in cui una regex compare in
    domanda, opzioni o spiegazione, oppure in cui l'id della voce e' nel campo `todo`.
La voce e' COPERTA se soddisfa i requisiti del campo `needs` di todo.json: "teoria"
richiede il riscontro nei capitoli target, "banco" richiede almeno 2 domande. Senza
`needs` valgono entrambi. Una voce con teoria richiesta e senza capitoli tra i `targets`
risulta "senza teoria".

Il codice di uscita e' 1 se una voce di teoria (gruppi K, G, V, C) non e' coperta,
compresa una voce senza `regex` (non verificabile, quindi non dimostrata coperta).
Altrimenti 0. Le voci di altri gruppi sono riportate ma non bloccano l'uscita.
"""
import argparse
import glob
import json
import logging
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODO_PATH = os.path.join(ROOT, 'docs', 'todo.json')
CHAPTERS_GLOB = os.path.join(ROOT, 'content', 'chapters', '*.json')
QUESTIONS_GLOB = os.path.join(ROOT, 'content', 'questions', '*.json')

THEORY_PREFIXES = ('K', 'G', 'V', 'C')   # gruppi di teoria: devono essere coperti
MIN_QUESTIONS = 2                        # domande minime che allenano una voce

log = logging.getLogger('check_coverage')


def compile_regexes(item):
    """Compila le regex di una voce; quelle non valide vengono segnalate e saltate."""
    compiled = []
    for pattern in item.get('regex') or []:
        try:
            compiled.append(re.compile(pattern, re.IGNORECASE))
        except re.error as err:
            log.warning('regex non valida in %s: %r (%s)', item['id'], pattern, err)
    return compiled


def chapter_text(chapter):
    """Testo di teoria di un capitolo: riassunto, parole chiave, slide. Il copione
    `script` non si conta, perche' ripete le narration delle slide."""
    parts = [chapter.get('summary', '')]
    for kw in chapter.get('keywords') or []:
        parts.append(str(kw.get('term', '')))
        parts.append(str(kw.get('def', '')))
    for slide in chapter.get('slides') or []:
        parts.append(str(slide.get('title', '')))
        parts.extend(str(b) for b in slide.get('bullets') or [])
        parts.append(str(slide.get('narration', '')))
    return '\n'.join(parts)


def load_theory():
    """Mappa id capitolo -> testo di teoria, per i file in content/chapters/."""
    theory = {}
    for path in sorted(glob.glob(CHAPTERS_GLOB)):
        try:
            with open(path, encoding='utf-8') as fh:
                chapter = json.load(fh)
        except (OSError, ValueError) as err:
            log.warning('capitolo non leggibile %s: %s', path, err)
            continue
        if not isinstance(chapter, dict) or 'id' not in chapter:
            log.warning('%s non e\' un oggetto capitolo con id, saltato', path)
            continue
        theory[chapter['id']] = chapter_text(chapter)
    log.info('teoria caricata: %d capitoli', len(theory))
    return theory


def load_questions():
    """Lista delle domande di tutti i file del banco."""
    questions = []
    for path in sorted(glob.glob(QUESTIONS_GLOB)):
        try:
            with open(path, encoding='utf-8') as fh:
                data = json.load(fh)
        except (OSError, ValueError) as err:
            log.warning('banco non leggibile %s: %s', path, err)
            continue
        if isinstance(data, list):
            questions.extend(q for q in data if isinstance(q, dict))
    log.info('banco caricato: %d domande', len(questions))
    return questions


def question_text(q):
    """Testo di una domanda su cui cercare le regex."""
    return ' '.join([str(q.get('q', ''))] + [str(o) for o in q.get('options') or []] +
                    [str(q.get('explain', ''))])


def check_item(item, theory, questions):
    """Esito di una voce. Ritorna un dict con i dati della verifica."""
    regexes = compile_regexes(item)
    # I target che sono capitoli hanno l'id "chN-..."; gli altri (engine, fix, banco...) sono agenti.
    chapter_targets = [t for t in item.get('targets') or [] if t.startswith('ch')]
    theory_required = item['id'][0] in THEORY_PREFIXES
    # Cosa serve per dichiarare la voce coperta, dal campo `needs` di todo.json.
    # Senza `needs` vale il default storico: teoria e banco.
    needs = item.get('needs') or ['teoria', 'banco']
    need_theory = 'teoria' in needs
    need_bank = 'banco' in needs

    result = {
        'id': item['id'],
        'group': item.get('group', ''),
        'title': item.get('title', ''),
        'theory_required': theory_required,
        'needs': needs,
        'has_regex': bool(item.get('regex')),
        'chapter_targets': chapter_targets,
        'theory_hits': {},          # capitolo -> occorrenze
        'missing_chapters': [],     # target capitolo senza file in content/chapters
        'questions_hit': 0,
        'covered': False,
        'senza_teoria': False,        # serve la teoria e nei capitoli target non c'e' riscontro
        'banco_insufficiente': False, # serve il banco e le domande sono meno di MIN_QUESTIONS
        'note': '',
    }

    if not result['has_regex']:
        result['note'] = 'senza regex: non verificabile'
        return result

    # Teoria: conta le occorrenze per capitolo presente
    for cid in chapter_targets:
        if cid not in theory:
            result['missing_chapters'].append(cid)
            continue
        hits = sum(len(rx.findall(theory[cid])) for rx in regexes)
        if hits:
            result['theory_hits'][cid] = hits

    # Banco: domande che matchano una regex o che hanno l'id nel campo todo
    hit = 0
    for q in questions:
        in_todo = item['id'] in (q.get('todo') or [])
        text = question_text(q)
        if in_todo or any(rx.search(text) for rx in regexes):
            hit += 1
    result['questions_hit'] = hit

    theory_ok = bool(result['theory_hits'])
    bank_ok = hit >= MIN_QUESTIONS
    result['senza_teoria'] = need_theory and not theory_ok
    result['banco_insufficiente'] = need_bank and not bank_ok
    # Coperta se ogni requisito in `needs` è soddisfatto. Una voce con teoria richiesta
    # e nessun capitolo target non può risultare coperta.
    result['covered'] = not result['senza_teoria'] and not result['banco_insufficiente']

    notes = []
    if result['senza_teoria']:
        if result['missing_chapters']:
            notes.append('capitolo mancante: ' + ', '.join(result['missing_chapters']))
        else:
            notes.append('senza teoria: nessun riscontro nei capitoli target')
    if result['banco_insufficiente']:
        notes.append(f'banco: {hit} domande su {MIN_QUESTIONS} richieste')
    result['note'] = '; '.join(notes)
    return result


def summarize(results):
    """Riepilogo per gruppo. Una voce non coperta può contare sia in `senza_teoria`
    sia in `banco_insufficiente` (se entrambi i requisiti mancano)."""
    groups = {}
    for r in results:
        g = groups.setdefault(r['group'], {'total': 0, 'covered': 0, 'senza_teoria': 0,
                                           'banco_insufficiente': 0, 'senza_regex': 0})
        g['total'] += 1
        if r['covered']:
            g['covered'] += 1
        if r['senza_teoria']:
            g['senza_teoria'] += 1
        if r['banco_insufficiente']:
            g['banco_insufficiente'] += 1
        if not r['has_regex']:
            g['senza_regex'] += 1
    return groups


def print_table(results, groups):
    """Tabella per voce e riepilogo per gruppo, leggibili in terminale."""
    print(f"{'id':<12}{'stato':<14}{'teoria':<24}{'banco':>6}  nota")
    print('-' * 78)
    for r in results:
        if not r['has_regex']:
            state = 'SENZA REGEX'
        elif r['covered']:
            state = 'coperta'
        else:
            state = 'NON COPERTA'
        theory = ', '.join(f"{c.split('-')[0]}:{n}" for c, n in r['theory_hits'].items()) or '-'
        print(f"{r['id']:<12}{state:<14}{theory[:23]:<24}{r['questions_hit']:>6}  {r['note']}")
    print()
    print('Riepilogo per gruppo')
    print('-' * 78)
    print(f"{'gruppo':<42}{'coperte':>10}{'senza teoria':>14}{'banco insuff.':>15}{'senza regex':>13}")
    for name, g in sorted(groups.items()):
        print(f"{name:<42}{g['covered']:>4} / {g['total']:<4}{g['senza_teoria']:>14}"
              f"{g['banco_insufficiente']:>15}{g['senza_regex']:>13}")
    total = len(results)
    covered = sum(1 for r in results if r['covered'])
    print('-' * 78)
    print(f'TOTALE coperte {covered} / {total}')


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--json', action='store_true', help='output JSON su stdout')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='[%(name)s] %(levelname)s %(message)s',
                        stream=sys.stderr)

    try:
        with open(TODO_PATH, encoding='utf-8') as fh:
            items = json.load(fh)['items']
    except (OSError, ValueError, KeyError) as err:
        log.error('docs/todo.json non leggibile: %s', err)
        return 2

    theory = load_theory()
    questions = load_questions()
    if not theory:
        log.warning('nessun capitolo in content/chapters: la teoria risulta mancante ovunque')

    results = [check_item(item, theory, questions) for item in items]
    groups = summarize(results)
    theory_gaps = [r for r in results if r['theory_required'] and not r['covered']]

    if args.json:
        json.dump({
            'items': results,
            'groups': groups,
            'covered': sum(1 for r in results if r['covered']),
            'total': len(results),
            'theory_gaps': [r['id'] for r in theory_gaps],
        }, sys.stdout, ensure_ascii=False, indent=2)
        print()
    else:
        print_table(results, groups)
        if theory_gaps:
            print(f'\n{len(theory_gaps)} voci di teoria (gruppi K, G, V, C) non coperte.')

    return 1 if theory_gaps else 0


if __name__ == '__main__':
    sys.exit(main())
