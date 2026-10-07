import mongoose from 'mongoose'

const portalMessageSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['patient', 'admin', 'therapist', 'staff'], required: true },
  message: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
  readAt: { type: Date, default: null },
}, { timestamps: true })

portalMessageSchema.index({ patientId: 1, createdAt: 1 })
export default mongoose.model('PortalMessage', portalMessageSchema)
