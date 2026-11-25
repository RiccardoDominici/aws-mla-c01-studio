#!/usr/bin/env bash
# deploy.sh — pubblica il sito su Cloudflare Pages.
#
# Perché non `wrangler pages deploy .` direttamente: wrangler carica TUTTA la
# cartella e Pages rifiuta i file oltre 25 MiB. Nella cartella audio/ restano i
# .wav della sintesi TTS (fino a ~120 MiB l'uno): sono sorgenti rigenerabili, il
# player usa solo gli .mp3. Si copia quindi il solo sito in una cartella
# temporanea e si pubblica quella, così l'esclusione vale sempre e non dipende
# dal fatto che i .wav esistano o dal loro peso.
#
# Uso: tools/deploy.sh [argomenti extra per wrangler pages deploy]
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

# Solo ciò che il sito serve: file statici, content/, audio mp3, functions,
# _routes.json. Restano fuori sorgenti TTS, cache, tooling e dotfile di lavoro.
rsync -a \
  --exclude '.git' \
  --exclude '.wrangler' \
  --exclude '.tts-cache' \
  --exclude 'node_modules' \
  --exclude '__pycache__' \
  --exclude '.DS_Store' \
  --exclude 'tools' \
  --exclude 'docs' \
  --exclude 'audio/*.wav' \
  --exclude '*.md' \
  --exclude 'session-*' \
  "$repo"/ "$stage"/

echo "Deploy di $(du -sh "$stage" | cut -f1) di sito da $stage"
cd "$stage"
npx wrangler pages deploy . --project-name mla-c01-studio --branch main --commit-dirty=true "$@"
