// Combines docs/data/<lang>.json files into a single docs/data/all.json.

const fs = require('fs');
const path = require('path');

const config = require('../config.json');
const DATA_DIR = path.join(__dirname, '..', 'docs', 'data');

const entries = [];
for (const lang of config.langs) {
  const file = path.join(DATA_DIR, `${lang}.json`);
  if (fs.existsSync(file)) {
    entries.push(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
}

fs.writeFileSync(
  path.join(DATA_DIR, 'all.json'),
  JSON.stringify(entries, null, 2)
);

console.log(`Wrote all.json with ${entries.length} entries`);
