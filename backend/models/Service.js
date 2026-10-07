import mongoose from 'mongoose'

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 100 },
  description: { type: String, required: true, trim: true, maxlength: 500 },
  benefits: { type: [String], default: [] },
  durationMinutes: { type: Number, min: 10, max: 240, default: 45 },
  active: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('Service', serviceSchema)
