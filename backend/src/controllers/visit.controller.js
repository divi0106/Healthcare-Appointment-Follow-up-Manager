const { z } = require('zod');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/error');
const visitService = require('../services/visit.service');

const symptomSchema = z.object({ rawSymptoms: z.string().min(5).max(4000) });

async function submitSymptomForm(req, res) {
  const data = symptomSchema.parse(req.body);
  const appt = await prisma.appointment.findUnique({ where: { id: req.params.appointmentId } });
  if (!appt) throw new AppError('Appointment not found', 404);
  if (appt.patientId !== req.user.id) throw new AppError('Not your appointment', 403);
  const form = await visitService.submitSymptomForm({
    appointmentId: req.params.appointmentId,
    rawSymptoms: data.rawSymptoms,
  });
  res.status(201).json(form);
}

const postVisitSchema = z.object({
  doctorNotes: z.string().min(5).max(8000),
  prescriptionItems: z.array(
    z.object({
      drugName: z.string(),
      dosage: z.string(),
      frequencyPerDay: z.number().int().min(1).max(6),
      durationDays: z.number().int().min(1).max(180),
      instructions: z.string().optional().default(''),
    })
  ),
});

async function submitPostVisitNotes(req, res) {
  const data = postVisitSchema.parse(req.body);
  const appt = await prisma.appointment.findUnique({
    where: { id: req.params.appointmentId },
    include: { doctor: true },
  });
  if (!appt) throw new AppError('Appointment not found', 404);
  if (appt.doctor.userId !== req.user.id) throw new AppError('Not your appointment', 403);
  const summary = await visitService.submitPostVisitNotes({
    appointmentId: req.params.appointmentId,
    doctorNotes: data.doctorNotes,
    prescriptionItems: data.prescriptionItems,
  });
  res.status(201).json(summary);
}

module.exports = { submitSymptomForm, submitPostVisitNotes };