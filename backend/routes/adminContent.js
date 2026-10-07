import { Router } from 'express'
import mongoose from 'mongoose'
import ClinicSettings from '../models/ClinicSettings.js'
import Service from '../models/Service.js'
import Therapist from '../models/Therapist.js'
import requireAuth from '../middleware/requireAuth.js'
import requireRole from '../middleware/requireRole.js'
import { ensureDefaultServices, ensureDefaultTherapists, getSettings } from './publicContent.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))
const cleanList = value => Array.isArray(value) ? value.map(item => typeof item === 'string' ? item.trim().slice(0, 200) : '').filter(Boolean).slice(0, 12) : null
const validUrl = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) } catch { return false } }

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await getSettings()
    res.json({ settings })
  } catch (error) { next(error) }
})

router.patch('/settings', async (req, res, next) => {
  try {
    const fields = ['clinicName', 'therapistName', 'therapistTitle', 'introduction', 'phone', 'whatsappNumber', 'email', 'address', 'hours', 'mapUrl', 'currency']
    const update = {}
    for (const field of fields) if (field in (req.body || {})) {
      if (typeof req.body[field] !== 'string') return res.status(400).json({ message: `Enter a valid ${field}.` })
      const value = req.body[field].trim()
      if (field === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return res.status(400).json({ message: 'Enter a valid clinic email address.' })
      if (field === 'mapUrl' && value && !validUrl(value)) return res.status(400).json({ message: 'Use a valid http or https map URL.' })
      if (field === 'currency' && !/^[A-Z]{3}$/.test(value.toUpperCase())) return res.status(400).json({ message: 'Currency must be a three-letter code such as PKR.' })
      update[field] = field === 'currency' ? value.toUpperCase() : value
    }
    if ('socialLinks' in (req.body || {})) {
      if (!Array.isArray(req.body.socialLinks) || req.body.socialLinks.length > 8 || req.body.socialLinks.some(link => !link || typeof link.name !== 'string' || typeof link.url !== 'string' || (link.url && !validUrl(link.url)))) return res.status(400).json({ message: 'Enter up to eight social links with valid URLs.' })
      update.socialLinks = req.body.socialLinks.map(link => ({ name: link.name.trim().slice(0, 40), url: link.url.trim().slice(0, 1000) })).filter(link => link.name && link.url)
    }
    if ('education' in (req.body || {})) return res.status(400).json({ message: 'Education details are managed on the therapist profile.' })
    update.updatedBy = req.user.id
    const settings = await ClinicSettings.findOneAndUpdate({ key: 'clinic' }, { $set: update, $setOnInsert: { key: 'clinic' } }, { new: true, upsert: true, runValidators: true })
    res.json({ settings })
  } catch (error) { next(error) }
})

router.get('/services', async (_req, res, next) => {
  try { await ensureDefaultServices(); res.json({ services: await Service.find().sort({ sortOrder: 1, name: 1 }).lean() }) }
  catch (error) { next(error) }
})

router.post('/services', async (req, res, next) => {
  try {
    const body = req.body || {}
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 100 || typeof body.description !== 'string' || body.description.trim().length > 500) return res.status(400).json({ message: 'Enter a service name and a description of 500 characters or fewer.' })
    const benefits = cleanList(body.benefits)
    if (benefits === null || (body.benefits || []).some(item => typeof item !== 'string')) return res.status(400).json({ message: 'Benefits must be a list of short text items.' })
    const service = await Service.create({ name: body.name.trim(), description: body.description.trim(), benefits, durationMinutes: Number(body.durationMinutes) || 45, active: body.active !== false, sortOrder: Number(body.sortOrder) || 0 })
    res.status(201).json({ service })
  } catch (error) { next(error) }
})

router.patch('/services/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid service ID.' })
    const body = req.body || {}; const update = {}
    if ('name' in body) { if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 100) return res.status(400).json({ message: 'Service name must be 2–100 characters.' }); update.name = body.name.trim() }
    if ('description' in body) { if (typeof body.description !== 'string' || body.description.length > 500) return res.status(400).json({ message: 'Description must be 500 characters or fewer.' }); update.description = body.description.trim() }
    if ('benefits' in body) { const benefits = cleanList(body.benefits); if (benefits === null) return res.status(400).json({ message: 'Benefits must be a list.' }); update.benefits = benefits }
    if ('durationMinutes' in body) update.durationMinutes = Number(body.durationMinutes)
    if ('active' in body) update.active = Boolean(body.active)
    if ('sortOrder' in body) update.sortOrder = Number(body.sortOrder)
    const service = await Service.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
    if (!service) return res.status(404).json({ message: 'Service not found.' })
    res.json({ service })
  } catch (error) { next(error) }
})

router.delete('/services/:id', async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { new: true })
    if (!service) return res.status(404).json({ message: 'Service not found.' })
    res.json({ service, message: 'Service hidden from the public website.' })
  } catch (error) { next(error) }
})

router.get('/therapists', async (_req, res, next) => {
  try { await ensureDefaultTherapists(); res.json({ therapists: await Therapist.find().sort({ name: 1 }).lean() }) }
  catch (error) { next(error) }
})

router.post('/therapists', async (req, res, next) => {
  try {
    const { name, title, bio = '', qualifications = [] } = req.body || {}
    if (typeof name !== 'string' || name.trim().length < 2 || typeof title !== 'string' || title.trim().length < 2 || typeof bio !== 'string' || bio.length > 2000 || !Array.isArray(qualifications) || qualifications.some(item => typeof item !== 'string')) return res.status(400).json({ message: 'Enter a name, professional title, biography, and valid qualifications.' })
    const therapist = await Therapist.create({ name: name.trim(), title: title.trim(), bio: bio.trim(), qualifications: cleanList(qualifications), active: true })
    res.status(201).json({ therapist })
  } catch (error) { next(error) }
})

router.patch('/therapists/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid therapist ID.' })
    const update = {}; const body = req.body || {}
    for (const field of ['name', 'title', 'bio']) if (field in body) {
      const value = body[field]
      if (typeof value !== 'string' || (field !== 'bio' && value.trim().length < 2) || value.length > (field === 'bio' ? 2000 : 160)) return res.status(400).json({ message: `Enter a valid therapist ${field}.` })
      update[field] = value.trim()
    }
    if ('qualifications' in body) { const qualifications = cleanList(body.qualifications); if (qualifications === null) return res.status(400).json({ message: 'Qualifications must be a list.' }); update.qualifications = qualifications }
    if ('active' in body) update.active = Boolean(body.active)
    const therapist = await Therapist.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
    if (!therapist) return res.status(404).json({ message: 'Therapist not found.' })
    res.json({ therapist })
  } catch (error) { next(error) }
})

router.delete('/therapists/:id', async (req, res, next) => {
  try {
    const therapist = await Therapist.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { new: true })
    if (!therapist) return res.status(404).json({ message: 'Therapist not found.' })
    res.json({ therapist, message: 'Therapist hidden from the public website.' })
  } catch (error) { next(error) }
})

export default router
