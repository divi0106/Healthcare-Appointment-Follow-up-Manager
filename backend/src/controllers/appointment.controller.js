const { z } = require('zod');
const prisma = require('../config/prisma');
const { AppError } = require('../middleware/error');
const bookingService = require('../services/booking.service');
const { queueNotification } = require('../services/notification.service');

const holdSchema = z.object({
  doctorId: z.string().uuid(),
  slotStart: z.string(),
});

async function holdSlot(req, res) {
  const data = holdSchema.parse(req.body);
  const appt = await bookingService.holdSlot({
    patientId: req.user.id,
    doctorId: data.doctorId,
    slotStart: data.slotStart,
  });
  res.status(201).json(appt);
}

async function confirmAppointment(req, res) {
  const appt = await bookingService.confirmAppointment({
    appointmentId: req.params.id,
    patientId: req.user.id,
  });
  const full = await prisma.appointment.findUnique({
    where: { id: appt.id },
    include: { patient: true, doctor: { include: { user: true } } },
  });
  const startStr = full.slotStart.toLocaleString();
  await queueNotification({
    appointmentId: full.id,
    userId: full.patientId,
    type: 'BOOKING_CONFIRMATION',
    channel: 'EMAIL',
    payload: {
      to: full.patient.email,
      subject: 'Appointment confirmed',
      body: `Hi ${full.patient.name}, your appointment with Dr. ${full.doctor.user.name} on ${startStr} is confirmed.`,
    },
  });
  await queueNotification({
    appointmentId: full.id,
    userId: full.doctor.userId,
    type: 'BOOKING_CONFIRMATION',
    channel: 'EMAIL',
    payload: {
      to: full.doctor.user.email,
      subject: 'New appointment booked',
      body: `Hi Dr. ${full.doctor.user.name}, ${full.patient.name} booked a slot with you on ${startStr}.`,
    },
  });
  await queueNotification({
    appointmentId: full.id,
    userId: full.patientId,
    type: 'BOOKING_CONFIRMATION',
    channel: 'CALENDAR',
    payload: {
      action: 'create',
      target: 'patient',
      appointmentId: full.id,
      event: {
        summary: `Appointment with Dr. ${full.doctor.user.name}`,
        description: 'Booked via Healthcare Appointment Manager',
        start: full.slotStart.toISOString(),
        end: full.slotEnd.toISOString(),
      },
    },
  });
  await queueNotification({
    appointmentId: full.id,
    userId: full.doctor.userId,
    type: 'BOOKING_CONFIRMATION',
    channel: 'CALENDAR',
    payload: {
      action: 'create',
      target: 'doctor',
      appointmentId: full.id,
      event: {
        summary: `Appointment with ${full.patient.name}`,
        description: 'Booked via Healthcare Appointment Manager',
        start: full.slotStart.toISOString(),
        end: full.slotEnd.toISOString(),
      },
    },
  });
  res.json(full);
}

async function cancelAppointment(req, res) {
  const appt = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: { patient: true, doctor: { include: { user: true } } },
  });
  if (!appt) throw new AppError('Appointment not found', 404);
  const isOwner = appt.patientId === req.user.id || appt.doctor.userId === req.user.id;
  if (!isOwner && req.user.role !== 'ADMIN') throw new AppError('Not authorized', 403);
  const cancelled = await bookingService.cancelAppointment({
    appointmentId: req.params.id,
    requestedBy: req.user.id,
  });
  await queueNotification({
    appointmentId: appt.id,
    userId: appt.patientId,
    type: 'CANCELLATION',
    channel: 'EMAIL',
    payload: {
      to: appt.patient.email,
      subject: 'Appointment cancelled',
      body: `Hi ${appt.patient.name}, your appointment with Dr. ${appt.doctor.user.name} on ${appt.slotStart.toLocaleString()} has been cancelled.`,
    },
  });
  res.json(cancelled);
}

async function listMyAppointments(req, res) {
  const where =
    req.user.role === 'DOCTOR'
      ? { doctor: { userId: req.user.id } }
      : { patientId: req.user.id };
  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { id: true, name: true, email: true } },
      doctor: { include: { user: { select: { id: true, name: true } } } },
      symptomForm: true,
      postVisit: true,
      prescription: true,
    },
    orderBy: { slotStart: 'desc' },
  });
  res.json(appointments);
}

module.exports = { holdSlot, confirmAppointment, cancelAppointment, listMyAppointments };