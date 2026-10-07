import { Router } from 'express'
import multer from 'multer'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, open, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import Patient from '../models/Patient.js'
import PatientInvitation from '../models/PatientInvitation.js'
import PatientDocument from '../models/PatientDocument.js'
import PortalMessage from '../models/PortalMessage.js'
import PatientNotification from '../models/PatientNotification.js'
import User from '../models/User.js'
import requireAuth from '../middleware/requireAuth.js'
import requireRole from '../middleware/requireRole.js'

const router = Router()
router.use(requireAuth)
const documentDirectory = fileURLToPath(new URL('../uploads/patient-documents/', import.meta.url))
await mkdir(documentDirectory, { recursive: true })
const mimeExtension = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' }
const upload = multer({
  storage: multer.diskStorage({ destination: (_req, _file, cb) => cb(null, documentDirectory), filename: (_req, file, cb) => cb(null, `${randomUUID()}${mimeExtension[file.mimetype] || '.upload'}`) }),
  limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 1, fieldSize: 1000, parts: 2 },
  fileFilter: (_req, file, cb) => mimeExtension[file.mimetype] ? cb(null, true) : cb(Object.assign(new Error('Upload a PDF, JPEG, or PNG document.'), { status: 400 })),
})

router.post('/patients/:id/portal-invitation', requireRole('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid patient ID.' })
    const patient = await Patient.findById(req.params.id).select('fullName email')
    if (!patient) return res.status(404).json({ message: 'Patient not found.' })
    if (!patient.email) return res.status(400).json({ message: 'Add the patient’s email address before sending a portal invitation.' })
    if (await User.exists({ email: patient.email, role: { $ne: 'patient' } })) return res.status(409).json({ message: 'That email address is already used by a clinic staff account.' })
    await PatientInvitation.deleteMany({ patientId: patient.id, redeemedAt: null })
    const token = randomBytes(32).toString('base64url')
    await PatientInvitation.create({ patientId: patient.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), invitedBy: req.user.id })
    const origin = process.env.CLIENT_URL || 'http://localhost:5173'
    res.status(201).json({ invitationUrl: `${origin}/patient/setup?token=${encodeURIComponent(token)}`, expiresInHours: 48, patientName: patient.fullName })
  } catch (error) { next(error) }
})

router.get('/patients/:id/documents', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid patient ID.' })
    const documents = await PatientDocument.find({ patientId: req.params.id }).sort({ createdAt: -1 }).select('-filename -__v').lean()
    res.json({ documents })
  } catch (error) { next(error) }
})

router.post('/patients/:id/documents', requireRole('admin', 'therapist'), upload.single('document'), async (req, res, next) => {
  const file = req.file
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !await Patient.exists({ _id: req.params.id })) {
      if (file) await unlink(file.path).catch(() => {})
      return res.status(404).json({ message: 'Patient not found.' })
    }
    if (!file) return res.status(400).json({ message: 'Choose a patient document to upload.' })
    const originalName = path.basename(file.originalname).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || 'patient-document'
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : path.parse(originalName).name
    if (title.length < 2 || title.length > 120) { await unlink(file.path).catch(() => {}); return res.status(400).json({ message: 'Document title must be 2–120 characters.' }) }
    const head = Buffer.alloc(8); const handle = await open(file.path, 'r'); try { await handle.read(head, 0, 8, 0) } finally { await handle.close() }
    const valid = file.mimetype === 'application/pdf' ? head.toString('ascii', 0, 5) === '%PDF-' : file.mimetype === 'image/jpeg' ? head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff : head[0] === 0x89 && head.toString('ascii', 1, 4) === 'PNG'
    if (!valid) { await unlink(file.path).catch(() => {}); return res.status(400).json({ message: 'The file contents do not match the selected document format.' }) }
    const document = await PatientDocument.create({ patientId: req.params.id, title, filename: file.filename, originalName, mimeType: file.mimetype, size: file.size, uploadedBy: req.user.id })
    await PatientNotification.create({ patientId: req.params.id, title: 'A new document is available', message: `${title} has been added to your patient portal.` }).catch(error => console.error('Could not save document notification:', error.name))
    res.status(201).json({ document: { ...document.toObject(), filename: undefined } })
  } catch (error) { if (file) await unlink(file.path).catch(() => {}); next(error) }
})

router.get('/documents/:id/download', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    const document = await PatientDocument.findById(req.params.id).select('filename originalName')
    if (!document) return res.status(404).json({ message: 'Document not found.' })
    res.setHeader('Cache-Control', 'private, no-store')
    res.download(path.join(documentDirectory, path.basename(document.filename)), document.originalName, error => { if (error && !res.headersSent) next(error) })
  } catch (error) { next(error) }
})

router.delete('/documents/:id', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    const document = await PatientDocument.findByIdAndDelete(req.params.id)
    if (!document) return res.status(404).json({ message: 'Document not found.' })
    await unlink(path.join(documentDirectory, path.basename(document.filename))).catch(error => { if (error.code !== 'ENOENT') throw error })
    res.json({ message: 'Document deleted.' })
  } catch (error) { next(error) }
})

router.get('/portal-messages', requireRole('admin', 'therapist'), async (_req, res, next) => {
  try {
    const messages = await PortalMessage.find().sort({ createdAt: -1 }).limit(300).populate('patientId', 'patientNumber fullName').populate('senderId', 'name role').lean()
    res.json({ messages })
  } catch (error) { next(error) }
})

router.post('/portal-messages/:patientId', requireRole('admin', 'therapist'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.patientId) || !await Patient.exists({ _id: req.params.patientId })) return res.status(404).json({ message: 'Patient not found.' })
    if (typeof req.body?.message !== 'string' || !req.body.message.trim() || req.body.message.length > 2000) return res.status(400).json({ message: 'Message must be 1–2,000 characters.' })
    const message = await PortalMessage.create({ patientId: req.params.patientId, senderId: req.user.id, senderRole: req.user.role, message: req.body.message.trim() })
    await PatientNotification.create({ patientId: req.params.patientId, title: 'A new clinic message', message: 'Your clinic team sent you a message in the patient portal.' }).catch(error => console.error('Could not save message notification:', error.name))
    res.status(201).json({ message })
  } catch (error) { next(error) }
})

export default router
