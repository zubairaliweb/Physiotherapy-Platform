import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, trim: true, maxlength: 20 },
  message: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
}, { timestamps: true })
export default mongoose.model('Message', messageSchema)
