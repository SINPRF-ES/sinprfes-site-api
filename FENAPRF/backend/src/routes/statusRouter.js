const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    origem: 'fenaprf-sistema-api',
    horario: new Date().toISOString()
  });
});

module.exports = router;
