import { Router } from 'express'
import Service from '../models/Service.js'
import Therapist from '../models/Therapist.js'
import ClinicSettings from '../models/ClinicSettings.js'
import ClinicPackage from '../models/ClinicPackage.js'

const router = Router()
const defaultServices = [
  { name: 'Physiotherapy', description: 'Personalized care to restore movement, ease pain, and support your everyday goals.', benefits: ['Individual assessment', 'Movement and pain support'], durationMinutes: 45, sortOrder: 1 },
  { name: 'Sports rehabilitation', description: 'A guided return-to-sport plan built around your goals and recovery.', benefits: ['Injury rehabilitation', 'Return-to-sport planning'], durationMinutes: 45, sortOrder: 2 },
  { name: 'Manual therapy', description: 'Hands-on techniques to support mobility and comfortable movement.', benefits: ['Mobility support', 'Personalized treatment'], durationMinutes: 45, sortOrder: 3 },
  { name: 'Post-surgery recovery', description: 'Steady, guided rehabilitation after surgery.', benefits: ['Strength and mobility', 'Progressive recovery'], durationMinutes: 45, sortOrder: 4 },
]

export async function ensureDefaultServices() {
  if (await Service.exists()) return
  try { await Service.insertMany(defaultServices.map(service => ({ ...service, active: true })), { ordered: false }) }
  catch (error) { if (error.code !== 11000 && !error.writeErrors) throw error }
}

export async function getSettings() {
  const env = process.env
  const defaults = {
    clinicName: 'MoveWell Physiotherapy', therapistName: 'Dr. Kifayat Khan',
    therapistTitle: 'Clinical Physiotherapist · Sports Physical Therapist',
    introduction: 'Four years of physiotherapy experience have strengthened my commitment to helping people move better and feel better.',
    phone: env.VITE_CLINIC_PHONE || '03138161676', whatsappNumber: env.VITE_WHATSAPP_NUMBER || '923138161676',
    email: env.VITE_CLINIC_EMAIL || '',
    address: env.VITE_CLINIC_ADDRESS || 'Room #607, 6th Floor, Mall of Islamabad, Jinnah Ave, Block J, Blue Area, F-7/1, Islamabad, 44210, Pakistan',
    hours: env.VITE_CLINIC_HOURS || 'By appointment',
    mapUrl: env.VITE_MAP_URL || 'https://www.google.com/maps/place/Dr+Kifayat+khan+(Clinical+Physiotherapist)/@33.7135544,73.0599846,17z/data=!3m1!4b1!4m6!3m5!1s0x38dfedff26a96283:0x4dd185e922ba290c!8m2!3d33.7135544!4d73.0599846!16s%2Fg%2F11vp_ytx3w?hl=en-GB&entry=ttu',
    currency: env.CLINIC_CURRENCY || 'PKR',
    socialLinks: [
      { name: 'Facebook', url: env.VITE_FACEBOOK_URL || 'https://www.facebook.com/share/1QHUMWEYrL/' },
      { name: 'TikTok', url: env.VITE_TIKTOK_URL || 'https://www.tiktok.com/@drkaifpt?_r=1&_t=ZS-99fzEa3Jl9E' },
    ],
  }
  const existing = await ClinicSettings.findOne({ key: 'clinic' }).lean()
  if (existing) return { ...defaults, ...existing }
  try { return await ClinicSettings.findOneAndUpdate({ key: 'clinic' }, { $setOnInsert: defaults }, { new: true, upsert: true }).lean() }
  catch (error) { if (error.code !== 11000) throw error; return ClinicSettings.findOne({ key: 'clinic' }).lean() }
}

router.get('/settings', async (_req, res, next) => {
  try {
    const { _id, key, __v, updatedBy, ...settings } = await getSettings()
    res.json({ settings })
  } catch (error) { next(error) }
})

router.get('/services', async (_req, res, next) => {
  try { await ensureDefaultServices(); res.json({ services: await Service.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean() }) }
  catch (error) { next(error) }
})

router.get('/therapists', async (_req, res, next) => {
  try { await ensureDefaultTherapists(); res.json({ therapists: await Therapist.find({ active: true }).sort({ name: 1 }).select('name title bio qualifications').lean() }) }
  catch (error) { next(error) }
})

router.get('/packages', async (_req, res, next) => {
  try { res.json({ packages: await ClinicPackage.find({ active: true }).sort({ price: 1 }).select('name description sessionCount price currency validityDays').lean() }) }
  catch (error) { next(error) }
})

export default router

export async function ensureDefaultTherapists() {
  if (await Therapist.exists()) return
  const settings = await getSettings()
  try { await Therapist.create({ name: settings.therapistName, title: settings.therapistTitle, bio: settings.introduction, qualifications: ['Doctor of Physical Therapy · Khyber Medical University · 2014–2020 · Grade B', 'FSc Pre-Medical · PEF University College, Peshawar · 2012–2014', 'Sportsman'], active: true }) }
  catch (error) { if (error.code !== 11000) throw error }
}
