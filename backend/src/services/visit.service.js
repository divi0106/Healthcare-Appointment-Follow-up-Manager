const prisma = require('../config/prisma');
const { AppError } = require('../middleware/error');
const { generatePreVisitSummary, generatePostVisitSummary } = require('./llm.service');

const MAX_LLM_ATTEMPTS = 3;

async function submitSymptomForm({ appointmentId, rawSymptoms }) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) throw new AppError('Appointment not found', 404);
  const form = await prisma.symptomForm.upsert({
    where: { appointmentId },
    update: { rawSymptoms, summaryStatus: 'PENDING' },
    create: { appointmentId, rawSymptoms, summaryStatus: 'PENDING' },
  });
  await tryGeneratePreVisitSummary(form.id);
  return prisma.symptomForm.findUnique({ where: { id: form.id } });
}

async function tryGeneratePreVisitSummary(symptomFormId) {
  const form = await prisma.symptomForm.findUnique({ where: { id: symptomFormId } });
  if (!form || form.summaryStatus === 'READY') return;
  if (form.llmAttempts >= MAX_LLM_ATTEMPTS) return;
  try {
    const result = await generatePreVisitSummary(form.rawSymptoms);
    await prisma.symptomForm.update({
      where: { id: symptomFormId },
      data: {
        urgency: result.urgency,
        chiefComplaint: result.chiefComplaint,
        suggestedQuestions: result.suggestedQuestions,
        summaryStatus: 'READY',
        summaryError: null,
        llmAttempts: { increment: 1 },
      },
    });
  } catch (err) {
    await prisma.symptomForm.update({
      where: { id: symptomFormId },
      data: {
        summaryStatus: 'FAILED',
        summaryError: String(err.message || err).slice(0, 500),
        llmAttempts: { increment: 1 },
      },
    });
  }
}

async function submitPostVisitNotes({ appointmentId, doctorNotes, prescriptionItems }) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) throw new AppError('Appointment not found', 404);
  await prisma.$transaction([
    prisma.postVisitSummary.upsert({
      where: { appointmentId },
      update: { doctorNotes, summaryStatus: 'PENDING' },
      create: { appointmentId, doctorNotes, summaryStatus: 'PENDING' },
    }),
    prisma.prescription.upsert({
      where: { appointmentId },
      update: { items: prescriptionItems },
      create: { appointmentId, items: prescriptionItems },
    }),
    prisma.appointment.update({ where: { id: appointmentId }, data: { status: 'COMPLETED' } }),
  ]);
  const postVisit = await prisma.postVisitSummary.findUnique({ where: { appointmentId } });
  await tryGeneratePostVisitSummary(postVisit.id, appointmentId);
  return prisma.postVisitSummary.findUnique({ where: { id: postVisit.id } });
}

async function tryGeneratePostVisitSummary(postVisitId, appointmentId) {
  const pv = await prisma.postVisitSummary.findUnique({ where: { id: postVisitId } });
  if (!pv || pv.summaryStatus === 'READY') return;
  if (pv.llmAttempts >= MAX_LLM_ATTEMPTS) return;
  try {
    const result = await generatePostVisitSummary(pv.doctorNotes);
    await prisma.postVisitSummary.update({
      where: { id: postVisitId },
      data: {
        patientSummary: result.patientSummary,
        followUpSteps: result.followUpSteps,
        summaryStatus: 'READY',
        summaryError: null,
        llmAttempts: { increment: 1 },
      },
    });
    await scheduleMedicationReminders(appointmentId, result.medicationSchedule);
  } catch (err) {
    await prisma.postVisitSummary.update({
      where: { id: postVisitId },
      data: {
        summaryStatus: 'FAILED',
        summaryError: String(err.message || err).slice(0, 500),
        llmAttempts: { increment: 1 },
      },
    });
  }
}

async function scheduleMedicationReminders(appointmentId, medicationSchedule) {
  const prescription = await prisma.prescription.findUnique({ where: { appointmentId } });
  if (!prescription || !medicationSchedule?.length) return;
  const now = new Date();
  const reminders = [];
  for (const med of medicationSchedule) {
    const freq = Math.max(1, Number(med.frequencyPerDay) || 1);
    const days = Math.max(1, Number(med.durationDays) || 1);
    const intervalHours = 24 / freq;
    for (let day = 0; day < days; day += 1) {
      for (let dose = 0; dose < freq; dose += 1) {
        const scheduledFor = new Date(now.getTime() + (day * 24 + dose * intervalHours) * 3600000);
        reminders.push({ prescriptionId: prescription.id, drugName: med.drugName, scheduledFor });
      }
    }
  }
  if (reminders.length) await prisma.medicationReminder.createMany({ data: reminders });
}

async function retryStuckLLMSummaries() {
  const stuckPreVisit = await prisma.symptomForm.findMany({
    where: { summaryStatus: { in: ['PENDING', 'FAILED'] }, llmAttempts: { lt: MAX_LLM_ATTEMPTS } },
  });
  for (const form of stuckPreVisit) await tryGeneratePreVisitSummary(form.id);
  const stuckPostVisit = await prisma.postVisitSummary.findMany({
    where: { summaryStatus: { in: ['PENDING', 'FAILED'] }, llmAttempts: { lt: MAX_LLM_ATTEMPTS } },
  });
  for (const pv of stuckPostVisit) await tryGeneratePostVisitSummary(pv.id, pv.appointmentId);
  return { preVisitRetried: stuckPreVisit.length, postVisitRetried: stuckPostVisit.length };
}

module.exports = { submitSymptomForm, submitPostVisitNotes, retryStuckLLMSummaries };