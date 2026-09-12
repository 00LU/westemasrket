const express = require('express');
const catalog = require('../data/cerCatalog.json');

const router = express.Router();

router.get('/', (req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase().replace(/\s+/g, '');
  const hazardous = req.query.hazardous;
  const matchingItems = catalog.items
    .filter((item) => !query || item.code.toLowerCase().replace(/\s+/g, '').includes(query) || item.description.toLowerCase().includes(query))
    .filter((item) => hazardous === undefined || item.hazardous === (hazardous === 'true'))
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const items = matchingItems.slice(offset, offset + limit);

  return res.json({ sourceUrl: catalog.sourceUrl, sourceDate: catalog.sourceDate, total: matchingItems.length, items });
});

module.exports = router;
