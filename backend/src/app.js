require('express-async-errors');
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const doctorDirectoryRoutes = require('./routes/doctorDirectory.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const calendarRoutes = require('./routes/calendar.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctors', doctorDirectoryRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/calendar', calendarRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;