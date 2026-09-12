const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const SOURCE_URL = 'https://www.albonazionalegestoriambientali.it/download/it/normativanazionale/013-dlgsa152_03.04.2006_alldparteiv_agg.pdf';
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'cerCatalog.json');

function parseCatalog(text) {
  const records = [];
  const normalizedText = text
    .replace(/\r/g, '')
    .replace(/(\d{2})\.\s+(\d{2})/g, '$1 $2');
  const marker = /(?:^|\n)\s*(\d{2})\s+(\d{2})\s+(\d{2})\s*(\*)?\s+/g;
  const matches = [...normalizedText.matchAll(marker)];

  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : normalizedText.length;
    const description = normalizedText.slice(start, end)
      .replace(/-- \d+ of \d+ --/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!description || /^ELENCO CODICI CER/i.test(description)) return;

    records.push({
      code: `${match[1]} ${match[2]} ${match[3]}${match[4] ? '*' : ''}`,
      description,
      hazardous: Boolean(match[4]),
      chapter: match[1],
    });
  });

  return records.filter((record, index, list) => list.findIndex((item) => item.code === record.code) === index);
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Unable to download source PDF: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  const catalog = parseCatalog(result.text);
  if (catalog.length < 500) throw new Error(`Unexpected catalog size: ${catalog.length}`);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify({ sourceUrl: SOURCE_URL, sourceDate: '2021-06-01', count: catalog.length, items: catalog }, null, 2)}\n`);
  console.log(`Exported ${catalog.length} CER/EER codes to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
