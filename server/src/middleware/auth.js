const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing token' });
    }

    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'change-this-secret');
    const user = await User.findByPk(decoded.sub);

    if (!user) {
      return res.status(401).json({ message: 'Invalid token subject' });
    }

    req.user = {
      id: user.id,
      role: user.role,
      verified: user.verified,
      premium: user.premiumFeaturesEnabled,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

module.exports = auth;
