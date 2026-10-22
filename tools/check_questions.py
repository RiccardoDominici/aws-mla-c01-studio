#!/usr/bin/env python3
"""Controllo qualita' dei file del banco domande (content/questions/*.json).

Uso:
    python3 tools/check_questions.py content/questions/ch1-exam-guide.json
    python3 tools/check_questions.py content/questions/*.json

Verifica lo schema v2 del contratto (content/questions/README) e, soprattutto,
che la risposta corretta NON sia riconoscibile dalla sola lunghezza: nei banchi
generati la corretta tende a essere piu' lunga e dettagliata dei distrattori,
e chi studia impara a scegliere "la piu' lunga" invece del concetto.

Schema v2, controllato qui:
  - scelta singola: 4 opzioni, answer intero 0-3, nessun "Select" nel testo;
  - risposta multipla: answer array ordinato di 2 o 3 indici distinti, con
    5 o 6 opzioni rispettivamente, e testo che finisce con "(Select TWO.)" o
    "(Select THREE.)";
  - domain in 1, 2, 3, 4, META; task coerente col dominio (META -> "-");
    exam: elenco non vuoto di C01 e/o C02.

Esce con codice 1 se almeno un file non passa.
"""
import json
import sys
from collections import Counter

MIN_QUESTIONS = 40          # obiettivo minimo di domande per capitolo
MAX_LONGEST_SHARE = 0.35    # quota max di scelte singole corrette che sono l'opzione piu' lunga
MAX_MEAN_RATIO = 1.15       # rapporto medio lunghezza corrette / distrattori (singole e multiple)
MIN_INDEX_SHARE = 0.15      # quota minima di ogni indice corretto (scelta singola)
MAX_INDEX_SHARE = 0.35      # quota massima di ogni indice corretto (scelta singola)
MIN_SINGLES_FOR_INDEX_CHECK = 20  # sotto questa soglia la distribuzione e' troppo rumorosa
MIN_MEAN_RATIO = 0.90             # sotto questo valore la corretta e' sistematicamente la piu' corta
MIN_LONGEST_SHARE = 0.15          # sotto questa quota "corretta = piu' lunga" il banco insegna a scegliere la piu' corta
DIFFICULTIES = ('facile', 'media', 'difficile')
DOMAINS = ('1', '2', '3', '4', 'META')
TASKS = ('1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '4.1', '4.2', '4.3')
EXAMS = ('C01', 'C02')
REQUIRED = ('id', 'chapter', 'q', 'options', 'answer', 'explain', 'difficulty', 'tags', 'source',
            'domain', 'task', 'exam')
SELECT_SUFFIX = {2: '(Select TWO.)', 3: '(Select THREE.)'}


def is_multi(q):
    """Vero se la domanda e' a risposta multipla (answer e' un array)."""
    return isinstance(q.get('answer'), list)


def check_answer(q):
    """Errori su chiave, numero di opzioni e testo "Select". Ritorna una lista di stringhe."""
    errs = []
    options = q.get('options', [])
    answer = q.get('answer')
    text = str(q.get('q', '')).rstrip()

    if is_multi(q):
        n = len(answer)
        if n not in SELECT_SUFFIX:
            errs.append(f"risposta multipla con {n} corrette (ammesse 2 o 3)")
        elif not all(isinstance(v, int) and not isinstance(v, bool) for v in answer):
            errs.append("answer multipla con valori non interi")
        elif len(set(answer)) != n:
            errs.append("answer multipla con indici ripetuti")
        elif answer != sorted(answer):
            errs.append("answer multipla non ordinato")
        elif any(v < 0 or v >= len(options) for v in answer):
            errs.append("answer multipla fuori range")
        if n in SELECT_SUFFIX:
            if len(options) != n + 3:
                errs.append(f"{n} risposte giuste richiedono {n + 3} opzioni, ne ha {len(options)}")
            if not text.endswith(SELECT_SUFFIX[n]):
                errs.append(f"testo deve finire con {SELECT_SUFFIX[n]}")
    else:
        if len(options) != 4:
            errs.append(f"scelta singola con {len(options)} opzioni (attese 4)")
        if not isinstance(answer, int) or isinstance(answer, bool) or not 0 <= answer <= 3:
            errs.append("answer fuori range")
        lowered = text.lower()
        if 'select two' in lowered or 'select three' in lowered:
            errs.append("testo dice Select TWO/THREE ma la domanda e' a scelta singola")

    if len(set(options)) != len(options):
        errs.append("opzioni duplicate")
    return errs


def check_classification(q):
    """Errori su domain, task ed exam. Ritorna una lista di stringhe."""
    errs = []
    domain = str(q.get('domain'))
    task = q.get('task')
    if domain not in DOMAINS:
        errs.append(f"domain invalido: {q.get('domain')}")
    elif domain == 'META':
        if task != '-':
            errs.append(f"task deve essere '-' per META, e' {task}")
    elif task not in TASKS or not str(task).startswith(domain + '.'):
        errs.append(f"task {task} non appartiene al dominio {domain}")

    exam = q.get('exam')
    if not isinstance(exam, list) or not exam:
        errs.append("exam deve essere un elenco non vuoto")
    else:
        unknown = [e for e in exam if e not in EXAMS]
        if unknown:
            errs.append(f"exam con valori sconosciuti: {unknown}")
        if len(set(exam)) != len(exam):
            errs.append("exam con valori ripetuti")
    return errs


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
        for msg in check_answer(q):
            errs.append(f"#{i} {msg}")
        for msg in check_classification(q):
            errs.append(f"#{i} {msg}")
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


def index_share_errors(singles):
    """Errore se un indice corretto delle scelte singole e' sotto il 15% o sopra il 35%.

    Vale solo per file con almeno MIN_SINGLES_FOR_INDEX_CHECK domande singole: chi studia
    impara a scartare un indice poco usato (per esempio la D) se non compare mai come
    risposta. Ritorna (errori, quote per indice).
    """
    counts = Counter(q['answer'] for q in singles)
    shares = {i: counts.get(i, 0) / len(singles) for i in range(4)} if singles else {}
    if len(singles) < MIN_SINGLES_FOR_INDEX_CHECK:
        return [], shares
    errs = []
    for i in range(4):
        share = shares[i]
        if share < MIN_INDEX_SHARE or share > MAX_INDEX_SHARE:
            letter = 'ABCD'[i]
            errs.append(f"indice {letter} corretto nel {share * 100:.0f} per cento delle singole "
                        f"(atteso tra {MIN_INDEX_SHARE * 100:.0f} e {MAX_INDEX_SHARE * 100:.0f} per cento)")
    return errs, shares


def multi_index_warnings(multis):
    """Avvisi informativi sulla distribuzione delle posizioni corrette nelle multiple.

    Conta le posizioni corrette su tutte le multiple (ogni risposta giusta e' uno slot).
    Non blocca il controllo: segnala quando un indice domina o non compare mai.
    """
    slots = Counter(i for q in multis for i in q['answer'])
    total = sum(slots.values())
    if not total:
        return []
    warns = []
    for i in range(4):
        share = slots.get(i, 0) / total
        if share > MAX_INDEX_SHARE:
            warns.append(f"multipla: indice {'ABCD'[i]} e' corretto nel {share * 100:.0f} per cento delle posizioni corrette")
        elif share < MIN_INDEX_SHARE:
            warns.append(f"multipla: indice {'ABCD'[i]} e' corretto solo nel {share * 100:.0f} per cento delle posizioni corrette")
    return warns


def reverse_bias_errors(stats, n_singles):
    """Errori sul bias di lunghezza "al contrario": la corretta troppo corta.

    Vale solo con almeno MIN_SINGLES_FOR_INDEX_CHECK domande singole, come il controllo
    sugli indici. Chi studia impara a scegliere la risposta piu' corta se la corretta lo
    e' quasi sempre. Ritorna una lista di errori.
    """
    if n_singles < MIN_SINGLES_FOR_INDEX_CHECK:
        return []
    errs = []
    if stats['single_mean_ratio'] is not None and stats['single_mean_ratio'] < MIN_MEAN_RATIO:
        errs.append(f"rapporto medio singole troppo basso ({stats['single_mean_ratio']:.2f}): "
                    f"la corretta e' tipicamente la piu' corta (minimo {MIN_MEAN_RATIO:.2f})")
    if stats['multi_mean_ratio'] is not None and stats['multi_mean_ratio'] < MIN_MEAN_RATIO:
        errs.append(f"rapporto medio multiple troppo basso ({stats['multi_mean_ratio']:.2f}): "
                    f"le corrette sono tipicamente le piu' corte (minimo {MIN_MEAN_RATIO:.2f})")
    longest_share = stats['single_longest'] / n_singles
    if longest_share < MIN_LONGEST_SHARE:
        errs.append(f"corretta = opzione piu' lunga solo nel {longest_share * 100:.0f} per cento delle singole "
                    f"(minimo {MIN_LONGEST_SHARE * 100:.0f} per cento, atteso per caso circa 25)")
    return errs


def length_stats(questions):
    """Statistiche sul bias di lunghezza.

    Singole: come da contratto, quante corrette sono l'opzione piu' lunga e il rapporto
    medio per domanda (corretta / media dei distrattori).
    Multiple: rapporto tra la lunghezza media delle opzioni corrette e quella dei
    distrattori, su tutte le multiple. Non si conta "la piu' lunga", perche' con 2 o 3
    corrette su 5 o 6 opzioni la quota attesa e' gia' alta.
    """
    single_longest = 0
    single_ratios = []
    multi_correct_len = []
    multi_distractor_len = []
    multi_longest_in_answer = 0
    worst = []

    for q in questions:
        options = q['options']
        lens = [len(o) for o in options]
        if is_multi(q):
            correct = set(q['answer'])
            c_lens = [lens[i] for i in range(len(options)) if i in correct]
            d_lens = [lens[i] for i in range(len(options)) if i not in correct]
            multi_correct_len.extend(c_lens)
            multi_distractor_len.extend(d_lens)
            if lens.index(max(lens)) in correct:
                multi_longest_in_answer += 1
            ratio = (sum(c_lens) / len(c_lens)) / (sum(d_lens) / len(d_lens))
        else:
            answer = q['answer']
            if lens[answer] == max(lens):
                single_longest += 1
            others = [lens[i] for i in range(len(options)) if i != answer]
            ratio = lens[answer] / (sum(others) / len(others))
            single_ratios.append(ratio)
        worst.append((ratio, q.get('id', '?'), q.get('q', '')[:55]))

    worst.sort(reverse=True)
    return {
        'single_longest': single_longest,
        'single_mean_ratio': sum(single_ratios) / len(single_ratios) if single_ratios else None,
        'multi_mean_ratio': (sum(multi_correct_len) / len(multi_correct_len)) /
                            (sum(multi_distractor_len) / len(multi_distractor_len))
                            if multi_correct_len else None,
        'multi_longest_in_answer': multi_longest_in_answer,
        'worst': worst,
    }


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
    stats = length_stats(questions)

    singles = [q for q in questions if not is_multi(q)]
    multis = [q for q in questions if is_multi(q)]
    max_longest = int(len(singles) * MAX_LONGEST_SHARE)

    print(f"file               : {path}")
    print(f"domande            : {len(questions)}  (scelta singola {len(singles)}, multipla {len(multis)}"
          f" = {100 * len(multis) / len(questions):.0f} per cento)")
    print(f"answer singole     : {dict(sorted(Counter(q['answer'] for q in singles).items()))}")
    if multis:
        print(f"risposte multiple  : {dict(sorted(Counter(len(q['answer']) for q in multis).items()))}"
              f" (per numero di corrette)")
    print(f"difficulty         : {dict(Counter(q.get('difficulty') for q in questions))}")
    print(f"domain             : {dict(sorted(Counter(str(q.get('domain')) for q in questions).items()))}")
    print(f"task               : {dict(sorted(Counter(str(q.get('task')) for q in questions).items()))}")
    print(f"exam               : {dict(sorted(Counter(e for q in questions for e in q.get('exam', [])).items()))}")
    print(f"corretta=piu lunga : {stats['single_longest']}/{len(singles)}   (obiettivo <= {max_longest})")
    if stats['single_mean_ratio'] is not None:
        print(f"rapporto medio     : {stats['single_mean_ratio']:.2f}       (obiettivo <= {MAX_MEAN_RATIO})")
    if stats['multi_mean_ratio'] is not None:
        print(f"rapporto multiple  : {stats['multi_mean_ratio']:.2f}       (obiettivo <= {MAX_MEAN_RATIO})")
        print(f"multiple: la piu' lunga e' corretta in {stats['multi_longest_in_answer']}/{len(multis)}"
              f" (solo informativo)")

    index_errs, _ = index_share_errors(singles)
    index_errs += reverse_bias_errors(stats, len(singles))
    warns = multi_index_warnings(multis)
    if warns:
        print("AVVISI (informativi, non bloccano):")
        for w in warns:
            print("  -", w)

    fail = list(errs) + index_errs
    if stats['single_longest'] > max_longest:
        fail.append(f"troppe corrette sono l'opzione piu' lunga ({stats['single_longest']}/{len(singles)})")
    if stats['single_mean_ratio'] is not None and stats['single_mean_ratio'] > MAX_MEAN_RATIO:
        fail.append(f"rapporto medio di lunghezza troppo alto ({stats['single_mean_ratio']:.2f})")
    if stats['multi_mean_ratio'] is not None and stats['multi_mean_ratio'] > MAX_MEAN_RATIO:
        fail.append(f"bias di lunghezza nelle multiple: corrette {stats['multi_mean_ratio']:.2f} volte i distrattori")

    if fail:
        print("NON PASSA:")
        for f in fail[:12]:
            print("  -", f)
        if len(fail) > 12:
            print(f"  ... e altri {len(fail) - 12} problemi")
        print("peggiori per rapporto di lunghezza:")
        for ratio, qid, text in stats['worst'][:5]:
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
