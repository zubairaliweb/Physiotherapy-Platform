import mongoose from 'mongoose'

const exerciseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  instructions: { type: String, required: true, trim: true, maxlength: 2000 },
  repetitions: { type: String, trim: true, maxlength: 80, default: '' },
  sets: { type: Number, min: 0, max: 100, default: 0 },
  durationMinutes: { type: Number, min: 0, max: 240, default: 0 },
  frequency: { type: String, trim: true, maxlength: 120, default: '' },
  precautions: { type: String, trim: true, maxlength: 1000, default: '' },
  mediaUrl: { type: String, trim: true, maxlength: 1000, default: '' },
})

const exerciseProgramSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  exercises: { type: [exerciseSchema], default: [] },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null, index: true },
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Therapist', default: null },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date, default: null },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true })

export default mongoose.model('ExerciseProgram', exerciseProgramSchema)
