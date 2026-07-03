require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash('Admin@12345', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinic.com' },
    update: {},
    create: { name: 'Clinic Admin', email: 'admin@clinic.com', passwordHash: adminPass, role: 'ADMIN' },
  });
  console.log('Admin created:', admin.email);

  const doctorPass = await bcrypt.hash('Doctor@12345', 10);
  const doctor = await prisma.user.upsert({
    where: { email: 'dr.sharma@clinic.com' },
    update: {},
    create: {
      name: 'Dr. Anjali Sharma',
      email: 'dr.sharma@clinic.com',
      passwordHash: doctorPass,
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialisation: 'General Medicine',
          slotDurationMin: 30,
          workingHours: {
            MON: ['09:00', '17:00'],
            TUE: ['09:00', '17:00'],
            WED: ['09:00', '17:00'],
            THU: ['09:00', '17:00'],
            FRI: ['09:00', '13:00'],
          },
        },
      },
    },
  });
  console.log('Doctor created:', doctor.email);

  const patientPass = await bcrypt.hash('Patient@12345', 10);
  const patient = await prisma.user.upsert({
    where: { email: 'patient@clinic.com' },
    update: {},
    create: { name: 'Test Patient', email: 'patient@clinic.com', passwordHash: patientPass, role: 'PATIENT' },
  });
  console.log('Patient created:', patient.email);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
