import mongoose from 'mongoose'

const patientSchema = new mongoose.Schema({
  patientNumber: { type: String, unique: true, sparse: true, index: true },
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100, index: true },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, index: true },
  dateOfBirth: Date,
  gender: { type: String, enum: ['', 'Female', 'Male', 'Non-binary', 'Prefer not to say'], default: '' },
  address: { type: String, trim: true, maxlength: 500 },
  clinical: {
    mainComplaint: { type: String, trim: true, maxlength: 2000 },
    medicalHistory: { type: String, trim: true, maxlength: 5000 },
    previousInjuries: { type: String, trim: true, maxlength: 3000 },
    relevantConditions: { type: String, trim: true, maxlength: 3000 },
    assessmentNotes: { type: String, trim: true, maxlength: 5000 },
    treatmentNotes: { type: String, trim: true, maxlength: 5000 },
    therapistNotes: { type: String, trim: true, maxlength: 5000 },
    followUpNotes: { type: String, trim: true, maxlength: 3000 },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, minimize: false })

patientSchema.index({ fullName: 'text', email: 'text', phone: 'text', patientNumber: 'text' })
export default mongoose.model('Patient', patientSchema)
