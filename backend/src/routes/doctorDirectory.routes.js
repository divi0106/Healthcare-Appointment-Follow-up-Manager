const express = require('express');
const ctrl = require('../controllers/doctorDirectory.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, ctrl.searchDoctors);
router.get('/:doctorId/availability', requireAuth, ctrl.getAvailability);

module.exports = router;