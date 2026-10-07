import { Router } from 'express'
import mongoose from 'mongoose'
import ExerciseProgram from '../models/ExerciseProgram.js'
import ClinicPackage from '../models/ClinicPackage.js'
import PatientPackage from '../models/PatientPackage.js'
import Payment from '../models/Payment.js'
import Patient from '../models/Patient.js'
import ClinicSettings from '../models/ClinicSettings.js'
import PatientNotification from '../models/PatientNotification.js'
import requireAuth from '../middleware/requireAuth.js'
import requireRole from '../middleware/requireRole.js'

const router = Router()
router.use(requireAuth)
const objectId = id => mongoose.isValidObjectId(id)
const exerciseFields = ['name', 'instructions', 'repetitions', 'sets', 'durationMinutes', 'frequency', 'precautions', 'mediaUrl']
const validExercises = exercises => Array.isArray(exercises) && exercises.length <= 40 && exercises.every(item => item && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 120 && typeof item.instructions === 'string' && item.instructions.trim().length > 0 && item.instructions.length <= 2000 && ['repetitions', 'frequency', 'precautions', 'mediaUrl'].every(key => item[key] === undefined || typeof item[key] === 'string') && (item.mediaUrl === undefined || !item.mediaUrl || /^https?:\/\//i.test(item.mediaUrl)) && ['sets', 'durationMinutes'].every(key => item[key] === undefined || (Number.isInteger(Number(item[key])) && Number(item[key]) >= 0 && Number(item[key]) <= 240)))
const hasRole = (req, ...roles) => roles.includes(req.user.role)

router.get('/programs', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    const filter = req.query.patientId && objectId(req.query.patientId) ? { patientId: req.query.patientId } : {}
    const programs = await ExerciseProgram.find(filter).sort({ createdAt: -1 }).populate('patientId', 'patientNumber fullName').populate('therapistId', 'name title').lean()
    res.json({ programs })
  } catch (error) { next(error) }
})

router.post('/programs', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    const body = req.body || {}
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 120 || typeof body.description !== 'string' || body.description.length > 2000 || !validExercises(body.exercises || [])) return res.status(400).json({ message: 'Check the program name, description, and exercise details.' })
    if (body.patientId && (!objectId(body.patientId) || !await Patient.exists({ _id: body.patientId }))) return res.status(404).json({ message: 'Patient not found.' })
    const program = await ExerciseProgram.create({ name: body.name.trim(), description: body.description.trim(), exercises: body.exercises || [], patientId: body.patientId || null, therapistId: body.therapistId || null, assignedBy: req.user.id, startsAt: body.startsAt || new Date(), endsAt: body.endsAt || null, active: body.active !== false })
    if (program.patientId) await PatientNotification.create({ patientId: program.patientId, title: 'A new exercise program is ready', message: `${program.name} has been added to your patient portal.` }).catch(error => console.error('Could not save exercise notification:', error.name))
    res.status(201).json({ program })
  } catch (error) { next(error) }
})

router.patch('/programs/:id', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    if (!objectId(req.params.id)) return res.status(400).json({ message: 'Invalid program ID.' })
    const body = req.body || {}; const update = {}
    if ('name' in body) { if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 120) return res.status(400).json({ message: 'Program name must be 2–120 characters.' }); update.name = body.name.trim() }
    if ('description' in body) { if (typeof body.description !== 'string' || body.description.length > 2000) return res.status(400).json({ message: 'Description must be 2,000 characters or fewer.' }); update.description = body.description.trim() }
    if ('exercises' in body) { if (!validExercises(body.exercises)) return res.status(400).json({ message: 'Review the exercise entries and try again.' }); update.exercises = body.exercises }
    if ('patientId' in body) { if (body.patientId && (!objectId(body.patientId) || !await Patient.exists({ _id: body.patientId }))) return res.status(404).json({ message: 'Patient not found.' }); update.patientId = body.patientId || null }
    if ('therapistId' in body) update.therapistId = body.therapistId || null
    if ('active' in body) update.active = Boolean(body.active)
    if ('startsAt' in body) update.startsAt = new Date(body.startsAt)
    if ('endsAt' in body) update.endsAt = body.endsAt ? new Date(body.endsAt) : null
    const program = await ExerciseProgram.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).populate('patientId', 'patientNumber fullName')
    if (!program) return res.status(404).json({ message: 'Program not found.' })
    res.json({ program })
  } catch (error) { next(error) }
})

