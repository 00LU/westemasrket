const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { PickupPhoto, PickupRequest, RecipientAvailability, TransportProposal } = require('../models');
const { getPhotoDirectory, getPhotoPath } = require('../services/photoStorage');

const MIME_EXTENSIONS = {
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

function publicPhoto(photo) {
  return { id: photo.id, fileName: photo.fileName, mimeType: photo.mimeType };
}

async function upload(req, res, next) {
  let storageKey;
  try {
    const request = await PickupRequest.findOne({
      where: { id: req.params.id, producerId: req.user.id, status: 'draft' },
      attributes: ['id'],
    });
    if (!request) return res.status(404).json({ message: 'Bozza non trovata' });

    const mimeType = req.get('Content-Type')?.split(';')[0].trim().toLowerCase();
    const extension = MIME_EXTENSIONS[mimeType];
    if (!extension) return res.status(400).json({ message: 'Formato foto non supportato' });

    const idempotencyKey = req.get('Idempotency-Key');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey || '')) {
      return res.status(400).json({ message: 'Chiave idempotente foto non valida' });
    }

    const existing = await PickupPhoto.findOne({ where: { pickupRequestId: request.id, idempotencyKey } });
    if (existing) {
      req.resume();
      return res.status(200).json(publicPhoto(existing));
    }

    let fileName = req.get('X-File-Name') || 'foto.webp';
    try {
      fileName = path.basename(decodeURIComponent(fileName)).slice(0, 255) || 'foto.webp';
    } catch (error) {
      return res.status(400).json({ message: 'Nome file non valido' });
    }

    storageKey = `${randomUUID()}${extension}`;
    await fs.promises.mkdir(getPhotoDirectory(), { recursive: true });
    const output = fs.createWriteStream(getPhotoPath(storageKey), { flags: 'wx' });
    await pipeline(req, output);
    const stats = await fs.promises.stat(getPhotoPath(storageKey));
    if (stats.size === 0) {
      await fs.promises.unlink(getPhotoPath(storageKey));
      return res.status(400).json({ message: 'Il file foto è vuoto' });
    }

    const [photo, created] = await PickupPhoto.findOrCreate({
      where: { pickupRequestId: request.id, idempotencyKey },
      defaults: { pickupRequestId: request.id, idempotencyKey, storageKey, fileName, mimeType },
    });
    if (!created) await fs.promises.unlink(getPhotoPath(storageKey));
    return res.status(created ? 201 : 200).json(publicPhoto(photo));
  } catch (error) {
    if (storageKey) {
      await fs.promises.unlink(getPhotoPath(storageKey)).catch((unlinkError) => {
        if (unlinkError.code !== 'ENOENT') console.error('Unable to remove incomplete pickup photo', unlinkError);
      });
    }
    return next(error);
  }
}

async function download(req, res, next) {
  try {
    const photo = await PickupPhoto.findOne({
      where: { id: req.params.photoId, pickupRequestId: req.params.id },
    });
    if (!photo) return res.status(404).json({ message: 'Foto non trovata' });

    const request = await PickupRequest.findByPk(photo.pickupRequestId, { attributes: ['id', 'producerId'] });
    if (!request) return res.status(404).json({ message: 'Richiesta non trovata' });
    let allowed = req.user.role === 'admin' || request.producerId === req.user.id;
    if (!allowed && req.user.role === 'recipient') {
      allowed = Boolean(await RecipientAvailability.findOne({
        where: { pickupRequestId: request.id, recipientId: req.user.id },
        attributes: ['id'],
      }));
    }
    if (!allowed && req.user.role === 'transporter') {
      allowed = Boolean(await TransportProposal.findOne({
        where: { pickupRequestId: request.id, transporterId: req.user.id },
        attributes: ['id'],
      }));
    }
    if (!allowed) return res.status(404).json({ message: 'Foto non trovata' });

    const file = fs.createReadStream(getPhotoPath(photo.storageKey));
    file.on('error', next);
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(photo.fileName)}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return file.pipe(res);
  } catch (error) {
    return next(error);
  }
}

module.exports = { upload, download };
