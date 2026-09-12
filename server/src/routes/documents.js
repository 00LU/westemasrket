const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { listUserDocuments, getUserDocumentRequirements, uploadDocument, approveDocument, rejectDocument } = require('../controllers/documentController');

const router = express.Router();

router.use(auth);
router.get('/requirements', getUserDocumentRequirements);
router.get('/', listUserDocuments);
router.post('/', uploadDocument);
router.patch('/:id/approve', roleGuard(['admin']), approveDocument);
router.patch('/:id/reject', roleGuard(['admin']), rejectDocument);

module.exports = router;
