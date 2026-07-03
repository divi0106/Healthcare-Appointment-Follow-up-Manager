const prisma = require('../config/prisma');
const { AppError } = require('../middleware/error');
const { queueNotification } = require('./notification.service');

async function markLeave({ doctorId, date, reason }) {
  const dateOnly = new Date(new Date(date).toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const dayEnd = new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000 - 1);

  const leave = await prisma.leaveDay.upsert({
    where: { doctorId_date: { doctorId, date: dateOnly } },
    update: { reason },
    create: { doctorId, date: dateOnly, reason },
  });

  const affected = await prisma.appointment.findMany({
    where: {
      doctorId,
      slotStart: { gte: dateOnly, lte: dayEnd },
      status: 'CONFIRMED',
    },
    include: { patient: true, doctor: { include: { user: true } } },
  });

  for (const appt of affected) {
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: 'NEEDS_RESCHEDULE' },
    });
    await queueNotification({
      appointmentId: appt.id,
      userId: appt.patientId,
      type: 'RESCHEDULE_NEEDED',
      channel: 'EMAIL',
      payload: {
        to: appt.patient.email,
        subject: 'Your appointment needs to be rescheduled',
        body:
          `Dr. ${appt.doctor.user.name} is unavailable on ` +
          `${appt.slotStart.toDateString()}${reason ? ` (${reason})` : ''}. ` +
          `Please log in to book a new slot.`,
      },
    });
  }
  return { leave, affectedCount: affected.length };
}

async function removeLeave({ doctorId, date }) {
  const dateOnly = new Date(new Date(date).toISOString().slice(0, 10) + 'T00:00:00.000Z');
  return prisma.leaveDay.deleteMany({ where: { doctorId, date: dateOnly } });
}

async function listLeave(doctorId) {
  return prisma.leaveDay.findMany({ where: { doctorId }, orderBy: { date: 'asc' } });
}

module.exports = { markLeave, removeLeave, listLeave };