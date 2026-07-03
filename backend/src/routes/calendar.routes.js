const express = require('express');
const ctrl = require('../controllers/calendar.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/oauth/connect', requireAuth, ctrl.connect);
router.get('/oauth/callback', ctrl.callback);

module.exports = router;