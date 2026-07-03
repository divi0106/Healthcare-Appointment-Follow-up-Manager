const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtpHost || !env.smtpUser) {
    transporter = {
      sendMail: async (opts) => {
        console.warn('[email] SMTP not configured — would have sent:', opts.subject, '->', opts.to);
        throw new Error('SMTP not configured');
      },
    };
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
  return transporter;
}

async function sendEmail({ to, subject, body }) {
  const t = getTransporter();
  await t.sendMail({
    from: env.emailFrom,
    to,
    subject,
    text: body,
    html: `<p>${String(body).replace(/\n/g, '<br/>')}</p>`,
  });
}

module.exports = { sendEmail };
