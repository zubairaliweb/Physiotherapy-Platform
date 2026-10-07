import mongoose from 'mongoose'

const clinicSettingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'clinic' },
  clinicName: { type: String, trim: true, maxlength: 120, default: 'MoveWell Physiotherapy' },
  therapistName: { type: String, trim: true, maxlength: 120, default: 'Dr. Kifayat Khan' },
  therapistTitle: { type: String, trim: true, maxlength: 160, default: 'Clinical Physiotherapist · Sports Physical Therapist' },
  introduction: { type: String, trim: true, maxlength: 2000, default: '' },
  phone: { type: String, trim: true, maxlength: 30, default: '03138161676' },
  whatsappNumber: { type: String, trim: true, maxlength: 20, default: '923138161676' },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
  address: { type: String, trim: true, maxlength: 500, default: 'Room #607, 6th Floor, Mall of Islamabad, Jinnah Ave, Block J, Blue Area, F-7/1, Islamabad, 44210, Pakistan' },
  hours: { type: String, trim: true, maxlength: 300, default: 'By appointment' },
  mapUrl: { type: String, trim: true, maxlength: 1000, default: '' },
  socialLinks: { type: [{ name: { type: String, trim: true, maxlength: 40 }, url: { type: String, trim: true, maxlength: 1000 } }], default: [] },
  currency: { type: String, uppercase: true, trim: true, minlength: 3, maxlength: 3, default: 'PKR' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })

export default mongoose.model('ClinicSettings', clinicSettingsSchema)
