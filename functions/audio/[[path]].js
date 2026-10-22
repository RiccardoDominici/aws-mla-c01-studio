// Pages Function per /audio/*: serve i file audio con supporto alle richieste Range.
//
// Perché esiste: Cloudflare Pages ignora l'header `Range` sugli asset statici e
// risponde sempre 200 con il file intero, senza `Accept-Ranges`. Chrome, non
// ricevendo risposte a range, marca il media come non seekable (audio.seekable =
// [0,0]): i salti del player (±10s, slider, click sulla trascrizione) tornavano a 0
// finché il file non finiva in cache e la pagina non veniva ricaricata.
// Questa Function legge il file intero dall'asset binding e ritaglia il range
// richiesto, così il seek funziona già al primo ascolto.
//
// Il file è sempre letto per intero: i file audio sono piccoli (≤ 5 MB) e così
// conosciamo la dimensione esatta anche quando l'asset non espone Content-Length.

const HANDLED_METHODS = ['GET', 'HEAD'];

export async function onRequest(context) {
  const { request, env } = context;

  // Gli altri metodi (POST, OPTIONS…) non ci riguardano: li passa agli asset.
  if (!HANDLED_METHODS.includes(request.method)) {
    return env.ASSETS.fetch(request);
  }

  try {
    return await serveAudio(request, env);
  } catch (err) {
    // In caso di errore non blocchiamo l'audio: torniamo al comportamento statico.
    console.error('[audio-range]', request.method, new URL(request.url).pathname, err);
    return env.ASSETS.fetch(request);
  }
}

async function serveAudio(request, env) {
  const url = new URL(request.url);
  const method = request.method;

  // Richiesta pulita, senza Range né condizionali: otteniamo sempre il file intero.
  const asset = await env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
  if (asset.status !== 200) {
    return asset;
  }

  const buf = await asset.arrayBuffer();
  const size = buf.byteLength;
  const etag = asset.headers.get('ETag');
  const rangeHeader = request.headers.get('Range');
  const ifNoneMatch = request.headers.get('If-None-Match');
  const ifRange = request.headers.get('If-Range');

  // Cache del browser ancora valida: niente body. Il Range ha la precedenza sul condizionale.
  if (ifNoneMatch && !rangeHeader && etagMatches(ifNoneMatch, etag)) {
    logRequest(method, url.pathname, rangeHeader, 304, 'not-modified');
    return new Response(null, { status: 304, headers: baseHeaders(asset) });
  }

  // If-Range: il Range vale solo se il client ha ancora la stessa versione del file.
  const rangeApplies = rangeHeader && (!ifRange || ifRange === etag);
  const range = rangeApplies ? parseRange(rangeHeader, size) : null;

  if (range && range.unsatisfiable) {
    const headers = baseHeaders(asset);
    headers.set('Content-Range', `bytes */${size}`);
    logRequest(method, url.pathname, rangeHeader, 416, `*/${size}`);
    return new Response(null, { status: 416, headers });
  }

  if (range) {
    const { start, end } = range;
    const length = end - start + 1;
    const headers = baseHeaders(asset);
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(length));
    logRequest(method, url.pathname, rangeHeader, 206, `${start}-${end}/${size}`);
    return new Response(method === 'HEAD' ? null : buf.slice(start, end + 1), {
      status: 206,
      headers,
    });
  }

  // Nessun Range valido (assente, malformato, multiplo o con If-Range non corrispondente): file intero.
  const headers = baseHeaders(asset);
  headers.set('Content-Length', String(size));
  logRequest(method, url.pathname, rangeHeader, 200, `full ${size}`);
  return new Response(method === 'HEAD' ? null : buf, { status: 200, headers });
}

// Header da propagare dall'asset originale, più quelli che annunciano il supporto a Range.
function baseHeaders(asset) {
  const headers = new Headers();
  for (const name of ['Content-Type', 'ETag', 'Cache-Control', 'Last-Modified']) {
    const value = asset.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('Accept-Ranges', 'bytes');
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
}

// Interpreta `Range: bytes=…` per un singolo intervallo.
// Ritorna { start, end } se valido, { unsatisfiable: true } se fuori dal file,
// null se l'header va ignorato (malformato o con più intervalli, che non supportiamo).
function parseRange(header, size) {
  const match = /^bytes=\s*(\d*)-(\d*)\s*$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;

  const [, first, last] = match;
  if (size === 0) return { unsatisfiable: true };

  // Forma suffisso `-n`: gli ultimi n byte del file.
  if (first === '') {
    const suffix = Number(last);
    if (suffix === 0) return { unsatisfiable: true };
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  // Forme `a-b` e `a-` (fino alla fine). L'estremo finale viene limitato alla dimensione.
  const start = Number(first);
  if (start >= size) return { unsatisfiable: true };

  const end = last === '' ? size - 1 : Math.min(Number(last), size - 1);
  if (start > end) return { unsatisfiable: true };

  return { start, end };
}

// Confronta un If-None-Match (anche lista separata da virgole) con l'ETag dell'asset.
// Il confronto ignora il prefisso debole `W/`, perché per l'audio conta solo il contenuto.
function etagMatches(header, etag) {
  if (!etag) return false;
  const target = stripWeak(etag);
  return header.split(',').some((candidate) => {
    const value = candidate.trim();
    return value === '*' || stripWeak(value) === target;
  });
}

function stripWeak(tag) {
  return tag.replace(/^W\//, '');
}

// Una riga per richiesta gestita: serve a verificare sul campo che il seek riceva i 206.
function logRequest(method, pathname, rangeHeader, status, detail) {
  console.log(`[audio-range] ${method} ${pathname} range="${rangeHeader ?? ''}" -> ${status} ${detail}`);
}
