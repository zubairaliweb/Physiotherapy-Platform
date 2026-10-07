import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import User from '../models/User.js'
import Patient from '../models/Patient.js'
import PatientInvitation from '../models/PatientInvitation.js'
import Appointment from '../models/Appointment.js'
import ExerciseProgram from '../models/ExerciseProgram.js'
import PatientPackage from '../models/PatientPackage.js'
import Payment from '../models/Payment.js'
import PatientDocument from '../models/PatientDocument.js'
import PatientNotification from '../models/PatientNotification.js'
import PortalMessage from '../models/PortalMessage.js'
import requirePatientAuth from '../middleware/requirePatientAuth.js'
import { isValidPhone } from '../utils/validation.js'

const router = Router()
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many sign-in attempts. Please wait 15 minutes and try again.' } })
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/portal', maxAge: 30 * 60 * 1000 })
const signIn = (res, user) => {
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '30m', issuer: 'movewell-clinic', audience: 'clinic-patient' })
  res.cookie('patient_session', token, cookieOptions())
}
const documentDirectory = fileURLToPath(new URL('../uploads/patient-documents/', import.meta.url))

router.post('/setup', loginLimit, async (req, res, next) => {
  try {
    const { token, password } = req.body || {}
    if (typeof token !== 'string' || token.length > 200 || typeof password !== 'string' || password.length < 14 || password.length > 200) return res.status(400).json({ message: 'Use your invitation link and choose a password of at least 14 characters.' })
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const invitation = await PatientInvitation.findOne({ tokenHash, redeemedAt: null, expiresAt: { $gt: new Date() } }).populate('patientId')
    if (!invitation?.patientId?.email) return res.status(400).json({ message: 'This invitation has expired or has already been used. Ask your clinic for a new link.' })
    const patient = invitation.patientId
    if (await User.exists({ patientId: patient.id, role: 'patient' })) return res.status(409).json({ message: 'A patient portal account already exists for this record.' })
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ name: patient.fullName, email: patient.email, passwordHash, role: 'patient', patientId: patient.id })
    invitation.redeemedAt = new Date()
    await invitation.save()
    signIn(res, user)
    res.status(201).json({ user: { name: user.name, email: user.email } })
  } catch (error) { next(error) }
})

router.post('/login', loginLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body || {}
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 200) return res.status(400).json({ message: 'Enter your email and password.' })
    const user = await User.findOne({ email: email.trim().toLowerCase(), active: true, role: 'patient' }).select('+passwordHash')
    const matches = await bcrypt.compare(password, user?.passwordHash || '$2a$12$qdkN6T/EzkGJvvPvmxLOiezLRI9HndjEmXxcUocwR3lF2D9Rk7BTK')
    if (!user || !matches) return res.status(401).json({ message: 'Email or password is incorrect.' })
    signIn(res, user)
    res.json({ user: { name: user.name, email: user.email } })
  } catch (error) { next(error) }
})

router.post('/logout', (_req, res) => { res.clearCookie('patient_session', { ...cookieOptions(), maxAge: undefined }); res.status(204).end() })
router.use(requirePatientAuth)

router.get('/me', async (req, res, next) => {
  try { const patient = await Patient.findById(req.patientId).select('patientNumber fullName phone email dateOfBirth gender address').lean(); if (!patient) return res.status(404).json({ message: 'Patient record not found.' }); res.json({ patient }) }
  catch (error) { next(error) }
})

router.patch('/me', async (req, res, next) => {
  try {
    const update = {}; const body = req.body || {}
    if ('phone' in body) { if (!isValidPhone(body.phone)) return res.status(400).json({ message: 'Enter a valid phone number.' }); update.phone = body.phone.trim() }
    if ('address' in body) { if (typeof body.address !== 'string' || body.address.length > 500) return res.status(400).json({ message: 'Address must be 500 characters or fewer.' }); update.address = body.address.trim() }
    const patient = await Patient.findByIdAndUpdate(req.patientId, { $set: update }, { new: true, runValidators: true }).select('patientNumber fullName phone email dateOfBirth gender address')
    if (!patient) return res.status(404).json({ message: 'Patient record not found.' })
    res.json({ patient })
  } catch (error) { next(error) }
})

