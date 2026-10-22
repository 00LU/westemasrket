const express = require('express');
const auth = require('../middleware/auth');
const uuidParam = require('../middleware/uuidParam');
const { listNotifications, markRead, markAllRead } = require('../controllers/notificationController');

const router = express.Router();

router.param('id', uuidParam);

router.use(auth);
router.get('/', listNotifications);
router.post('/read-all', markAllRead);
router.patch('/:id/read', markRead);

module.exports = router;
