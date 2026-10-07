import mongoose from 'mongoose'

const clinicPackageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  sessionCount: { type: Number, required: true, min: 1, max: 100 },
  price: { type: Number, required: true, min: 0, max: 100000000 },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3, default: 'PKR' },
  validityDays: { type: Number, min: 1, max: 3650, default: 90 },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true })

export default mongoose.model('ClinicPackage', clinicPackageSchema)
