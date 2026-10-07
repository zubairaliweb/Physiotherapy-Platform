import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export default async function requirePatientAuth(req, res, next) {
  try {
    const token = req.cookies?.patient_session
    if (!token) return res.status(401).json({ message: 'Please sign in to your patient portal.' })
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'movewell-clinic', audience: 'clinic-patient' })
    const user = await User.findOne({ _id: payload.sub, active: true, role: 'patient', patientId: { $ne: null } }).select('_id name email role patientId')
    if (!user) return res.status(401).json({ message: 'Your patient portal access is no longer active.' })
    req.patientUser = user
    req.patientId = user.patientId
    next()
  } catch {
    res.clearCookie('patient_session', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api/portal' })
    return res.status(401).json({ message: 'Your patient portal session has expired. Please sign in again.' })
  }
}
