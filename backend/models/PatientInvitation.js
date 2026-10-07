import mongoose from 'mongoose'

const patientInvitationSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  redeemedAt: { type: Date, default: null },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

export default mongoose.model('PatientInvitation', patientInvitationSchema)
