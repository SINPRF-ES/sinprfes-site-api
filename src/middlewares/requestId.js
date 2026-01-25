const { v4: uuidv4 } = require('uuid');

module.exports = (req, res, next) => {
  req.requestId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.requestId);
  next();
};
