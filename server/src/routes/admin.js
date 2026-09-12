const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { listPendingUsers, listUsers, verifyUser, analytics, complianceStatus, listCerRecognitionRequests, proposeCerCode } = require('../controllers/adminController');
const { listPendingDocuments, approveDocument, rejectDocument } = require('../controllers/documentController');

const router = express.Router();

router.use(auth, roleGuard(['admin']));
router.get('/users', listUsers);
router.get('/users/pending', listPendingUsers);
router.patch('/users/:userId/verify', verifyUser);
router.get('/analytics', analytics);
router.get('/compliance', complianceStatus);
router.get('/documents/pending', listPendingDocuments);
router.get('/cer-recognition', listCerRecognitionRequests);
router.patch('/cer-recognition/:id/propose', proposeCerCode);
router.patch('/documents/:id/approve', approveDocument);
router.patch('/documents/:id/reject', rejectDocument);

module.exports = router;
