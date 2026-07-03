const { z } = require('zod');
const prisma = require('../config/prisma');
const { hashPassword } = require('../utils/auth');
const { AppError } = require('../middleware/error');
const leaveService = require('../services/leave.service');

const createDoctorSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  specialisation: z.string().min(2),
  slotDurationMin: z.number().int().min(5).max(180).default(30),
  workingHours: z.record(z.tuple([z.string(), z.string()])),
});

async function createDoctor(req, res) {
  const data = createDoctorSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError('An account with this email already exists', 409);
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialisation: data.specialisation,
          slotDurationMin: data.slotDurationMin,
          workingHours: data.workingHours,
        },
      },
    },
    include: { doctorProfile: true },
  });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, doctorProfile: user.doctorProfile });
}

async function listDoctors(req, res) {
  const doctors = await prisma.doctorProfile.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json(doctors);
}

const leaveSchema = z.object({
  date: z.string(),
  reason: z.string().optional(),
});

async function markLeave(req, res) {
  const data = leaveSchema.parse(req.body);
  const result = await leaveService.markLeave({
    doctorId: req.params.doctorId,
    date: data.date,
    reason: data.reason,
  });
  res.status(201).json({
    leave: result.leave,
    affectedAppointments: result.affectedCount,
    message:
      result.affectedCount > 0
        ? `${result.affectedCount} patient(s) notified.`
        : 'Leave day recorded. No existing bookings affected.',
  });
}

async function removeLeave(req, res) {
  await leaveService.removeLeave({ doctorId: req.params.doctorId, date: req.params.date });
  res.status(204).send();
}

async function listLeave(req, res) {
  const leave = await leaveService.listLeave(req.params.doctorId);
  res.json(leave);
}

module.exports = { createDoctor, listDoctors, markLeave, removeLeave, listLeave };