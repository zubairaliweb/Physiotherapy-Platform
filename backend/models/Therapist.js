import mongoose from 'mongoose'

const therapistSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  bio: { type: String, trim: true, maxlength: 2000, default: '' },
  qualifications: { type: [String], default: [] },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true })

export default mongoose.model('Therapist', therapistSchema)
