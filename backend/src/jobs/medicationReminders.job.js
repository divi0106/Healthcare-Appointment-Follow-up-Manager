const prisma = require('../config/prisma');
const { queueNotification } = require('../services/notification.service');

async function sendDueMedicationReminders() {
  const due = await prisma.medicationReminder.findMany({
    where: { sent: false, scheduledFor: { lte: new Date() } },
    include: {
      prescription: {
        include: { appointment: { include: { patient: true } } },
      },
    },
    take: 100,
  });

  for (const reminder of due) {
    const patient = reminder.prescription.appointment.patient;
    await queueNotification({
      appointmentId: reminder.prescription.appointment.id,
      userId: patient.id,
      type: 'MEDICATION_REMINDER',
      channel: 'EMAIL',
      payload: {
        to: patient.email,
        subject: `Medication reminder: ${reminder.drugName}`,
        body: `Hi ${patient.name}, this is a reminder to take your dose of ${reminder.drugName} as prescribed.`,
      },
    });
    await prisma.medicationReminder.update({
      where: { id: reminder.id },
      data: { sent: true, sentAt: new Date() },
    });
  }
  return due.length;
}

module.exports = { sendDueMedicationReminders };