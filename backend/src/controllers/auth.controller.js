const { z } = require('zod');
const prisma = require('../config/prisma');
const { hashPassword, comparePassword, signToken } = require('../utils/auth');
const { AppError } = require('../middleware/error');

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
});

async function register(req, res) {
  const data = registerSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError('An account with this email already exists', 409);
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, phone: data.phone, passwordHash, role: 'PATIENT' },
  });
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

async function login(req, res) {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new AppError('Invalid email or password', 401);
  const valid = await comparePassword(data.password, user.passwordHash);
  if (!valid) throw new AppError('Invalid email or password', 401);
  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
}

async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw new AppError('User not found', 404);
  res.json({ user: publicUser(user) });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone };
}

module.exports = { register, login, me };