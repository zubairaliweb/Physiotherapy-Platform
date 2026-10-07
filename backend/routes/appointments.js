import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import Appointment from '../models/Appointment.js'
import Service from '../models/Service.js'
import { ensureDefaultServices } from './publicContent.js'
import { clinicDateString, isPastClinicDate, parseClinicDate } from '../utils/clinicDate.js'
import { isValidPhone } from '../utils/validation.js'

const router = Router()
const bookingLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many requests. Please try again shortly or contact us on WhatsApp.' } })
const times = ['Morning · 9am–12pm', 'Afternoon · 12pm–3pm', 'Late afternoon · 3pm–6pm']
router.post('/', bookingLimit, async (req, res, next) => {
  try {
    const { fullName, phone, email, appointmentDate, preferredTime, service, message = '' } = req.body || {}
    if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) return res.status(400).json({ message: 'Please enter your name (2–100 characters).' })
    if (!isValidPhone(phone)) return res.status(400).json({ message: 'Please enter a valid phone number.' })
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ message: 'Please enter a valid email address.' })
    const date = parseClinicDate(appointmentDate)
    if (!date || isPastClinicDate(appointmentDate)) return res.status(400).json({ message: `Please choose a valid date on or after ${clinicDateString()}.` })
    await ensureDefaultServices()
    if (!times.includes(preferredTime) || typeof service !== 'string' || !await Service.exists({ name: service.trim(), active: true })) return res.status(400).json({ message: 'Please choose a valid appointment time and service.' })
    if (typeof message !== 'string' || message.length > 1000) return res.status(400).json({ message: 'Your message must be 1,000 characters or fewer.' })
    const appointment = await Appointment.create({ fullName: fullName.trim(), phone: phone.trim(), email: email.trim().toLowerCase(), appointmentDate: date, preferredTime, service: service.trim(), message: message.trim() })
    res.status(201).json({ message: 'Appointment request received.', appointmentId: appointment.id, status: appointment.status })
  } catch (error) { next(error) }
})
export default router
