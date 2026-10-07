import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientPackage', default: null },
  packageCatalogId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClinicPackage', default: null },
  serviceName: { type: String, trim: true, maxlength: 120, default: '' },
  amount: { type: Number, required: true, min: 0, max: 100000000 },
  currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3, default: 'PKR' },
  paymentDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending', 'Paid', 'Failed', 'Refunded'], default: 'Pending', index: true },
  method: { type: String, enum: ['Cash', 'Bank transfer', 'Card terminal', 'Payment gateway', 'Other'], required: true },
  referenceId: { type: String, trim: true, maxlength: 150, default: '' },
  gateway: { type: String, trim: true, maxlength: 80, default: '' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
}, { timestamps: true })

export default mongoose.model('Payment', paymentSchema)
