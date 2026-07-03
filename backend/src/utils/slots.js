const DAY_KEYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function generateCandidateSlots(doctor, dateStr) {
  const dayKey = DAY_KEYS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
  const hours = doctor.workingHours[dayKey];
  if (!hours) return [];

  const [startStr, endStr] = hours;
  const slots = [];
  let cursor = new Date(`${dateStr}T${startStr}:00.000Z`);
  const end = new Date(`${dateStr}T${endStr}:00.000Z`);

  while (cursor.getTime() + doctor.slotDurationMin * 60000 <= end.getTime()) {
    slots.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + doctor.slotDurationMin * 60000);
  }
  return slots;
}

module.exports = { generateCandidateSlots, DAY_KEYS };
