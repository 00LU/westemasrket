const express = require('express');
const validate = require('../middleware/validation');
const auth = require('../middleware/auth');
const { register, login, getCurrentUser } = require('../controllers/authController');

const router = express.Router();

router.post('/register', validate(['role', 'companyName', 'piva', 'email', 'password']), register);
router.post('/login', validate(['email', 'password']), login);
router.get('/me', auth, getCurrentUser);

module.exports = router;
