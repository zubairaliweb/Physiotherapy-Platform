import mongoose from 'mongoose'

const patientPackageSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClinicPackage', required: true },
  nameAtPurchase: { type: String, required: true, trim: true },
  sessionCount: { type: Number, required: true, min: 1 },
  sessionsUsed: { type: Number, default: 0, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
  purchasedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
  status: { type: String, enum: ['Active', 'Completed', 'Expired', 'Cancelled'], default: 'Active', index: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

export default mongoose.model('PatientPackage', patientPackageSchema)
