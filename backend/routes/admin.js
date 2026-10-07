import { Router } from 'express'
import mongoose from 'mongoose'
import Appointment from '../models/Appointment.js'
import Message from '../models/Message.js'
import Patient from '../models/Patient.js'
import requireAuth from '../middleware/requireAuth.js'
import requireRole from '../middleware/requireRole.js'
import { clinicDateString, isPastClinicDate, parseClinicDate } from '../utils/clinicDate.js'
import { isValidPhone } from '../utils/validation.js'
import Service from '../models/Service.js'
import Therapist from '../models/Therapist.js'
import PatientNotification from '../models/PatientNotification.js'
import Payment from '../models/Payment.js'
import { ensureDefaultServices } from './publicContent.js'

const router = Router()
router.use(requireAuth)
const statuses = ['Pending', 'Confirmed', 'Completed', 'Cancelled']
const times = ['Morning · 9am–12pm', 'Afternoon · 12pm–3pm', 'Late afternoon · 3pm–6pm']
const clinicalFields = ['mainComplaint', 'medicalHistory', 'previousInjuries', 'relevantConditions', 'assessmentNotes', 'treatmentNotes', 'therapistNotes', 'followUpNotes']
const patientFields = ['fullName', 'phone', 'email', 'dateOfBirth', 'gender', 'address']
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const dateValue = value => { if (!value) return undefined; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date }

router.get('/overview', async (_req, res, next) => {
  try {
    const [totalAppointments, pending, confirmed, completed, cancelled, totalPatients, recent, upcoming] = await Promise.all([
      Appointment.countDocuments(), Appointment.countDocuments({ status: 'Pending' }), Appointment.countDocuments({ status: 'Confirmed' }),
      Appointment.countDocuments({ status: 'Completed' }), Appointment.countDocuments({ status: 'Cancelled' }), Patient.countDocuments(),
      Appointment.find().sort({ createdAt: -1 }).limit(6).select('fullName service appointmentDate preferredTime status createdAt').lean(),
      Appointment.find({ status: { $in: ['Pending', 'Confirmed'] }, appointmentDate: { $gte: new Date(`${clinicDateString()}T00:00:00.000Z`) } }).sort({ appointmentDate: 1 }).limit(6).select('fullName service appointmentDate preferredTime status').lean(),
    ])
    res.json({ counts: { totalAppointments, pending, confirmed, completed, cancelled, totalPatients }, recent, upcoming })
  } catch (error) { next(error) }
})

router.get('/appointments', async (req, res, next) => {
  try {
    const query = {}
    if (statuses.includes(req.query.status)) query.status = req.query.status
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const expression = new RegExp(escapeRegex(req.query.search.trim().slice(0, 80)), 'i')
      query.$or = [{ fullName: expression }, { email: expression }, { phone: expression }, { service: expression }]
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100)
    const appointments = await Appointment.find(query).sort({ appointmentDate: -1 }).limit(limit).populate('patientId', 'patientNumber fullName').lean()
    res.json({ appointments })
  } catch (error) { next(error) }
})

router.patch('/appointments/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid appointment ID.' })
    const update = {}
    const body = req.body || {}
    if ('status' in body) { if (!statuses.includes(body.status)) return res.status(400).json({ message: 'Choose a valid appointment status.' }); update.status = body.status }
    if ('appointmentDate' in body) { const value = parseClinicDate(body.appointmentDate); if (!value || isPastClinicDate(body.appointmentDate)) return res.status(400).json({ message: `Choose a valid appointment date on or after ${clinicDateString()}.` }); update.appointmentDate = value }
    if ('preferredTime' in body) { if (!times.includes(body.preferredTime)) return res.status(400).json({ message: 'Choose a valid appointment time.' }); update.preferredTime = body.preferredTime }
    if ('service' in body) { await ensureDefaultServices(); if (typeof body.service !== 'string' || !await Service.exists({ name: body.service.trim(), active: true })) return res.status(400).json({ message: 'Choose an active clinic service.' }); update.service = body.service.trim() }
    if ('therapistId' in body) { if (body.therapistId !== null && !mongoose.isValidObjectId(body.therapistId)) return res.status(400).json({ message: 'Invalid therapist ID.' }); if (body.therapistId && !await Therapist.exists({ _id: body.therapistId, active: true })) return res.status(404).json({ message: 'Therapist not found.' }); update.therapistId = body.therapistId }
    if ('internalNotes' in body) { if (typeof body.internalNotes !== 'string' || body.internalNotes.length > 2000) return res.status(400).json({ message: 'Internal notes must be 2,000 characters or fewer.' }); update.internalNotes = body.internalNotes.trim() }
    if ('patientId' in body) {
      if (body.patientId !== null && !mongoose.isValidObjectId(body.patientId)) return res.status(400).json({ message: 'Invalid patient ID.' })
      if (body.patientId && !(await Patient.exists({ _id: body.patientId }))) return res.status(404).json({ message: 'Patient not found.' })
      update.patientId = body.patientId
    }
    const previous = 'status' in update ? await Appointment.findById(req.params.id).select('status') : null
    const appointment = await Appointment.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).populate('patientId', 'patientNumber fullName')
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' })
    if (previous && previous.status !== update.status && appointment.patientId && ['Confirmed', 'Cancelled', 'Completed'].includes(update.status)) {
      const title = update.status === 'Confirmed' ? 'Appointment confirmed' : update.status === 'Cancelled' ? 'Appointment cancelled' : 'Appointment completed'
      const message = `${appointment.service} appointment on ${clinicDateString(appointment.appointmentDate)} was marked ${update.status.toLowerCase()}.`
      await PatientNotification.create({ patientId: appointment.patientId._id, title, message }).catch(error => console.error('Could not save appointment notification:', error.name))
    }
    res.json({ appointment })
  } catch (error) { next(error) }
})

