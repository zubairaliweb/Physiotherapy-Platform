import mongoose from 'mongoose'

const patientNotificationSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  readAt: { type: Date, default: null },
}, { timestamps: true })

export default mongoose.model('PatientNotification', patientNotificationSchema)
