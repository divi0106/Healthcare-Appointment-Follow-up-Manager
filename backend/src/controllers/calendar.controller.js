const calendarService = require('../services/calendar.service');
const env = require('../config/env');

async function connect(req, res) {
  const url = calendarService.getAuthUrl(req.user.id);
  res.redirect(url);
}

async function callback(req, res) {
  const { code, state } = req.query;
  if (!code || !state) return res.redirect(`${env.frontendUrl}/calendar/error`);
  await calendarService.handleOAuthCallback(code, state);
  res.redirect(`${env.frontendUrl}/calendar/connected`);
}

module.exports = { connect, callback };