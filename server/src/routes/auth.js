const express = require('express');
const validate = require('../middleware/validation');
const { register, login } = require('../controllers/authController');

const router = express.Router();

router.post('/register', validate(['role', 'companyName', 'piva', 'email', 'password']), register);
router.post('/login', validate(['email', 'password']), login);

module.exports = router;