router.get('/patients', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    const query = {}
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const expression = new RegExp(escapeRegex(req.query.search.trim().slice(0, 80)), 'i')
      query.$or = [{ fullName: expression }, { email: expression }, { phone: expression }, { patientNumber: expression }]
    }
    const patients = await Patient.find(query).sort({ updatedAt: -1 }).limit(100).select('patientNumber fullName phone email dateOfBirth gender updatedAt').lean()
    res.json({ patients })
  } catch (error) { next(error) }
})

router.post('/patients', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    const body = req.body || {}
    if (typeof body.fullName !== 'string' || body.fullName.trim().length < 2 || body.fullName.trim().length > 100) return res.status(400).json({ message: 'Enter a patient name (2–100 characters).' })
    if (!isValidPhone(body.phone)) return res.status(400).json({ message: 'Enter a valid patient phone number.' })
    if (body.email && (typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))) return res.status(400).json({ message: 'Enter a valid patient email.' })
    if (body.gender && !['Female', 'Male', 'Non-binary', 'Prefer not to say'].includes(body.gender)) return res.status(400).json({ message: 'Choose a valid gender value.' })
    const dob = body.dateOfBirth ? dateValue(body.dateOfBirth) : undefined
    if (body.dateOfBirth && (!dob || dob > new Date())) return res.status(400).json({ message: 'Enter a valid date of birth.' })
    const patient = await Patient.create({ fullName: body.fullName.trim(), phone: body.phone.trim(), email: body.email?.trim().toLowerCase(), dateOfBirth: dob, gender: body.gender || '', address: typeof body.address === 'string' ? body.address.trim().slice(0,500) : '', clinical: {}, createdBy: req.user.id })
    patient.patientNumber = `MW-${patient.id.slice(-8).toUpperCase()}`
    await patient.save()
    res.status(201).json({ patient })
  } catch (error) { next(error) }
})

router.get('/patients/:id', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid patient ID.' })
    const patient = await Patient.findById(req.params.id).lean()
    if (!patient) return res.status(404).json({ message: 'Patient not found.' })
    const contactMatch = [{ phone: patient.phone }]
    if (patient.email) contactMatch.push({ email: patient.email })
    const [appointments, matchingRequests] = await Promise.all([
      Appointment.find({ patientId: req.params.id }).sort({ appointmentDate: -1 }).select('service appointmentDate preferredTime status internalNotes').lean(),
      Appointment.find({ patientId: null, $or: contactMatch }).sort({ appointmentDate: -1 }).limit(10).select('fullName service appointmentDate preferredTime status phone email').lean(),
    ])
    res.json({ patient, appointments, matchingRequests })
  } catch (error) { next(error) }
})

router.patch('/patients/:id', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid patient ID.' })
    const body = req.body || {}
    const update = {}
    for (const field of patientFields) if (field in body) {
      if (['fullName', 'phone', 'email', 'gender', 'address'].includes(field) && typeof body[field] !== 'string') return res.status(400).json({ message: `Invalid ${field} value.` })
      if (field === 'fullName' && (body[field].trim().length < 2 || body[field].trim().length > 100)) return res.status(400).json({ message: 'Patient name must be 2–100 characters.' })
      if (field === 'phone' && !isValidPhone(body[field])) return res.status(400).json({ message: 'Enter a valid patient phone number.' })
      if (field === 'email' && body[field] && (body[field].length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body[field].trim()))) return res.status(400).json({ message: 'Enter a valid patient email.' })
      if (field === 'gender' && !['', 'Female', 'Male', 'Non-binary', 'Prefer not to say'].includes(body[field])) return res.status(400).json({ message: 'Choose a valid gender value.' })
      if (field === 'dateOfBirth') { const dob = dateValue(body[field]); if (body[field] && (!dob || dob > new Date())) return res.status(400).json({ message: 'Enter a valid date of birth.' }); update.dateOfBirth = dob || null; continue }
      update[field] = typeof body[field] === 'string' ? body[field].trim() : body[field]
    }
    if ('clinical' in body) {
      if (!body.clinical || typeof body.clinical !== 'object' || Array.isArray(body.clinical)) return res.status(400).json({ message: 'Invalid clinical record.' })
      for (const [field, value] of Object.entries(body.clinical)) {
        if (!clinicalFields.includes(field)) return res.status(400).json({ message: 'Unsupported clinical field.' })
        if (typeof value !== 'string' || value.length > 5000) return res.status(400).json({ message: `Invalid ${field} value.` })
        update[`clinical.${field}`] = value.trim()
      }
    }
    const patient = await Patient.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
    if (!patient) return res.status(404).json({ message: 'Patient not found.' })
    res.json({ patient })
  } catch (error) { next(error) }
})

router.get('/messages', async (_req, res, next) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(100).select('fullName email phone message createdAt').lean()
    res.json({ messages })
  } catch (error) { next(error) }
})

export default router
