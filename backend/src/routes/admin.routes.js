const express = require('express');
const ctrl = require('../controllers/admin.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('ADMIN'));

router.post('/doctors', ctrl.createDoctor);
router.get('/doctors', ctrl.listDoctors);

router.post('/doctors/:doctorId/leave', ctrl.markLeave);
router.get('/doctors/:doctorId/leave', ctrl.listLeave);
router.delete('/doctors/:doctorId/leave/:date', ctrl.removeLeave);

module.exports = router;