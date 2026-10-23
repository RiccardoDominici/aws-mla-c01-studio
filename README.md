# MLA-C01 Studio

Sito di studio interattivo per l'esame **AWS Certified Machine Learning Engineer – Associate (MLA-C01)** — appunti in italiano, audio-lezioni con sintesi vocale locale, slide sincronizzate, quiz e tracciamento dei progressi.

Appunti e sito web a cura di Riccardo Dominici.

## Contenuti

14 capitoli + 1 scheda di ripasso last-minute, organizzati in 3 aree. I capitoli 8-14 approfondiscono quelli di base (per esempio il 12 approfondisce il 6) e stanno accanto a quello che approfondiscono in mappa:

| Area | Capitoli |
|------|----------|
| Fondamenti | 1. Guida all'esame MLA-C01 · 2. Data Preparation for ML · 8. Dati in profondità |
| Pratica MLOps | 3. Sviluppo modelli ML · 4. Deployment e orchestrazione · 5. Monitoraggio e sicurezza · 9. Training avanzato · 10. Infrastruttura e CI/CD · 11. Costi e sicurezza |
| Applicazioni | 6. GenAI su AWS: Bedrock e RAG · 7. Strategia d'esame e casi pratici · 12. GenAI: RAG avanzato · 13. Agenti e valutazione · 14. Servizi AI |
| Ripasso | Scheda rapida pre-esame (servizi AWS, trappole, checklist) |

Ogni capitolo ha 4 schede: **Lezione guidata** (audio + slide + trascrizione karaoke), **Riassunto** (con le fonti online), **Parole chiave**, **Quiz**. Un capitolo senza file mostra "contenuti in arrivo".

In più, un **banco domande** con risposta singola e multipla, filtri, simulazioni a tempo per MLA-C01 e MLA-C02 e spiegazione per ogni domanda. Conteggi di domande, minuti di audio e capitoli con audio si calcolano al caricamento e compaiono in home: questo file non li riporta.

Il sito copre l'esame MLA-C01 (in inglese fino al 28/09/2026). La beta MLA-C02, dal 29/09/2026, aggiunge GenAI e agenti in tutti i domini.

Lo stato della copertura rispetto all'esame è in `docs/TODO.md` (generato da `docs/todo.json`).

## Caratteristiche

- **Mappa SVG** dei capitoli con stato di avanzamento (da fare / in corso / completato)
- **Audio-lezioni TTS** in italiano (voce Chatterbox femminile, sintesi locale — nessun servizio esterno)
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

## Audio e richieste Range

Il player posiziona l'audio impostando `currentTime` (±10s, slider, click sulla trascrizione). Il browser può farlo solo se ottiene dal server porzioni del file tramite l'header HTTP `Range`. Cloudflare Pages però serve gli asset statici ignorando quell'header: risponde sempre `200` con il file intero, e Chrome considera l'audio non seekable (ogni salto torna a 0).

Per questo il progetto contiene:

- `functions/audio/[[path]].js`: una Pages Function che risponde a `/audio/*` con `206` e `416` secondo lo standard, leggendo il file dall'asset binding;
- `_routes.json`: limita l'esecuzione della Function ai soli percorsi `/audio/*`, tutto il resto resta statico.

`python3 -m http.server` non supporta `Range`, quindi per provare il seek in locale usa wrangler, che esegue anche la Function:

```bash
npx wrangler pages dev .
# apri http://localhost:8788
```

## Struttura

