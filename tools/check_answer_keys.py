#!/usr/bin/env python3
"""Cerca domande in cui la chiave `answer` potrebbe puntare all'opzione sbagliata.

Uso:
    python3 tools/check_answer_keys.py content/questions/*.json

L'idea: la spiegazione (`explain`) descrive il concetto della risposta giusta.
Se il testo della spiegazione somiglia molto piu' a un'opzione DIVERSA da quella
indicata da `answer`, la chiave e' probabilmente sbagliata. E' il difetto piu'
grave possibile in un banco domande — chi studia memorizza la risposta errata —
ed e' invisibile ai controlli strutturali di check_questions.py.

Lo script SEGNALA, non corregge: ogni segnalazione va letta a mano, perche'
produce anche falsi positivi (una spiegazione che cita il distrattore per
spiegare perche' e' sbagliato somiglia a quel distrattore).
"""
import json
import re
import sys
import unicodedata

MARGIN = 0.22   # scarto minimo di somiglianza per segnalare

# Parole troppo comuni per distinguere un'opzione dall'altra.
STOP = set('''il lo la i gli le un uno una di a da in con su per tra fra e o che non piu del della dei delle
dello nel nella nei nelle al alla ai alle dal dalla dai dalle sul sulla come quando dove perche se ma anche solo
essere sono stato stata viene vengono ha hanno puo possono deve devono si ci vi ne questo questa questi queste
quello quella quelli quelle suo sua suoi sue loro cui quindi cosi ogni tutti tutte tutto tutta molto poco
esempio caso casi modo parte dopo prima durante mentre senza sempre mai gia ancora invece oppure cioe
risposta domanda opzione corretta corretto sbagliato sbagliata'''.split())


def tokens(text):
    """Parole significative, senza accenti ne' punteggiatura."""
    text = unicodedata.normalize('NFKD', text.lower())
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = re.sub(r'[^a-z0-9]+', ' ', text)
    return {w for w in text.split() if w not in STOP and len(w) > 3}


def coverage(explain, option):
    """Quanta parte dell'opzione e' coperta dalla spiegazione (0-1)."""
    te, to = tokens(explain), tokens(option)
    if not te or not to:
        return 0.0
    return len(te & to) / len(to)


def scan(path):
    """Segnala le domande sospette di un file. Ritorna la lista di segnalazioni."""
    flagged = []
    for q in json.load(open(path, encoding='utf-8')):
        scores = [coverage(q['explain'], o) for o in q['options']]
        best = max(range(len(scores)), key=lambda i: scores[i])
        if best != q['answer'] and scores[best] - scores[q['answer']] >= MARGIN:
            flagged.append((scores[best] - scores[q['answer']], q, best, scores))
    flagged.sort(key=lambda x: -x[0])
    return flagged


def main():
    paths = sys.argv[1:]
    if not paths:
        print(__doc__)
        return 2

    total = 0
    all_flagged = []
    for path in paths:
        questions = json.load(open(path, encoding='utf-8'))
        total += len(questions)
        all_flagged.extend(scan(path))

    print(f"domande analizzate : {total}")
    print(f"da rileggere a mano: {len(all_flagged)}\n")
    for margin, q, best, scores in all_flagged:
        print('=' * 74)
        print(f"{q['id']}   margine {margin:.2f}   answer={q['answer']}   sospetta={best}")
        print('Q :', q['q'][:110])
        for i, opt in enumerate(q['options']):
            mark = '>>' if i == q['answer'] else ('??' if i == best else '  ')
            print(f"  {mark} [{scores[i]:.2f}] {opt[:92]}")
        print('EXP:', q['explain'][:170])
    if all_flagged:
        print('\nNessuna di queste e\' automaticamente un errore: vanno lette.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
