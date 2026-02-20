import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Skill name is required'],
        trim: true,
        unique: true
    },
    description: String,
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tutor',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('Skill', skillSchema);
