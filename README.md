# MLA-C01 Studio

Sito di studio interattivo per l'esame **AWS Certified Machine Learning Engineer – Associate (MLA-C01)** — appunti in italiano, audio-lezioni con sintesi vocale locale, slide sincronizzate, quiz e tracciamento dei progressi.

Appunti e sito web a cura di Riccardo Dominici.

## Contenuti

7 capitoli + 1 scheda di ripasso last-minute, organizzati in 3 macro-aree:

| Area | Capitoli |
|------|----------|
| Fondamenti | 1. Guida all'esame MLA-C01 · 2. Data Preparation for ML |
| Pratica MLOps | 3. Sviluppo modelli ML · 4. Deployment e orchestrazione · 5. Monitoraggio e sicurezza |
| Applicazioni | 6. GenAI su AWS: Bedrock e RAG · 7. Strategia d'esame e casi pratici |
| Ripasso | Scheda rapida pre-esame (servizi AWS, trappole, checklist) |

Ogni capitolo ha 4 schede: **Lezione guidata** (audio + slide + trascrizione karaoke), **Riassunto**, **Parole chiave**, **Quiz**.

In più, un **banco domande** d'esame filtrabile e con simulazione a tempo (ritmo dell'esame vero: 65 domande / 170 minuti, 2,6 minuti a domanda; soglia ufficiale 720/1000).

## Caratteristiche

- **Mappa SVG** dei capitoli con stato di avanzamento (da fare / in corso / completato)
- **Audio-lezioni TTS** in italiano (voce Alice, sintesi locale macOS — nessun servizio esterno)
- **Slide sincronizzate** con l'audio: navigare le slide sposta il punto di ascolto
- **Player custom**: play/pausa, ±10s, barra con marcatori slide, velocità di riproduzione
- **Trascrizione karaoke**: highlight in tempo reale, auto-scroll, click sulla frase = seek
- **Formule** composte in MathML nativo (offline, zero CDN), con fallback Unicode
- **Quiz** di fine capitolo + **tracker** dei progressi in `localStorage`
- **Banco domande** (`domande.html`): domande filtrabili per capitolo, difficoltà,
  stato (da fare / sbagliate / corrette / segnate ★), origine (🤖 generate dal sito /
  🌐 adattate da pratica online) e ricerca testuale, con selezione multipla
  per ogni riga di filtro, feedback
  immediato e spiegazione; **simulazione d'esame** a tempo con punteggio e correzione
- 100% statico, zero build, zero dipendenze: funziona su qualsiasi hosting statico

## Uso locale

Serve un server HTTP (il `fetch` dei JSON non funziona da `file://`):

```bash
cd aws-mla-c01-studio
python3 -m http.server 8000
# apri http://localhost:8000
```

## Struttura

```
├── index.html            # home: mappa SVG + progressi
├── chapter.html          # pagina capitolo (4 schede)
├── domande.html          # banco domande filtrabile + simulazione d'esame
├── app.js                # loader contenuti (unisce chapters-1/2.json)
├── map.js                # mappa SVG interattiva
├── chapter.js            # lezione: player, slide, karaoke, formule MathML
├── quiz.js               # quiz di fine capitolo
├── qbank.js              # banco domande: caricamento, filtri, stato (dati)
├── qbank-ui.js           # banco domande: rendering, modalità studio/esame
├── tracker.js            # progressi in localStorage (chiave: mla-progress)
├── style.css             # tema carta-penna leggibile
├── content/
│   ├── chapters-1.json   # capitoli 1–3 (testi, slide, script, quiz)
│   ├── chapters-2.json   # capitoli 4–7 + quick-ref
│   ├── timing.json       # mappa tempo→frase→slide per il player (generato)
│   ├── questions/        # banco domande: un JSON per capitolo + contratto
│   └── README            # contratto dello schema JSON dei capitoli
├── audio/
│   └── *.mp3             # audio-lezioni (gli unici file serviti dal player)
└── tools/
    ├── make_timing.py        # rigenera content/timing.json dagli mp3 reali
    ├── check_questions.py    # schema + bias di lunghezza del banco domande
    └── check_answer_keys.py  # cerca chiavi `answer` puntate all'opzione errata
```

## Rigenerare i timing

`content/timing.json` mappa ogni frase allo slide e al tempo nell'audio. Se cambi uno script o un mp3, rigeneralo:

```bash
python3 tools/make_timing.py                        # tutti i capitoli
python3 tools/make_timing.py --chapter ch3-model-dev  # un solo capitolo
```

Regole (identiche alla sintesi TTS): splitter frasi su `[.!?…]`, pausa di 0,25s tra frasi,
durata ripartita in proporzione ai caratteri. Dettagli nel docstring di `tools/make_timing.py`.

> Nota: i file `.wav` intermedi della sintesi vocale **non** sono nel repo (vedi `.gitignore`):
> il player usa solo gli `.mp3` e `make_timing.py` legge gli `.mp3`.

## Banco domande

Domande in stile MLA-C01 in `content/questions/<capitolo>.json`,
una per file secondo il contratto in `content/questions/README`. La pagina
`domande.html` le filtra per capitolo, difficoltà, stato, origine e testo libero
(con selezione multipla per riga: OR dentro la riga, AND tra righe); le
pagine capitolo linkano il proprio sottoinsieme con `domande.html?ch=<id>`.
Risposte e domande segnate stanno in `localStorage` (chiave `mla-domande`,
separata dai progressi del corso).

Le domande sono **di pratica**, elaborate sulla exam guide ufficiale AWS e sulla
documentazione pubblica: non sono domande reali d'esame.

Dopo ogni modifica al banco, verifica schema e qualità:

```bash
python3 tools/check_questions.py content/questions/*.json
```

Oltre allo schema, lo script controlla che la risposta corretta non sia
riconoscibile dalla sola lunghezza — il difetto tipico dei banchi generati, che
insegna a scegliere "la risposta più lunga" invece del concetto.

Un secondo controllo cerca il difetto più grave, cioè la chiave `answer` che
punta all'opzione sbagliata mentre tutto il resto è scritto bene:

```bash
python3 tools/check_answer_keys.py content/questions/*.json
```

Usa la spiegazione come oracolo indipendente e segnala le incoerenze; le
segnalazioni vanno lette a mano, perché include falsi positivi.

## Deploy

Deploy su **Cloudflare Pages** (solo file necessari, `.wav` esclusi):

```bash
npx wrangler pages project create aws-mla-c01-studio
npx wrangler pages deploy . --branch main
```

## Fonti dei contenuti

Exam guide ufficiale https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/,
AWS Skill Builder https://skillbuilder.aws/learn, documentazione SageMaker / Bedrock / Glue
(dettaglio completo nella sezione Fonti della home).
