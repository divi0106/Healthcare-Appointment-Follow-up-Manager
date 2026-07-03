const prisma = require('../config/prisma');
const { AppError } = require('../middleware/error');
const env = require('../config/env');
const { generateCandidateSlots } = require('../utils/slots');

async function getAvailableSlots(doctorId, dateStr) {
  const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
  if (!doctor) throw new AppError('Doctor not found', 404);

  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

  const onLeave = await prisma.leaveDay.findUnique({
    where: { doctorId_date: { doctorId, date: dayStart } },
  });
  if (onLeave) return { available: [], onLeave: true };

  const candidates = generateCandidateSlots(doctor, dateStr);
  if (candidates.length === 0) return { available: [], onLeave: false };

  const taken = await prisma.appointment.findMany({
    where: {
      doctorId,
      slotStart: { gte: dayStart, lte: dayEnd },
      OR: [
        { status: 'CONFIRMED' },
        { status: 'HELD', holdExpiresAt: { gt: new Date() } },
      ],
    },
    select: { slotStart: true },
  });
  const takenTimes = new Set(taken.map((t) => t.slotStart.getTime()));
  const available = candidates.filter((s) => !takenTimes.has(s.getTime()));
  return { available, onLeave: false };
}

async function holdSlot({ patientId, doctorId, slotStart }) {
  const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
  if (!doctor) throw new AppError('Doctor not found', 404);

  const slotStartDate = new Date(slotStart);
  const slotEndDate = new Date(slotStartDate.getTime() + doctor.slotDurationMin * 60000);
  const dateOnly = new Date(slotStartDate.toISOString().slice(0, 10) + 'T00:00:00.000Z');

  const onLeave = await prisma.leaveDay.findUnique({
    where: { doctorId_date: { doctorId, date: dateOnly } },
  });
  if (onLeave) throw new AppError('Doctor is on leave on this date', 409);

  const holdExpiresAt = new Date(Date.now() + env.slotHoldMinutes * 60000);

  const appointment = await prisma.$transaction(async (tx) => {
    await tx.appointment.deleteMany({
      where: {
        doctorId,
        slotStart: slotStartDate,
        status: 'HELD',
        holdExpiresAt: { lt: new Date() },
      },
    });
    return tx.appointment.create({
      data: {
        patientId,
        doctorId,
        slotStart: slotStartDate,
        slotEnd: slotEndDate,
        status: 'HELD',
        holdExpiresAt,
      },
    });
  });
  return appointment;
}

async function confirmAppointment({ appointmentId, patientId }) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt || appt.patientId !== patientId) throw new AppError('Appointment not found', 404);
  if (appt.status !== 'HELD') throw new AppError(`Cannot confirm appointment in status ${appt.status}`, 409);
  if (appt.holdExpiresAt && appt.holdExpiresAt < new Date()) {
    await prisma.appointment.delete({ where: { id: appointmentId } });
    throw new AppError('Your hold on this slot expired. Please select a slot again.', 410);
  }
  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CONFIRMED', holdExpiresAt: null },
  });
}

async function releaseExpiredHolds() {
  const result = await prisma.appointment.deleteMany({
    where: { status: 'HELD', holdExpiresAt: { lt: new Date() } },
  });
  return result.count;
}

async function cancelAppointment({ appointmentId, requestedBy }) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) throw new AppError('Appointment not found', 404);
  if (!['CONFIRMED', 'NEEDS_RESCHEDULE'].includes(appt.status)) {
    throw new AppError(`Cannot cancel appointment in status ${appt.status}`, 409);
  }
  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CANCELLED' },
  });
}

module.exports = {
  getAvailableSlots,
  holdSlot,
  confirmAppointment,
  releaseExpiredHolds,
  cancelAppointment,
};
