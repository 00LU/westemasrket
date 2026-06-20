const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { listPendingUsers, listUsers, verifyUser, analytics, complianceStatus } = require('../controllers/adminController');

const router = express.Router();

router.use(auth, roleGuard(['admin']));
router.get('/users', listUsers);
router.get('/users/pending', listPendingUsers);
router.patch('/users/:userId/verify', verifyUser);
router.get('/analytics', analytics);
router.get('/compliance', complianceStatus);

module.exports = router;