router.get('/appointments', async (req, res, next) => {
  try { res.json({ appointments: await Appointment.find({ patientId: req.patientId }).sort({ appointmentDate: -1 }).select('service appointmentDate preferredTime status therapistId').populate('therapistId', 'name title').lean() }) }
  catch (error) { next(error) }
})

router.get('/programs', async (req, res, next) => {
  try { res.json({ programs: await ExerciseProgram.find({ patientId: req.patientId, active: true, startsAt: { $lte: new Date() }, $or: [{ endsAt: null }, { endsAt: { $gte: new Date() } }] }).sort({ startsAt: -1 }).select('name description exercises startsAt endsAt').lean() }) }
  catch (error) { next(error) }
})

router.get('/packages', async (req, res, next) => {
  try {
    const now = new Date()
    await PatientPackage.updateMany({ patientId: req.patientId, status: 'Active', expiresAt: { $lte: now } }, { $set: { status: 'Expired' } })
    res.json({ packages: await PatientPackage.find({ patientId: req.patientId }).sort({ purchasedAt: -1 }).select('nameAtPurchase sessionCount sessionsUsed amount currency purchasedAt expiresAt status').lean() })
  }
  catch (error) { next(error) }
})

router.get('/payments', async (req, res, next) => {
  try { res.json({ payments: await Payment.find({ patientId: req.patientId }).sort({ paymentDate: -1 }).select('amount currency paymentDate status method referenceId serviceName packageId').populate('packageId', 'nameAtPurchase').lean() }) }
  catch (error) { next(error) }
})

router.get('/documents', async (req, res, next) => {
  try { res.json({ documents: await PatientDocument.find({ patientId: req.patientId }).sort({ createdAt: -1 }).select('title originalName mimeType size createdAt').lean() }) }
  catch (error) { next(error) }
})

router.get('/documents/:id/download', async (req, res, next) => {
  try {
    const document = await PatientDocument.findOne({ _id: req.params.id, patientId: req.patientId }).select('filename originalName mimeType')
    if (!document) return res.status(404).json({ message: 'Document not found.' })
    res.setHeader('Cache-Control', 'private, no-store')
    res.download(path.join(documentDirectory, path.basename(document.filename)), document.originalName, error => { if (error && !res.headersSent) next(error) })
  } catch (error) { next(error) }
})

router.get('/notifications', async (req, res, next) => {
  try { res.json({ notifications: await PatientNotification.find({ patientId: req.patientId }).sort({ createdAt: -1 }).limit(100).lean() }) }
  catch (error) { next(error) }
})

router.post('/notifications/read-all', async (req, res, next) => {
  try { await PatientNotification.updateMany({ patientId: req.patientId, readAt: null }, { $set: { readAt: new Date() } }); res.json({ message: 'Notifications marked as read.' }) }
  catch (error) { next(error) }
})

router.get('/messages', async (req, res, next) => {
  try { res.json({ messages: await PortalMessage.find({ patientId: req.patientId }).sort({ createdAt: 1 }).populate('senderId', 'name role').lean() }) }
  catch (error) { next(error) }
})

router.post('/messages', async (req, res, next) => {
  try {
    if (typeof req.body?.message !== 'string' || !req.body.message.trim() || req.body.message.length > 2000) return res.status(400).json({ message: 'Message must be 1–2,000 characters.' })
    const message = await PortalMessage.create({ patientId: req.patientId, senderId: req.patientUser.id, senderRole: 'patient', message: req.body.message.trim() })
    res.status(201).json({ message })
  } catch (error) { next(error) }
})

export default router
