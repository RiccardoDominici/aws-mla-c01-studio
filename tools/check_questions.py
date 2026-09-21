#!/usr/bin/env python3
"""Controllo qualita' dei file del banco domande (content/questions/*.json).

Uso:
    python3 tools/check_questions.py content/questions/ch1-transformer.json
    python3 tools/check_questions.py content/questions/*.json

Verifica lo schema del contratto (content/questions/README) e, soprattutto,
che la risposta corretta NON sia riconoscibile dalla sola lunghezza: nei banchi
generati la corretta tende a essere piu' lunga e dettagliata dei distrattori,
e chi studia impara a scegliere "la piu' lunga" invece del concetto.

Esce con codice 1 se almeno un file non passa.
"""
import json
import sys
from collections import Counter

MIN_QUESTIONS = 40          # obiettivo minimo di domande per capitolo
MAX_LONGEST_SHARE = 0.35    # quota max di corrette che sono l'opzione piu' lunga
MAX_MEAN_RATIO = 1.15       # rapporto medio lunghezza corretta / distrattori
DIFFICULTIES = ('facile', 'media', 'difficile')
REQUIRED = ('id', 'chapter', 'q', 'options', 'answer', 'explain', 'difficulty', 'tags', 'source')


def check_schema(questions, expected_chapter):
    """Errori di schema del contratto. Ritorna una lista di stringhe."""
    errs = []
    if len(questions) < MIN_QUESTIONS:
        errs.append(f"solo {len(questions)} domande, il minimo per capitolo e' {MIN_QUESTIONS}")

    for i, q in enumerate(questions):
        for key in REQUIRED:
            if key not in q:
                errs.append(f"#{i} campo mancante: {key}")
        if expected_chapter and q.get('chapter') != expected_chapter:
            errs.append(f"#{i} chapter '{q.get('chapter')}' non combacia col nome file")
        options = q.get('options', [])
        if len(options) != 4:
            errs.append(f"#{i} opzioni != 4")
        if len(set(options)) != len(options):
            errs.append(f"#{i} opzioni duplicate")
        answer = q.get('answer')
        if not isinstance(answer, int) or not 0 <= answer <= 3:
            errs.append(f"#{i} answer fuori range")
        if q.get('difficulty') not in DIFFICULTIES:
            errs.append(f"#{i} difficulty invalida: {q.get('difficulty')}")
        if not str(q.get('explain', '')).strip():
            errs.append(f"#{i} explain vuota")
        if '<' in str(q.get('q', '')) and '>' in str(q.get('q', '')):
            errs.append(f"#{i} possibile HTML nel testo (il frontend non lo interpreta)")

    ids = [q.get('id') for q in questions]
    if len(set(ids)) != len(ids):
        errs.append("id duplicati nel file")
    texts = [q.get('q') for q in questions]
    if len(set(texts)) != len(texts):
        errs.append("domande duplicate nel file")
    return errs


def length_bias(questions):
    """Statistiche sul bias di lunghezza. Ritorna (n_longest, rapporto_medio, peggiori)."""
    n_longest = 0
    ratios = []
    worst = []
    for q in questions:
        answer = q['answer']
        options = q['options']
        correct_len = len(options[answer])
        if correct_len == max(len(o) for o in options):
            n_longest += 1
        others = [len(o) for i, o in enumerate(options) if i != answer]
        ratio = correct_len / (sum(others) / len(others))
        ratios.append(ratio)
        worst.append((ratio, q.get('id', '?'), q.get('q', '')[:55]))
    worst.sort(reverse=True)
    return n_longest, sum(ratios) / len(ratios), worst


def check_file(path):
    """Controlla un file. Ritorna True se passa."""
    try:
        questions = json.load(open(path, encoding='utf-8'))
    except (OSError, ValueError) as err:
        print(f"{path}: ILLEGGIBILE ({err})")
        return False
    if not isinstance(questions, list) or not questions:
        print(f"{path}: non e' un array di domande non vuoto")
        return False

    expected_chapter = path.split('/')[-1].replace('.json', '')
    errs = check_schema(questions, expected_chapter)
    n_longest, mean_ratio, worst = length_bias(questions)
    max_longest = int(len(questions) * MAX_LONGEST_SHARE)

    print(f"file               : {path}")
    print(f"domande            : {len(questions)}")
    print(f"answer             : {dict(sorted(Counter(q['answer'] for q in questions).items()))}")
    print(f"difficulty         : {dict(Counter(q['difficulty'] for q in questions))}")
    print(f"corretta=piu lunga : {n_longest}/{len(questions)}   (obiettivo <= {max_longest})")
    print(f"rapporto medio     : {mean_ratio:.2f}       (obiettivo <= {MAX_MEAN_RATIO})")

    fail = list(errs)
    if n_longest > max_longest:
        fail.append(f"troppe corrette sono l'opzione piu' lunga ({n_longest}/{len(questions)})")
    if mean_ratio > MAX_MEAN_RATIO:
        fail.append(f"rapporto medio di lunghezza troppo alto ({mean_ratio:.2f})")

    if fail:
        print("NON PASSA:")
        for f in fail[:12]:
            print("  -", f)
        if len(fail) > 12:
            print(f"  ... e altri {len(fail) - 12} problemi")
        print("peggiori per rapporto di lunghezza:")
        for ratio, qid, text in worst[:5]:
            print(f"   {ratio:5.2f}  {qid}  {text}")
    else:
        print("OK")
    print("-" * 66)
    return not fail


def main():
    paths = sys.argv[1:]
    if not paths:
        print(__doc__)
        return 2
    ok = all([check_file(p) for p in paths])   # lista: controlla tutti i file
    print("TUTTI I FILE PASSANO" if ok else "ALCUNI FILE NON PASSANO")
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
