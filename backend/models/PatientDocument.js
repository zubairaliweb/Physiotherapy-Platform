import mongoose from 'mongoose'

const patientDocumentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  filename: { type: String, required: true, unique: true },
  originalName: { type: String, required: true, maxlength: 200 },
  mimeType: { type: String, required: true, enum: ['application/pdf', 'image/jpeg', 'image/png'] },
  size: { type: Number, required: true, min: 1, max: 20 * 1024 * 1024 },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

export default mongoose.model('PatientDocument', patientDocumentSchema)
