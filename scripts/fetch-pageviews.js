// Fetches yesterday's top-viewed Wikipedia articles for one language edition,
// filters out non-article pages (Main Page, Special:, Portal:, etc.), and
// downloads/processes a thumbnail for the #1 article if one exists.
//
// Writes:
//   docs/images/<lang>/latest.png   (thumbnail for #1, if available)
//   docs/data/<lang>.json           (ranked list + metadata)
//
// Usage: node fetch-pageviews.js <lang>   (lang: en, fr, de, es)

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fetch = require('node-fetch');

const LANG = process.argv[2];
if (!LANG) {
  console.error('Usage: node fetch-pageviews.js <lang>');
  process.exit(1);
}

// Prefixes to drop: main page + non-article namespaces, per language.
const SKIP_PREFIXES = {
  en: ['Special:', 'Wikipedia:', 'Portal:', 'File:', 'Talk:', 'Main_Page'],
  fr: ['Spécial:', 'Wikipédia:', 'Portail:', 'Fichier:', 'Discussion:'],
  de: ['Spezial:', 'Wikipedia:', 'Portal:', 'Datei:', 'Diskussion:'],
  es: ['Especial:', 'Wikipedia:', 'Portal:', 'Archivo:', 'Discusión:'],
};

const UA = { 'User-Agent': 'trmnl-wiki-pageviews/1.0 (personal e-ink project)' };
const OUT_IMG_DIR = path.join(__dirname, '..', 'docs', 'images', LANG);
const OUT_DATA_DIR = path.join(__dirname, '..', 'docs', 'data');

function yesterday() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return {
    y: d.getUTCFullYear(),
    m: String(d.getUTCMonth() + 1).padStart(2, '0'),
    day: String(d.getUTCDate()).padStart(2, '0'),
    iso: d.toISOString().slice(0, 10),
  };
}

async function fetchTopArticles() {
  const { y, m, day } = yesterday();
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${LANG}.wikipedia/all-access/${y}/${m}/${day}`;
  const res = await fetch(url, { headers: UA, timeout: 30000 });
  if (!res.ok) throw new Error(`pageviews HTTP ${res.status}`);
  const json = await res.json();
  const articles = json.items[0].articles;
  const skip = SKIP_PREFIXES[LANG];
  return articles.filter(a => !skip.some(prefix => a.article.startsWith(prefix)));
}

async function fetchSummary(title) {
  const encoded = encodeURIComponent(title).replace(/%2F/g, '/');
  const url = `https://${LANG}.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  const res = await fetch(url, { headers: UA, timeout: 20000 });
  if (!res.ok) return null;
  return res.json();
}

async function downloadAndProcessThumbnail(thumbUrl) {
  const res = await fetch(thumbUrl, { headers: UA, timeout: 30000 });
  if (!res.ok) throw new Error(`thumbnail HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  return sharp(buf)
    .grayscale()
    .resize(260, 480, { fit: 'cover', position: 'attention' })
    .normalise()
    .linear(1.3, -30)
    .png({ palette: true, colors: 2, dither: 1.0 })
    .toBuffer();
}

async function run() {
  const { iso } = yesterday();
  console.log(`[${LANG}] fetching top articles for ${iso}`);
  const clean = await fetchTopArticles();
  const top = clean.slice(0, 8);

  let thumbnailWritten = false;
  let topDescription = null;

  if (top.length > 0) {
    const topTitle = top[0].article;
    console.log(`[${LANG}] #1 -> ${topTitle}, fetching summary`);
    const summary = await fetchSummary(topTitle);
    if (summary) {
      topDescription = summary.description || null;
      if (summary.thumbnail && summary.thumbnail.source) {
        try {
          const png = await downloadAndProcessThumbnail(summary.thumbnail.source);
          fs.mkdirSync(OUT_IMG_DIR, { recursive: true });
          fs.writeFileSync(path.join(OUT_IMG_DIR, 'latest.png'), png);
          thumbnailWritten = true;
          console.log(`[${LANG}] thumbnail saved`);
        } catch (e) {
          console.warn(`[${LANG}] thumbnail failed: ${e.message}`);
        }
      } else {
        console.log(`[${LANG}] no thumbnail available for #1`);
      }
    }
  }

  fs.mkdirSync(OUT_DATA_DIR, { recursive: true });
  const data = {
    lang: LANG,
    date: iso,
    generated_at: new Date().toISOString(),
    has_thumbnail: thumbnailWritten,
    top_description: topDescription,
    articles: top.map((a, i) => ({
      rank: i + 1,
      title: a.article.replace(/_/g, ' '),
      views: a.views,
    })),
  };
  fs.writeFileSync(
    path.join(OUT_DATA_DIR, `${LANG}.json`),
    JSON.stringify(data, null, 2)
  );
  console.log(`[${LANG}] done -> ${top.length} articles, thumbnail=${thumbnailWritten}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
