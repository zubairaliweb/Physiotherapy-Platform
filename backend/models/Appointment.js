import mongoose from 'mongoose'

const appointmentSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  appointmentDate: { type: Date, required: true },
  preferredTime: { type: String, required: true, enum: ['Morning · 9am–12pm', 'Afternoon · 12pm–3pm', 'Late afternoon · 3pm–6pm'] },
  service: { type: String, required: true, trim: true, maxlength: 100 },
  message: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'], default: 'Pending', index: true },
  internalNotes: { type: String, trim: true, maxlength: 2000 },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null, index: true },
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', default: null, index: true },
  packageEnrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientPackage', default: null },
}, { timestamps: true })
appointmentSchema.index({ appointmentDate: 1, status: 1 })
export default mongoose.model('Appointment', appointmentSchema)
