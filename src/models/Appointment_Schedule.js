import mongoose from 'mongoose';

const scheduleAppointment = new mongoose.Schema({

    availability: [{
        day: String,
        slots: [String]
    }],

    // NEW: Date-specific overrides
    dateOverrides: [{
        date: {
            type: String, // Format: "YYYY-MM-DD"
            required: true
        },
        isBlocked: {
            type: Boolean,
            default: false
        },
        reason: String, // "Holiday", "Personal Leave", etc.
        customSlots: [String], // Override slots for this specific date
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],

    // NEW: Booking settings
    bookingSettings: {
        minAdvanceHours: {
            type: Number,
            default: 24 // Minimum 24 hours in advance
        },
        maxAdvanceDays: {
            type: Number,
            default: 60 // Maximum 60 days in advance
        },
        allowSameDayBooking: {
            type: Boolean,
            default: false
        },
        slotCapacity: {
            type: Number,
            default: 1 // 1 student per slot (for 1-on-1)
        },
        bufferBetweenSlots: {
            type: Number,
            default: 0 // Minutes buffer between appointments
        }
    },
},{
    timestamps: true
});
scheduleAppointment.index({ 'dateOverrides.date': 1 });
export default mongoose.model('ScheduleAppointment', scheduleAppointment);