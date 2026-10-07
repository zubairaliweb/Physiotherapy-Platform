import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import User from '../models/User.js'
import requireAuth from '../middleware/requireAuth.js'

const router = Router()
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' } })
const cookieAttributes = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' })
const cookieOptions = () => ({ ...cookieAttributes(), path: '/api', maxAge: 30 * 60 * 1000 })

router.post('/login', loginLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 200) return res.status(400).json({ message: 'Enter your email and password.' })
    const user = await User.findOne({ email: email.trim().toLowerCase(), active: true, role: { $in: ['admin', 'therapist', 'staff'] } }).select('+passwordHash')
    const matches = await bcrypt.compare(password, user?.passwordHash || '$2a$12$qdkN6T/EzkGJvvPvmxLOiezLRI9HndjEmXxcUocwR3lF2D9Rk7BTK')
    if (!user || !matches) return res.status(401).json({ message: 'Email or password is incorrect.' })
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({ message: 'Admin sign-in is not configured.' })
    user.lastLoginAt = new Date()
    await user.save()
    const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30m', issuer: 'movewell-clinic', audience: 'clinic-admin' })
    res.cookie('clinic_session', token, cookieOptions())
    res.clearCookie('clinic_session', { ...cookieAttributes(), path: '/api/admin' })
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } })
  } catch (error) { next(error) }
})

router.post('/logout', (_req, res) => {
  res.clearCookie('clinic_session', { ...cookieAttributes(), path: '/api' })
  res.clearCookie('clinic_session', { ...cookieAttributes(), path: '/api/admin' })
  res.status(204).end()
})

router.get('/me', requireAuth, (req, res) => res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } }))

export default router
