const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validation');
const uuidParam = require('../middleware/uuidParam');
const c = require('../controllers/agreementController');
const photoController = require('../controllers/pickupPhotoController');

// Agreement on day/time: the only part of the flow shared by the three roles.
// Every handler checks that the caller is part of the selected package.
const router = express.Router();

router.param('id', uuidParam);
router.param('slotId', uuidParam);
router.param('photoId', uuidParam);

router.use(auth);
router.get('/:id/photos/:photoId', photoController.download);
router.post('/:id/slots', roleGuard(['producer', 'recipient', 'transporter']), validate(['scheduledAt']), c.proposeSlot);
router.post('/:id/slots/:slotId/accept', roleGuard(['producer', 'recipient', 'transporter']), c.acceptSlot);
router.post('/:id/cancel-offer', roleGuard(['recipient', 'transporter']), c.cancelOffer);
router.post('/:id/completion-confirmations', roleGuard(['producer', 'recipient', 'transporter']), c.confirmCompletion);

module.exports = router;
