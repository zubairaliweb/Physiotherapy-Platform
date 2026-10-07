import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import express from 'express'
import dns from 'node:dns'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import mongoose from 'mongoose'
import appointments from './routes/appointments.js'
import messages from './routes/messages.js'
import adminAuth from './routes/adminAuth.js'
import admin from './routes/admin.js'
import videos from './routes/videos.js'
import publicContent from './routes/publicContent.js'
import patientPortal from './routes/patientPortal.js'
import adminContent from './routes/adminContent.js'
import adminPhase3 from './routes/adminPhase3.js'
import adminPortal from './routes/adminPortal.js'
import adminAnalytics from './routes/adminAnalytics.js'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

const dnsServers = process.env.MONGODB_DNS_SERVERS?.split(',').map(server => server.trim()).filter(Boolean)
if (dnsServers?.length) {
  try { dns.setServers(dnsServers) }
  catch { console.error('MONGODB_DNS_SERVERS contains an invalid DNS server address.'); process.exit(1) }
}

const app = express()
app.disable('x-powered-by')
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0)
if (!Number.isInteger(proxyHops) || proxyHops < 0) {
  console.error('TRUST_PROXY_HOPS must be a non-negative integer.')
  process.exit(1)
}
app.set('trust proxy', proxyHops)
app.use(helmet())
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173'
const isLocalViteOrigin = origin => {
  if (process.env.NODE_ENV === 'production') return false
  try {
    const url = new URL(origin)
    return ['localhost', '127.0.0.1'].includes(url.hostname) && Number(url.port) >= 5173 && Number(url.port) <= 5199
  } catch {
    return false
  }
}
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || origin === clientOrigin || isLocalViteOrigin(origin)),
  credentials: true,
}))
app.use(cookieParser())
app.use(express.json({ limit: '64kb' }))
app.use('/uploads/videos', (_req, res, next) => { res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); next() })
app.use('/uploads/videos', express.static(fileURLToPath(new URL('./uploads/videos/', import.meta.url)), { dotfiles: 'deny', index: false, maxAge: '1d', fallthrough: false }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/appointments', appointments)
app.use('/api/messages', messages)
app.use('/api/videos', videos)
app.use('/api/public', publicContent)
app.use('/api/portal', patientPortal)
app.use('/api/admin/auth', adminAuth)
app.use('/api/admin/content', adminContent)
app.use('/api/admin/work', adminPhase3)
app.use('/api/admin/portal', adminPortal)
app.use('/api/admin/analytics', adminAnalytics)
app.use('/api/admin', admin)
app.use((req, res) => res.status(404).json({ message: 'Not found.' }))
app.use((error, req, res, _next) => {
  console.error('API request failed:', error.name || 'UnknownError')
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' })
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: req.path.startsWith('/admin/portal/') ? 'Patient documents must be 20 MB or smaller.' : 'Video files must be 100 MB or smaller.' })
  if (error.name === 'MulterError') return res.status(400).json({ message: error.message || 'The video upload could not be processed.' })
  if (error instanceof SyntaxError && error.status === 400 && Object.hasOwn(error, 'body')) return res.status(400).json({ message: 'Request body must be valid JSON.' })
  if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ message: 'Submitted information is invalid.' })
  if (error.code === 11000) return res.status(409).json({ message: 'A record with this information already exists.' })
  if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) return res.status(error.status).json({ message: error.message || 'The request could not be processed.' })
  res.status(500).json({ message: 'We could not process your request right now. Please try again later.' })
})

const port = Number(process.env.PORT) || 4000
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set to at least 32 characters in the root .env file.')
  process.exit(1)
}
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required. Copy .env.example to .env and configure the database.')
  process.exit(1)
}
mongoose.connect(process.env.MONGODB_URI).then(() => {
  app.listen(port, () => console.log(`Clinic API listening on port ${port}`))
}).catch(error => {
  console.error('Could not connect to MongoDB:', error.message)
  process.exit(1)
})
