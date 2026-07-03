const { google } = require('googleapis');
const prisma = require('../config/prisma');
const env = require('../config/env');

function getOAuthClient() {
  return new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.googleRedirectUri
  );
}

function getAuthUrl(state) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
  });
}

async function handleOAuthCallback(code, userId) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleRefreshToken: tokens.refresh_token || undefined,
      googleAccessToken: tokens.access_token,
      googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });
}

async function getAuthedClientForUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.googleRefreshToken) return null;
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: user.googleRefreshToken });
  return client;
}

async function createEventForUser(userId, { summary, description, start, end }) {
  const client = await getAuthedClientForUser(userId);
  if (!client) return null;
  const calendar = google.calendar({ version: 'v3', auth: client });
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary,
      description,
      start: { dateTime: start },
      end: { dateTime: end },
      reminders: { useDefault: true },
    },
  });
  return res.data.id;
}

async function updateEventForUser(userId, eventId, { summary, description, start, end }) {
  const client = await getAuthedClientForUser(userId);
  if (!client || !eventId) return;
  const calendar = google.calendar({ version: 'v3', auth: client });
  await calendar.events.patch({
    calendarId: 'primary',
    eventId,
    requestBody: {
      summary,
      description,
      start: start ? { dateTime: start } : undefined,
      end: end ? { dateTime: end } : undefined,
    },
  });
}

async function deleteEventForUser(userId, eventId) {
  const client = await getAuthedClientForUser(userId);
  if (!client || !eventId) return;
  const calendar = google.calendar({ version: 'v3', auth: client });
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (err) {
    if (err.code !== 410 && err.code !== 404) throw err;
  }
}

async function applyCalendarAction(notification) {
  const { payload, userId } = notification;
  if (payload.action === 'create') return createEventForUser(userId, payload.event);
  if (payload.action === 'update') return updateEventForUser(userId, payload.eventId, payload.event);
  if (payload.action === 'delete') return deleteEventForUser(userId, payload.eventId);
  throw new Error(`Unknown calendar action: ${payload.action}`);
}

module.exports = {
  getAuthUrl,
  handleOAuthCallback,
  createEventForUser,
  updateEventForUser,
  deleteEventForUser,
  applyCalendarAction,
};
