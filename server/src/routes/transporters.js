const express = require('express');
const auth = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validation');
const {
  getNotificationsFeed,
  acceptTransportSelection,
  getActiveJobs,
  updateJobStatus,
  getEarnings,
} = require('../controllers/transporterController');

const router = express.Router();

router.use(auth, roleGuard(['transporter']));
router.get('/notifications', getNotificationsFeed);
router.patch('/waste-requests/:id/accept-selection', acceptTransportSelection);
router.get('/jobs', getActiveJobs);
router.patch('/waste-requests/:id/status', validate(['status']), updateJobStatus);
router.get('/earnings', getEarnings);

module.exports = router;