```
├── index.html            # home: mappa SVG + progressi
├── chapter.html          # pagina capitolo (4 schede)
├── domande.html          # banco domande filtrabile + simulazione d'esame
├── app.js                # registro dei 14 capitoli + loader (content/chapters/<id>.json)
├── map.js                # mappa SVG (desktop) o elenco (telefono)
├── chapter.js            # lezione: player, slide, karaoke, formule MathML
├── quiz.js               # quiz di fine capitolo
├── qbank.js              # banco domande: caricamento, filtri, stato (dati)
├── qbank-ui.js           # banco domande: rendering, modalità studio/esame
├── stats.js              # numeri della home: domande, minuti di audio, capitoli con audio
├── tracker.js            # progressi in localStorage (chiave: mla-progress)
├── style.css             # tema carta-penna leggibile
├── _routes.json          # Cloudflare Pages: solo /audio/* passa dalla Function
├── functions/
│   └── audio/[[path]].js # Pages Function: richieste Range per l'audio
├── content/
│   ├── chapters/         # un file per capitolo: <id>.json (+ quick-ref.json)
│   ├── timing.json       # mappa tempo→frase→slide per il player (generato)
│   ├── questions/        # banco domande: un JSON per capitolo + contratto
│   └── README            # contratto v2 dei capitoli
├── audio/
│   ├── *.mp3             # audio-lezioni (gli unici file serviti dal player)
│   └── manifest.json     # hash del copione sintetizzato per ogni capitolo
└── tools/
    ├── make_timing.py            # rigenera content/timing.json (narrazioni → slide)
    ├── tts_chatterbox_batch.py   # sintesi vocale con cache per frase e --stale
    ├── check_questions.py        # schema + bias di lunghezza del banco domande
    ├── check_answer_keys.py      # cerca chiavi `answer` puntate all'opzione errata
    └── check_coverage.py         # ogni voce di docs/todo.json è spiegata e allenata?
```

## Narrazione, timing e sintesi vocale

Ogni slide ha il suo testo parlato (`narration`). Da lì:

- `content/timing.json` mappa ogni frase alla slide e al tempo nell'audio. Lo rigenera
  `tools/make_timing.py`, che legge la durata degli mp3 e ricava i salti di slide dalle
  narrazioni, senza tabelle a mano:

  ```bash
  python3 tools/make_timing.py                          # tutti i capitoli con audio
  python3 tools/make_timing.py --chapter ch3-model-dev  # un solo capitolo
  ```

  Regole (identiche alla sintesi TTS): splitter frasi su `[.!?…]`, pausa di 0,25s tra frasi,
  durata ripartita in proporzione ai caratteri. Dettagli nel docstring di `tools/make_timing.py`.

- L'audio si genera con `tools/tts_chatterbox_batch.py` (Chatterbox, voce locale). Le frasi
  già sintetizzate restano in cache (`.tts-cache/`, ignorata da git): un'interruzione riprende
  da dove era, e un capitolo modificato risintetizza solo le frasi cambiate. `audio/manifest.json`
  registra il copione di ogni capitolo sintetizzato; `--stale` sintetizza solo quelli cambiati:

  ```bash
  PY=<cartella di persona4>/.venv/bin/python   # la cartella si imposta con la variabile PERSONA4_SRC
  $PY tools/tts_chatterbox_batch.py --stale --dry-run   # quali capitoli cambierebbero
  $PY tools/tts_chatterbox_batch.py --stale             # sintetizza quelli cambiati
  $PY tools/tts_chatterbox_batch.py --chapter quick-ref  # un capitolo

  Flusso completo: si modifica il copione (`narration` nelle slide), si lancia `--stale`
  e, per ogni capitolo sintetizzato, lo script rigenera da solo `content/timing.json`
  con `make_timing.py --chapter <id>`. Per rigenerare tutto il timing: `python3 tools/make_timing.py`.
  ```

  Il Python è quello del progetto persona4 (mlx-audio e soundfile). Dopo ogni capitolo
  lo script rigenera anche `timing.json`.

  La cartella `src` di persona4 si imposta con la variabile d'ambiente `PERSONA4_SRC`.
  Il default è `../VibeCoding/persona4/src`, rispetto alla cartella del repo.

> Nota: i file `.wav` intermedi della sintesi vocale **non** sono nel repo (vedi `.gitignore`):
> il player usa solo gli `.mp3`.

## Banco domande

Ogni capitolo ha il suo file in `content/questions/<id>.json`. Il banco mostra le domande
singole e quelle a risposta multipla (tutto-o-niente, come all'esame). Due preset avviano una
simulazione a tempo: quella MLA-C01 e quella MLA-C02, con i pesi dei domini di ciascun esame.

Controllo di copertura rispetto alla to-do dell'esame:

```bash
python3 tools/check_coverage.py      # una riga per voce e riepilogo per gruppo
```

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

Deploy su **Cloudflare Pages** (progetto `mla-c01-studio`, solo file necessari, `.wav` esclusi):

```bash
npx wrangler pages project create mla-c01-studio
npx wrangler pages deploy . --branch main
```

## Fonti dei contenuti

Exam guide ufficiale https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/,
AWS Skill Builder https://skillbuilder.aws/learn, documentazione SageMaker / Bedrock / Glue
(dettaglio completo nella sezione Fonti della home).
