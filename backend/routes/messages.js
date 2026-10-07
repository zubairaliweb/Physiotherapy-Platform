import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import Message from '../models/Message.js'
import { isValidPhone } from '../utils/validation.js'

const router = Router()
const messageLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false })
router.post('/', messageLimit, async (req, res, next) => {
  try {
    const { fullName, email, phone = '', message } = req.body || {}
    if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 100) return res.status(400).json({ message: 'Please enter your name (2–100 characters).' })
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ message: 'Please enter a valid email address.' })
    if (typeof phone !== 'string' || phone.length > 20 || (phone && !isValidPhone(phone))) return res.status(400).json({ message: 'Please enter a valid phone number.' })
    if (typeof message !== 'string' || message.trim().length < 5 || message.length > 1000) return res.status(400).json({ message: 'Please enter a message (5–1,000 characters).' })
    const saved = await Message.create({ fullName: fullName.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), message: message.trim() })
    res.status(201).json({ message: 'Message received.', messageId: saved.id })
  } catch (error) { next(error) }
})
export default router
