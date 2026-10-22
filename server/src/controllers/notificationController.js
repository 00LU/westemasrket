const { Notification } = require('../models');

async function listNotifications(req, res, next) {
  try {
    const rows = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    const unread = await Notification.count({ where: { userId: req.user.id, read: false } });
    return res.json({
      unread,
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        payload: row.payloadJson,
        read: row.read,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return next(error);
  }
}

async function markRead(req, res, next) {
  try {
    await Notification.update({ read: true }, { where: { id: req.params.id, userId: req.user.id } });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

async function markAllRead(req, res, next) {
  try {
    await Notification.update({ read: true }, { where: { userId: req.user.id, read: false } });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listNotifications, markRead, markAllRead };
