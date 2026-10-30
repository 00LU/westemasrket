const { ProductionSite } = require('../models');

async function list(req, res, next) {
  try {
    const sites = await ProductionSite.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'ASC']],
    });
    return res.json(sites);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const { label, addressFormatted, lat, lng, placeId } = req.body;
    if (!String(addressFormatted || '').trim()) {
      return res.status(400).json({ message: 'Indirizzo della sede obbligatorio' });
    }
    const site = await ProductionSite.create({
      userId: req.user.id,
      label: label ? String(label).trim() : null,
      addressFormatted: String(addressFormatted).trim(),
      lat: lat ?? null,
      lng: lng ?? null,
      placeId: placeId || null,
    });
    return res.status(201).json(site);
  } catch (error) {
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const removed = await ProductionSite.destroy({ where: { id: req.params.siteId, userId: req.user.id } });
    if (!removed) return res.status(404).json({ message: 'Sede non trovata' });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

module.exports = { list, create, remove };
