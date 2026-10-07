import mongoose from 'mongoose'

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  filename: { type: String, required: true, unique: true },
  mimeType: { type: String, required: true, enum: ['video/mp4', 'video/webm', 'video/ogg'] },
  size: { type: Number, required: true, min: 1, max: 100 * 1024 * 1024 },
}, { timestamps: true })

export default mongoose.model('Video', videoSchema)
