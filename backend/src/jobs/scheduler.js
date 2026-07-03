const cron = require('node-cron');
const { releaseExpiredHolds } = require('../services/booking.service');
const { processNotificationQueue } = require('../services/notification.service');
const { retryStuckLLMSummaries } = require('../services/visit.service');
const { sendDueMedicationReminders } = require('./medicationReminders.job');

function startScheduler() {
  cron.schedule('* * * * *', async () => {
    const count = await releaseExpiredHolds().catch((e) => {
      console.error('[job:releaseExpiredHolds]', e.message);
      return 0;
    });
    if (count) console.log(`[job:releaseExpiredHolds] released ${count} expired hold(s)`);
  });

  cron.schedule('* * * * *', async () => {
    const result = await processNotificationQueue().catch((e) => {
      console.error('[job:processNotificationQueue]', e.message);
      return null;
    });
    if (result && (result.sent || result.failed)) {
      console.log(`[job:processNotificationQueue] sent=${result.sent} failed=${result.failed}`);
    }
  });

  cron.schedule('*/5 * * * *', async () => {
    await retryStuckLLMSummaries().catch((e) =>
      console.error('[job:retryStuckLLMSummaries]', e.message)
    );
  });

  cron.schedule('*/5 * * * *', async () => {
    const count = await sendDueMedicationReminders().catch((e) => {
      console.error('[job:sendDueMedicationReminders]', e.message);
      return 0;
    });
    if (count) console.log(`[job:sendDueMedicationReminders] queued ${count} reminder(s)`);
  });

  console.log('Background scheduler started.');
}

module.exports = { startScheduler };