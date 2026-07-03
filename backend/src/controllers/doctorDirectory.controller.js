const prisma = require('../config/prisma');
const bookingService = require('../services/booking.service');

async function searchDoctors(req, res) {
  const { specialisation } = req.query;
  const doctors = await prisma.doctorProfile.findMany({
    where: specialisation
      ? { specialisation: { contains: specialisation, mode: 'insensitive' } }
      : undefined,
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json(doctors);
}

async function getAvailability(req, res) {
  const { date } = req.query;
  const { available, onLeave } = await bookingService.getAvailableSlots(req.params.doctorId, date);
  res.json({ date, onLeave, slots: available });
}

module.exports = { searchDoctors, getAvailability };