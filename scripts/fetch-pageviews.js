// Fetches yesterday's top-viewed Wikipedia articles for one language edition,
// filters out non-article pages, and enriches each article with:
//   - percent change in views vs the previous day
//   - a 7-day view history, pre-normalised into SVG polyline points
// Also downloads a thumbnail for the #1 article if one exists.
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

// Wikimedia requires a descriptive User-Agent with contact details.
// A vague UA gets HTTP 429 rate limiting.
const UA = {
  'User-Agent':
    'trmnl-wiki-pageviews/1.0 (https://github.com/nbbou81000/trmnl-wiki-pageviews; nb.bouteiller@gmail.com)',
};

const TOP_COUNT = 30;         // articles fetched (trends mode shows all, image mode limits in Liquid)
const COMPARE_DEPTH = 50;     // how deep to look in yesterday's list for rank/view deltas
const HISTORY_DAYS = 7;       // sparkline window
const SPARK_W = 100;          // sparkline viewBox width
const SPARK_H = 24;           // sparkline viewBox height

const OUT_IMG_DIR = path.join(__dirname, '..', 'docs', 'images', LANG);
const OUT_DATA_DIR = path.join(__dirname, '..', 'docs', 'data');

function dayOffset(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return {
    y: d.getUTCFullYear(),
    m: String(d.getUTCMonth() + 1).padStart(2, '0'),
    day: String(d.getUTCDate()).padStart(2, '0'),
    iso: d.toISOString().slice(0, 10),
    compact: d.toISOString().slice(0, 10).replace(/-/g, ''),
  };
}

async function getJson(url) {
  const res = await fetch(url, { headers: UA, timeout: 30000 });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchTopArticles(offsetDays) {
  const { y, m, day } = dayOffset(offsetDays);
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${LANG}.wikipedia/all-access/${y}/${m}/${day}`;
  const json = await getJson(url);
  const articles = json.items[0].articles;
  const skip = SKIP_PREFIXES[LANG];
  return articles.filter(a => !skip.some(prefix => a.article.startsWith(prefix)));
}

async function fetchHistory(title) {
  const start = dayOffset(HISTORY_DAYS).compact;
  const end = dayOffset(1).compact;
  const enc = encodeURIComponent(title);
  const url =
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/` +
    `${LANG}.wikipedia/all-access/all-agents/${enc}/daily/${start}/${end}`;
  const json = await getJson(url);
  return json.items.map(it => it.views);
}

// Turn a series of view counts into SVG bar rectangles, normalised to the
// SPARK_W x SPARK_H box. Every bar keeps a minimum height so that low days
// stay visible as a baseline tick rather than vanishing. Flat series render
// as bars of equal mid height rather than dividing by zero.
function toSparklineBars(values) {
  if (!values || values.length < 2) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  const gap = 2;
  const barW = (SPARK_W - gap * (values.length - 1)) / values.length;
  const minH = 2;

  return values.map((v, i) => {
    const ratio = range === 0 ? 0.5 : (v - min) / range;
    const h = Math.max(minH, Math.round(ratio * SPARK_H));
    return {
      x: Math.round(i * (barW + gap) * 100) / 100,
      y: SPARK_H - h,
      w: Math.round(barW * 100) / 100,
      h,
    };
  });
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Thousands separators differ by locale: 434,567 in English, 434 567 in
// French, 434.567 in German and Spanish.
const NUMBER_LOCALE = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

function formatNumber(n) {
  return n
    .toLocaleString(NUMBER_LOCALE[LANG] || 'en-US')
    .replace(/\u202f|\u00a0/g, ' ');
}

async function run() {
  const { iso } = dayOffset(1);
  console.log(`[${LANG}] fetching top articles for ${iso}`);
  const clean = await fetchTopArticles(1);
  const top = clean.slice(0, TOP_COUNT);

  // Previous day, looked at more deeply so we can still place an article
  // that was ranked well below today's cut-off.
  let prevMap = new Map();
  try {
    const prev = await fetchTopArticles(2);
    prev.slice(0, COMPARE_DEPTH).forEach((a, i) => {
      prevMap.set(a.article, { rank: i + 1, views: a.views });
    });
    console.log(`[${LANG}] previous day: ${prevMap.size} articles for comparison`);
  } catch (e) {
    console.warn(`[${LANG}] previous day unavailable: ${e.message}`);
  }

  // 7-day history per article, sequentially with a small delay to stay
  // well inside Wikimedia's rate limits.
  const histories = [];
  for (const a of top) {
    try {
      const values = await fetchHistory(a.article);
      histories.push(values);
    } catch (e) {
      console.warn(`[${LANG}] history failed for ${a.article}: ${e.message}`);
      histories.push(null);
    }
    await sleep(150);
  }

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

  const articles = top.map((a, i) => {
    const prev = prevMap.get(a.article);
    let changePct = null;
    let isNew = true;
    if (prev && prev.views > 0) {
      changePct = Math.round(((a.views - prev.views) / prev.views) * 100);
      isNew = false;
    }
    const history = histories[i];
    return {
      rank: i + 1,
      title: a.article.replace(/_/g, ' '),
      views: a.views,
      views_label: formatNumber(a.views),
      is_new: isNew,
      change_pct: changePct,
      change_abs: changePct === null ? null : Math.abs(changePct),
      change_sign: changePct === null ? '' : (changePct > 0 ? '+' : (changePct < 0 ? '-' : '')),
      history: history || [],
      sparkline_bars: history ? toSparklineBars(history) : [],
    };
  });

  // Summary band: cumulative views and the sharpest riser of the day.
  const totalViews = articles.reduce((sum, a) => sum + a.views, 0);
  const risers = articles.filter(a => !a.is_new && a.change_pct !== null);
  risers.sort((a, b) => b.change_pct - a.change_pct);
  const topRiser = risers.length > 0 ? risers[0] : null;

  fs.mkdirSync(OUT_DATA_DIR, { recursive: true });
  const data = {
    lang: LANG,
    date: iso,
    generated_at: new Date().toISOString(),
    has_thumbnail: thumbnailWritten,
    top_description: topDescription,
    spark_width: SPARK_W,
    spark_height: SPARK_H,
    total_views: totalViews,
    total_views_label: formatNumber(totalViews),
    top_riser_title: topRiser ? topRiser.title : null,
    top_riser_pct: topRiser ? topRiser.change_pct : null,
    articles,
  };
  fs.writeFileSync(
    path.join(OUT_DATA_DIR, `${LANG}.json`),
    JSON.stringify(data, null, 2)
  );
  console.log(
    `[${LANG}] done -> ${articles.length} articles, thumbnail=${thumbnailWritten}`
  );
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
