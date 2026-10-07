import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const clearSessionCookies = res => {
  const attributes = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' }
  res.clearCookie('clinic_session', { ...attributes, path: '/api' })
  res.clearCookie('clinic_session', { ...attributes, path: '/api/admin' })
}

export default async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.clinic_session
    if (!token) return res.status(401).json({ message: 'Please sign in to continue.' })
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'movewell-clinic', audience: 'clinic-admin' })
    const user = await User.findOne({ _id: payload.sub, active: true }).select('_id name email role')
    if (!user || !['admin', 'therapist', 'staff'].includes(user.role)) return res.status(401).json({ message: 'Your session is no longer valid. Please sign in again.' })
    req.user = user
    next()
  } catch {
    clearSessionCookies(res)
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
  }
}
