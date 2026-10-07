import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import dns from 'node:dns'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })
const dnsServers = process.env.MONGODB_DNS_SERVERS?.split(',').map(server => server.trim()).filter(Boolean)
if (dnsServers?.length) dns.setServers(dnsServers)

try {
  const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
  if (!MONGODB_URI || !ADMIN_EMAIL) throw new Error('Set MONGODB_URI and ADMIN_EMAIL in the root .env file.')
  if (!ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD in the root .env file.')
  await mongoose.connect(MONGODB_URI)
  if (await User.exists({ role: 'admin' })) throw new Error('An admin account already exists. Do not use this setup command to reset credentials.')
  if (ADMIN_PASSWORD.length < 14 || ADMIN_PASSWORD.length > 200) throw new Error('ADMIN_PASSWORD must be 14–200 characters.')
  const email = ADMIN_EMAIL.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAIL must be a valid email address.')
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
  await User.create({ name: 'Clinic Administrator', email, passwordHash, role: 'admin' })
  console.log(`Created the first admin account for ${email}. Remove ADMIN_PASSWORD from .env after setup.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
