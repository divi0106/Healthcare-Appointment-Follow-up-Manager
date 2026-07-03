const express = require('express');
const ctrl = require('../controllers/appointment.controller');
const visitCtrl = require('../controllers/visit.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', ctrl.listMyAppointments);
router.post('/hold', requireRole('PATIENT'), ctrl.holdSlot);
router.post('/:id/confirm', requireRole('PATIENT'), ctrl.confirmAppointment);
router.post('/:id/cancel', ctrl.cancelAppointment);

router.post('/:appointmentId/symptom-form', requireRole('PATIENT'), visitCtrl.submitSymptomForm);
router.post('/:appointmentId/post-visit', requireRole('DOCTOR'), visitCtrl.submitPostVisitNotes);

module.exports = router;