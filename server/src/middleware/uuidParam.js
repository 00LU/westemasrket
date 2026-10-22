const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Used with router.param: malformed ids are a plain 404 instead of a database error.
function uuidParam(req, res, next, value) {
  if (!UUID_RE.test(value)) {
    return res.status(404).json({ message: 'Risorsa non trovata' });
  }
  return next();
}

module.exports = uuidParam;
