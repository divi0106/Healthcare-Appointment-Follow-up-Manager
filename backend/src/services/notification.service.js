const prisma = require('../config/prisma');
const { sendEmail } = require('./email.service');
const { applyCalendarAction } = require('./calendar.service');

const MAX_ATTEMPTS = 5;

async function queueNotification({ appointmentId, userId, type, channel, payload }) {
  return prisma.notification.create({
    data: { appointmentId, userId, type, channel, payload, status: 'PENDING' },
  });
}

async function processNotificationQueue(batchSize = 20) {
  const pending = await prisma.notification.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  const results = { sent: 0, failed: 0 };

  for (const note of pending) {
    try {
      if (note.channel === 'EMAIL') {
        await sendEmail(note.payload);
      } else if (note.channel === 'CALENDAR') {
        const eventId = await applyCalendarAction(note);
        if (note.payload.action === 'create' && eventId && note.appointmentId) {
          const field = note.payload.target === 'doctor' ? 'doctorCalendarEventId' : 'patientCalendarEventId';
          await prisma.appointment.update({
            where: { id: note.appointmentId },
            data: { [field]: eventId },
          });
        }
      }
      await prisma.notification.update({
        where: { id: note.id },
        data: { status: 'SENT', sentAt: new Date(), attempts: note.attempts + 1, lastError: null },
      });
      results.sent += 1;
    } catch (err) {
      await prisma.notification.update({
        where: { id: note.id },
        data: {
          status: 'FAILED',
          attempts: note.attempts + 1,
          lastError: String(err.message || err).slice(0, 500),
        },
      });
      results.failed += 1;
    }
  }
  return results;
}

module.exports = { queueNotification, processNotificationQueue };
