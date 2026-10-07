import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 254, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'therapist', 'staff', 'patient'], default: 'admin', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null, index: true },
  active: { type: Boolean, default: true },
  lastLoginAt: Date,
}, { timestamps: true })

export default mongoose.model('User', userSchema)