router.delete('/programs/:id', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    const program = await ExerciseProgram.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { new: true })
    if (!program) return res.status(404).json({ message: 'Program not found.' })
    res.json({ message: 'Program archived.', program })
  } catch (error) { next(error) }
})

router.get('/packages', requireRole('admin'), async (_req, res, next) => {
  try { res.json({ packages: await ClinicPackage.find().sort({ active: -1, createdAt: -1 }).lean(), assignments: await PatientPackage.find().sort({ createdAt: -1 }).limit(100).populate('patientId', 'patientNumber fullName').populate('packageId', 'name').lean() }) }
  catch (error) { next(error) }
})

router.post('/packages', requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {}
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || typeof body.description !== 'string' || body.description.length > 1000 || !Number.isInteger(Number(body.sessionCount)) || Number(body.sessionCount) < 1 || !Number.isFinite(Number(body.price)) || Number(body.price) < 0 || !Number.isInteger(Number(body.validityDays)) || Number(body.validityDays) < 1) return res.status(400).json({ message: 'Enter a valid package name, description, session count, price, and validity.' })
    const settings = await ClinicSettings.findOne({ key: 'clinic' }).select('currency').lean()
    const clinicPackage = await ClinicPackage.create({ name: body.name.trim(), description: body.description.trim(), sessionCount: Number(body.sessionCount), price: Number(body.price), currency: (body.currency || settings?.currency || 'PKR').toUpperCase(), validityDays: Number(body.validityDays), active: body.active !== false })
    res.status(201).json({ clinicPackage })
  } catch (error) { next(error) }
})

router.patch('/packages/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (!objectId(req.params.id)) return res.status(400).json({ message: 'Invalid package ID.' })
    const body = req.body || {}; const update = {}
    for (const [key, validator] of Object.entries({ name: v => typeof v === 'string' && v.trim().length >= 2 && v.length <= 120, description: v => typeof v === 'string' && v.length <= 1000, sessionCount: v => Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 100, price: v => Number.isFinite(Number(v)) && Number(v) >= 0, validityDays: v => Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 3650, currency: v => typeof v === 'string' && /^[A-Z]{3}$/i.test(v) })) if (key in body) { if (!validator(body[key])) return res.status(400).json({ message: `Enter a valid package ${key}.` }); update[key] = ['sessionCount', 'price', 'validityDays'].includes(key) ? Number(body[key]) : key === 'currency' ? body[key].toUpperCase() : typeof body[key] === 'string' ? body[key].trim() : body[key] }
    if ('active' in body) update.active = Boolean(body.active)
    const clinicPackage = await ClinicPackage.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
    if (!clinicPackage) return res.status(404).json({ message: 'Package not found.' })
    res.json({ clinicPackage })
  } catch (error) { next(error) }
})

router.delete('/packages/:id', requireRole('admin'), async (req, res, next) => {
  try { const clinicPackage = await ClinicPackage.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { new: true }); if (!clinicPackage) return res.status(404).json({ message: 'Package not found.' }); res.json({ clinicPackage, message: 'Package archived.' }) }
  catch (error) { next(error) }
})

