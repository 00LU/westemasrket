const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET || 'change-this-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
}

async function register(req, res, next) {
  try {
    const { role, companyName, piva, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      role,
      companyName,
      piva,
      email,
      passwordHash,
      verified: role === 'producer' ? true : false,
    });

    return res.status(201).json({
      user: {
        id: user.id,
        role: user.role,
        companyName: user.companyName,
        email: user.email,
      },
      token: signToken(user),
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    return res.json({
      token: signToken(user),
      user: {
        id: user.id,
        role: user.role,
        companyName: user.companyName,
        email: user.email,
        verified: user.verified,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
};
