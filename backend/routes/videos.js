import { Router } from 'express'
import multer from 'multer'
import { mkdir, open, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import Video from '../models/Video.js'
import requireAuth from '../middleware/requireAuth.js'
import requireRole from '../middleware/requireRole.js'

const router = Router()
const uploadDirectory = fileURLToPath(new URL('../uploads/videos/', import.meta.url))
await mkdir(uploadDirectory, { recursive: true })
const extensions = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/ogg': '.ogv' }
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => done(null, uploadDirectory),
    filename: (_req, file, done) => done(null, `${randomUUID()}${extensions[file.mimetype] || '.upload'}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 2, fieldSize: 5000, parts: 3 },
  fileFilter: (_req, file, done) => extensions[file.mimetype]
    ? done(null, true)
    : done(Object.assign(new Error('Upload an MP4, WebM, or Ogg video.'), { status: 400 })),
})

router.get('/', async (_req, res, next) => {
  try {
    const videos = await Video.find().sort({ createdAt: -1 }).select('title description filename mimeType size createdAt').lean()
    res.json({ videos: videos.map(video => ({ ...video, url: `/uploads/videos/${video.filename}` })) })
  } catch (error) { next(error) }
})

router.post('/', requireAuth, requireRole('admin'), upload.single('video'), async (req, res, next) => {
  const file = req.file
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : ''
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : ''
    if (!file) return res.status(400).json({ message: 'Choose a video file to upload.' })
    if (title.length < 2 || title.length > 100) {
      await unlink(file.path).catch(() => {})
      return res.status(400).json({ message: 'Video title must be 2–100 characters.' })
    }
    if (description.length > 500) {
      await unlink(file.path).catch(() => {})
      return res.status(400).json({ message: 'Video description must be 500 characters or fewer.' })
    }
    const signature = Buffer.alloc(16)
    const handle = await open(file.path, 'r')
    try { await handle.read(signature, 0, 16, 0) } finally { await handle.close() }
    const validSignature = file.mimetype === 'video/mp4'
      ? signature.toString('ascii', 4, 8) === 'ftyp'
      : file.mimetype === 'video/webm'
        ? signature.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
        : signature.toString('ascii', 0, 4) === 'OggS'
    if (!validSignature) {
      await unlink(file.path).catch(() => {})
      return res.status(400).json({ message: 'The file contents do not match a supported video format.' })
    }
    const video = await Video.create({ title, description, filename: file.filename, mimeType: file.mimetype, size: file.size })
    res.status(201).json({ video: { ...video.toObject(), url: `/uploads/videos/${video.filename}` } })
  } catch (error) {
    if (file) await unlink(file.path).catch(() => {})
    next(error)
  }
})

router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const video = await Video.findByIdAndDelete(req.params.id)
    if (!video) return res.status(404).json({ message: 'Video not found.' })
    await unlink(path.join(uploadDirectory, path.basename(video.filename))).catch(error => {
      if (error.code !== 'ENOENT') throw error
    })
    res.json({ message: 'Video deleted.' })
  } catch (error) { next(error) }
})

export default router
