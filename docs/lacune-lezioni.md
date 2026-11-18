# Lacune delle lezioni rispetto al banco domande

Ogni domanda di `content/questions/*.json` ha un campo `lesson` che punta alla slide che
insegna il punto testato. `lesson.approx: true` segnala che nessuna slide lo insegna e
che il pulsante del banco porta solo all'argomento più vicino.

**Stato al 2026-11-19: nessuna lacuna aperta (0 domande con `approx`).**

Le 127 lacune trovate nella mappatura del 2026-11-18 sono state colmate aggiungendo
bullets alle slide (narration, titoli e ordine delle slide invariati, quindi l'audio resta
valido) e verificate da una revisione indipendente. Sei domande che contraddicevano la
documentazione AWS sono state corrette invece di insegnare il fatto sbagliato:
ch5-q28 e ch5-ext25 (EventBridge non riporta le violazioni di Model Monitor),
ch1-ext20 (le domande non valutate sono 15), ch2-ext02 (S3 Select chiuso ai nuovi clienti),
ch6-ext22 (Bedrock usa BERTScore e NLP-F1, non ROUGE), ch6-q43 (cold start dei nuovi item).

Per ritrovare eventuali nuove lacune:

```bash
python3 -c "import json,glob; print([q['id'] for p in glob.glob('content/questions/*.json') for q in json.load(open(p)) if q.get('lesson',{}).get('approx')])"
```

Nota aperta: in ch1-exam-guide le narration sono sfasate di una slide rispetto ai titoli.
Correggerle richiede di rigenerare l'audio del capitolo.