router.post('/packages/:id/assignments', requireRole('admin'), async (req, res, next) => {
  try {
    if (!objectId(req.params.id) || !objectId(req.body?.patientId)) return res.status(400).json({ message: 'Choose a valid package and patient.' })
    const [clinicPackage, patient] = await Promise.all([ClinicPackage.findOne({ _id: req.params.id, active: true }), Patient.findById(req.body.patientId)])
    if (!clinicPackage) return res.status(404).json({ message: 'Active package not found.' })
    if (!patient) return res.status(404).json({ message: 'Patient not found.' })
    const method = ['Cash', 'Bank transfer', 'Card terminal', 'Payment gateway', 'Other'].includes(req.body.method) ? req.body.method : 'Other'
    const status = ['Pending', 'Paid'].includes(req.body.status) ? req.body.status : 'Pending'
    const expiry = new Date(Date.now() + clinicPackage.validityDays * 86400000)
    const enrollment = await PatientPackage.create({ patientId: patient.id, packageId: clinicPackage.id, nameAtPurchase: clinicPackage.name, sessionCount: clinicPackage.sessionCount, amount: clinicPackage.price, currency: clinicPackage.currency, expiresAt: expiry, assignedBy: req.user.id })
    try {
      const payment = await Payment.create({ patientId: patient.id, packageId: enrollment.id, packageCatalogId: clinicPackage.id, amount: clinicPackage.price, currency: clinicPackage.currency, status, method, referenceId: typeof req.body.referenceId === 'string' ? req.body.referenceId.trim().slice(0, 150) : '', recordedBy: req.user.id })
      enrollment.paymentId = payment.id
      await enrollment.save()
      res.status(201).json({ enrollment, payment })
      await PatientNotification.create({ patientId: patient.id, title: 'A clinic package was added', message: `${clinicPackage.name} has been added to your patient portal.` }).catch(error => console.error('Could not save package notification:', error.name))
    } catch (error) { await PatientPackage.findByIdAndDelete(enrollment.id); throw error }
  } catch (error) { next(error) }
})

router.patch('/assignments/:id/sessions', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    const change = Number(req.body?.change)
    if (!objectId(req.params.id) || ![-1, 1].includes(change)) return res.status(400).json({ message: 'Session change must be plus or minus one.' })
    const enrollment = await PatientPackage.findById(req.params.id)
    if (!enrollment) return res.status(404).json({ message: 'Package enrollment not found.' })
    const sessionsUsed = Math.min(enrollment.sessionCount, Math.max(0, enrollment.sessionsUsed + change))
    enrollment.sessionsUsed = sessionsUsed
    if (sessionsUsed >= enrollment.sessionCount) enrollment.status = 'Completed'
    else if (enrollment.status === 'Completed') enrollment.status = 'Active'
    await enrollment.save()
    res.json({ enrollment })
  } catch (error) { next(error) }
})

router.get('/payments', requireRole('admin'), async (_req, res, next) => {
  try { res.json({ payments: await Payment.find().sort({ paymentDate: -1 }).limit(500).populate('patientId', 'patientNumber fullName').populate('packageId', 'nameAtPurchase').lean() }) }
  catch (error) { next(error) }
})

router.post('/payments', requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {}
    if (!objectId(body.patientId) || !Number.isFinite(Number(body.amount)) || Number(body.amount) < 0 || !['Pending', 'Paid', 'Failed', 'Refunded'].includes(body.status) || !['Cash', 'Bank transfer', 'Card terminal', 'Payment gateway', 'Other'].includes(body.method)) return res.status(400).json({ message: 'Enter a patient, valid amount, payment status, and payment method.' })
    if (!await Patient.exists({ _id: body.patientId })) return res.status(404).json({ message: 'Patient not found.' })
    const settings = await ClinicSettings.findOne({ key: 'clinic' }).select('currency').lean()
    const payment = await Payment.create({ patientId: body.patientId, amount: Number(body.amount), currency: (body.currency || settings?.currency || 'PKR').toUpperCase(), status: body.status, method: body.method, referenceId: typeof body.referenceId === 'string' ? body.referenceId.trim().slice(0, 150) : '', serviceName: typeof body.serviceName === 'string' ? body.serviceName.trim().slice(0, 120) : '', notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : '', recordedBy: req.user.id, paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date() })
    res.status(201).json({ payment })
  } catch (error) { next(error) }
})

router.patch('/payments/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (!objectId(req.params.id) || !['Pending', 'Paid', 'Failed', 'Refunded'].includes(req.body?.status)) return res.status(400).json({ message: 'Choose a valid payment status.' })
    const payment = await Payment.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true })
    if (!payment) return res.status(404).json({ message: 'Payment not found.' })
    res.json({ payment })
  } catch (error) { next(error) }
})

export default router
