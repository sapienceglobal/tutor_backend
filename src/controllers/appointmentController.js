import Appointment from '../models/Appointment.js';
import Tutor from '../models/Tutor.js';
import ScheduleAppointment from '../models/Appointment_Schedule.js';
import User from '../models/User.js';

// @desc    Get all appointments for logged-in user
// @route   GET /api/appointments
export const getMyAppointments = async (req, res) => {
  try {
    const { status } = req.query;

    let filter = {};

    // If user is a student, show their bookings
    if (req.user.role === 'student') {
      filter.studentId = req.user.id;
    }
    // If user is a tutor, show appointments for their tutor profile
    else if (req.user.role === 'tutor') {
      const tutor = await Tutor.findOne({ userId: req.user.id });
      if (!tutor) {
        return res.status(404).json({
          success: false,
          message: 'Tutor profile not found'
        });
      }
      filter.tutorId = tutor._id;
    }

    if (status) {
      filter.status = status;
    }

    const appointments = await Appointment.find(filter)
      .populate('studentId', 'name email phone profileImage')
      .populate({
        path: 'tutorId',
        populate: [
          {
            path: 'userId',
            select: 'name email phone profileImage'
          },
          {
            path: 'categoryId', // ✅ ADDED: Populate category
            select: 'name icon'
          }
        ]
      })
      .sort({ dateTime: -1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get single appointment
// @route   GET /api/appointments/:id
export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id)
      .populate('studentId', 'name email phone profileImage')
      .populate({
        path: 'tutorId',
        populate: [
          {
            path: 'userId',
            select: 'name email phone profileImage'
          },
          {
            path: 'categoryId', // ✅ ADDED: Populate category
            select: 'name icon'
          }
        ]
      });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if user has access to this appointment
    const tutor = await Tutor.findById(appointment.tutorId._id);
    const isStudent = appointment.studentId._id.toString() === req.user.id;
    const isTutor = tutor && tutor.userId.toString() === req.user.id;

    if (!isStudent && !isTutor) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this appointment'
      });
    }

    res.status(200).json({
      success: true,
      appointment
    });
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Create new appointment
// @route   POST /api/appointments
export const createAppointment = async (req, res) => {
  try {
    const { tutorId, dateTime, duration, notes } = req.body;

    if (!tutorId || !dateTime) {
      return res.status(400).json({
        success: false,
        message: 'Tutor ID and date/time are required'
      });
    }

    // Check if tutor exists
    const tutor = await Tutor.findById(tutorId);
    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found'
      });
    }

    // Check if user is trying to book their own profile
    if (tutor.userId.toString() === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book appointment with yourself'
      });
    }

    // Calculate amount
    const appointmentDuration = duration || 60;
    const amount = (tutor.hourlyRate / 60) * appointmentDuration;

    // Check if slot is already booked
    const existingAppointment = await Appointment.findOne({
      tutorId,
      dateTime,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is already booked'
      });
    }

    const appointment = await Appointment.create({
      studentId: req.user.id,
      tutorId,
      dateTime,
      duration: appointmentDuration,
      amount,
      notes: notes || ''
    });

    // Update tutor's students count
    tutor.studentsCount += 1;
    await tutor.save();

    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('studentId', 'name email phone profileImage')
      .populate({
        path: 'tutorId',
        populate: [
          {
            path: 'userId',
            select: 'name email phone profileImage'
          },
          {
            path: 'categoryId',
            select: 'name icon'
          }
        ]
      });

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      appointment: populatedAppointment
    });
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Update appointment status
// @route   PATCH /api/appointments/:id
export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, dateTime, notes } = req.body;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check authorization
    const tutor = await Tutor.findById(appointment.tutorId);
    const isStudent = appointment.studentId.toString() === req.user.id;
    const isTutor = tutor && tutor.userId.toString() === req.user.id;

    if (!isStudent && !isTutor) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this appointment'
      });
    }

    if (status) {
      // Only tutor can confirm, only student can cancel before confirmation
      if (status === 'confirmed' && !isTutor) {
        return res.status(403).json({
          success: false,
          message: 'Only tutor can confirm appointments'
        });
      }
      appointment.status = status;
    }

    if (dateTime && isStudent && appointment.status === 'pending') {
      appointment.dateTime = dateTime;
    }

    if (notes) {
      appointment.notes = notes;
    }

    if (req.body.meetingLink) {
      appointment.meetingLink = req.body.meetingLink;
    }

    await appointment.save();

    const updatedAppointment = await Appointment.findById(id)
      .populate('studentId', 'name email phone profileImage')
      .populate({
        path: 'tutorId',
        populate: [
          {
            path: 'userId',
            select: 'name email phone profileImage'
          },
          {
            path: 'categoryId',
            select: 'name icon'
          }
        ]
      });

    res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Delete/Cancel appointment
// @route   DELETE /api/appointments/:id
export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if user is the student who booked
    if (appointment.studentId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this appointment'
      });
    }

    // Can only cancel if not completed
    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed appointments'
      });
    }

    await appointment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully'
    });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
// ==================== WEEKLY SCHEDULE ====================

// GET SCHEDULE (Enhanced with booking settings)
export const getSchedule = async (req, res) => {
  try {
    const tutorId = req.params.tutorId;

    // Populate scheduleAppointment to get the details
    const tutor = await Tutor.findById(tutorId).populate('scheduleAppointment');

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: "Tutor not found",
      });
    }

    // Handle case where schedule hasn't been created yet
    const scheduleDoc = tutor.scheduleAppointment || {};

    // Sort availability by day order
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sortedAvailability = (scheduleDoc.availability || []).sort(
      (a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
    );

    // Response structure remains EXACTLY the same for frontend
    res.json({
      success: true,
      schedule: sortedAvailability,
      dateOverrides: scheduleDoc.dateOverrides || [],
      bookingSettings: scheduleDoc.bookingSettings || {
        minAdvanceHours: 24,
        maxAdvanceDays: 60,
        allowSameDayBooking: false,
        slotCapacity: 1,
        bufferBetweenSlots: 0
      },
      timezone: tutor.timezone || 'UTC', // Timezone usually stays on Tutor or can be moved, assuming Tutor for now based on your old schema context, adapt if moved.
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// SAVE/UPDATE WEEKLY SCHEDULE
export const saveSchedule = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const availability = req.body.availability || [];

    const validationError = validateAvailability(availability);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    // 1. Find Tutor
    const tutor = await Tutor.findOne({ userId: tutorId });
    if (!tutor) {
      return res.status(404).json({ success: false, message: "Tutor not found" });
    }

    let scheduleDoc;

    // 2. Check if ScheduleAppointment exists
    if (tutor.scheduleAppointment) {
      // Update existing
      scheduleDoc = await ScheduleAppointment.findByIdAndUpdate(
        tutor.scheduleAppointment,
        { availability },
        { new: true, runValidators: true }
      );
    } else {
      // Create new and link
      scheduleDoc = await ScheduleAppointment.create({ availability });
      tutor.scheduleAppointment = scheduleDoc._id;
      await tutor.save();
    }

    res.json({
      success: true,
      message: "Schedule saved successfully",
      availability: scheduleDoc.availability,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE DAY
export const deleteDay = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const day = req.params.day;

    const tutor = await Tutor.findOne({ userId: tutorId });
    if (!tutor) return res.status(404).json({ success: false, message: "Tutor not found" });

    if (!tutor.scheduleAppointment) {
      return res.status(404).json({ success: false, message: `No schedule found for ${day}` });
    }

    const scheduleDoc = await ScheduleAppointment.findById(tutor.scheduleAppointment);

    const initialLength = scheduleDoc.availability.length;
    scheduleDoc.availability = scheduleDoc.availability.filter(
      (item) => item.day !== day
    );

    if (initialLength === scheduleDoc.availability.length) {
      return res.status(404).json({
        success: false,
        message: `No schedule found for ${day}`,
      });
    }

    await scheduleDoc.save();

    res.json({
      success: true,
      message: `${day} schedule deleted successfully`,
      availability: scheduleDoc.availability,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// DELETE SPECIFIC SLOT
export const deleteSlot = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const { day, slot } = req.body;

    const tutor = await Tutor.findOne({ userId: tutorId });
    if (!tutor) return res.status(404).json({ success: false, message: "Tutor not found" });

    if (!tutor.scheduleAppointment) {
      return res.status(404).json({ success: false, message: `No schedule found for ${day}` });
    }

    const scheduleDoc = await ScheduleAppointment.findById(tutor.scheduleAppointment);

    const daySchedule = scheduleDoc.availability.find(item => item.day === day);

    if (!daySchedule) {
      return res.status(404).json({
        success: false,
        message: `No schedule found for ${day}`,
      });
    }

    daySchedule.slots = daySchedule.slots.filter(s => s !== slot);

    // If no slots left, remove the day entirely
    if (daySchedule.slots.length === 0) {
      scheduleDoc.availability = scheduleDoc.availability.filter(item => item.day !== day);
    }

    await scheduleDoc.save();

    res.json({
      success: true,
      message: "Slot deleted successfully",
      availability: scheduleDoc.availability,
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ==================== DATE OVERRIDES ====================

// BLOCK SPECIFIC DATE
export const blockDate = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const { date, reason } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD" });
    }

    const tutor = await Tutor.findOne({ userId: tutorId });
    if (!tutor) return res.status(404).json({ success: false, message: "Tutor not found" });

    // Ensure schedule document exists
    let scheduleDoc;
    if (tutor.scheduleAppointment) {
      scheduleDoc = await ScheduleAppointment.findById(tutor.scheduleAppointment);
    } else {
      scheduleDoc = await ScheduleAppointment.create({});
      tutor.scheduleAppointment = scheduleDoc._id;
      await tutor.save();
    }

    // Remove existing override for this date
    scheduleDoc.dateOverrides = scheduleDoc.dateOverrides.filter(o => o.date !== date);

    // Add new blocked date
    scheduleDoc.dateOverrides.push({
      date,
      isBlocked: true,
      reason: reason || "Not available",
      customSlots: []
    });

    await scheduleDoc.save();

    res.json({
      success: true,
      message: "Date blocked successfully",
      dateOverrides: scheduleDoc.dateOverrides,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// UNBLOCK DATE
export const unblockDate = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const date = req.params.date;

    const tutor = await Tutor.findOne({ userId: tutorId });
    if (!tutor) return res.status(404).json({ success: false, message: "Tutor not found" });

    if (tutor.scheduleAppointment) {
      const scheduleDoc = await ScheduleAppointment.findById(tutor.scheduleAppointment);
      scheduleDoc.dateOverrides = scheduleDoc.dateOverrides.filter(o => o.date !== date);
      await scheduleDoc.save();

      return res.json({
        success: true,
        message: "Date unblocked successfully",
        dateOverrides: scheduleDoc.dateOverrides,
      });
    }

    // If no schedule doc exists, technically nothing to unblock
    res.json({
      success: true,
      message: "Date unblocked successfully",
      dateOverrides: [],
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// SET CUSTOM SLOTS FOR SPECIFIC DATE
export const setCustomSlots = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const { date, slots, reason } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD" });
    }
    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ success: false, message: "Slots array is required" });
    }
    // Validate slot format
    for (const slot of slots) {
      if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(slot)) {
        return res.status(400).json({ success: false, message: `Invalid slot format: ${slot}. Expected HH:MM-HH:MM` });
      }
    }

    const tutor = await Tutor.findOne({ userId: tutorId });
    if (!tutor) return res.status(404).json({ success: false, message: "Tutor not found" });

    let scheduleDoc;
    if (tutor.scheduleAppointment) {
      scheduleDoc = await ScheduleAppointment.findById(tutor.scheduleAppointment);
    } else {
      scheduleDoc = await ScheduleAppointment.create({});
      tutor.scheduleAppointment = scheduleDoc._id;
      await tutor.save();
    }

    // Remove existing override
    scheduleDoc.dateOverrides = scheduleDoc.dateOverrides.filter(o => o.date !== date);

    // Add custom slots
    scheduleDoc.dateOverrides.push({
      date,
      isBlocked: false,
      reason: reason || "Custom availability",
      customSlots: slots
    });

    await scheduleDoc.save();

    res.json({
      success: true,
      message: "Custom slots set successfully",
      dateOverrides: scheduleDoc.dateOverrides,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET DATE OVERRIDES (for a date range)
export const getDateOverrides = async (req, res) => {
  try {
    const tutorId = req.params.tutorId;
    const { startDate, endDate } = req.query;

    const tutor = await Tutor.findById(tutorId).populate('scheduleAppointment');

    if (!tutor) {
      return res.status(404).json({ success: false, message: "Tutor not found" });
    }

    const scheduleDoc = tutor.scheduleAppointment || {};
    let overrides = scheduleDoc.dateOverrides || [];

    // Filter by date range if provided
    if (startDate && endDate) {
      overrides = overrides.filter(o => o.date >= startDate && o.date <= endDate);
    }

    res.json({
      success: true,
      dateOverrides: overrides,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== BOOKING SETTINGS ====================

// UPDATE BOOKING SETTINGS
export const updateBookingSettings = async (req, res) => {
  try {
    const tutorId = req.user.id;
    const settings = req.body;

    // Validate settings
    if (settings.minAdvanceHours !== undefined && settings.minAdvanceHours < 0) {
      return res.status(400).json({ success: false, message: "minAdvanceHours must be >= 0" });
    }
    if (settings.maxAdvanceDays !== undefined && settings.maxAdvanceDays < 1) {
      return res.status(400).json({ success: false, message: "maxAdvanceDays must be >= 1" });
    }

    const tutor = await Tutor.findOne({ userId: tutorId });
    if (!tutor) return res.status(404).json({ success: false, message: "Tutor not found" });

    let scheduleDoc;
    if (tutor.scheduleAppointment) {
      // Update existing
      scheduleDoc = await ScheduleAppointment.findByIdAndUpdate(
        tutor.scheduleAppointment,
        { bookingSettings: settings },
        { new: true }
      );
    } else {
      // Create new
      scheduleDoc = await ScheduleAppointment.create({ bookingSettings: settings });
      tutor.scheduleAppointment = scheduleDoc._id;
      await tutor.save();
    }

    res.json({
      success: true,
      message: "Booking settings updated successfully",
      bookingSettings: scheduleDoc.bookingSettings,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== AVAILABILITY CHECK ====================

// CHECK SLOT AVAILABILITY (for booking validation)
export const checkSlotAvailability = async (req, res) => {
  try {
    const { tutorId, date, slot } = req.query;

    if (!tutorId || !date || !slot) {
      return res.status(400).json({ success: false, message: "tutorId, date, and slot are required" });
    }

    // Populate here to get settings
    const tutor = await Tutor.findById(tutorId).populate('scheduleAppointment');

    if (!tutor) {
      return res.status(404).json({ success: false, message: "Tutor not found" });
    }

    const scheduleDoc = tutor.scheduleAppointment || {};
    const settings = scheduleDoc.bookingSettings || {};
    const overrides = scheduleDoc.dateOverrides || [];

    // Check booking window
    const requestDate = new Date(date);
    const now = new Date();

    const minDate = new Date(now.getTime() + (settings.minAdvanceHours || 24) * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + (settings.maxAdvanceDays || 60) * 24 * 60 * 60 * 1000);

    if (requestDate < minDate || requestDate > maxDate) {
      return res.json({
        success: true,
        available: false,
        reason: "Outside booking window",
      });
    }

    // Check if date is blocked in the new model
    const override = overrides.find(o => o.date === date);
    if (override && override.isBlocked) {
      return res.json({
        success: true,
        available: false,
        reason: override.reason || "Date blocked",
      });
    }

    // Check slot capacity (Logic remains same, checking Appointments collection)
    const [startTime] = slot.split('-');
    const [hours, minutes] = startTime.split(':').map(Number);
    const appointmentDateTime = new Date(requestDate);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    const bookedCount = await Appointment.countDocuments({
      tutorId,
      dateTime: appointmentDateTime,
      status: { $in: ['pending', 'confirmed'] }
    });

    const capacity = settings.slotCapacity || 1;

    res.json({
      success: true,
      available: bookedCount < capacity,
      bookedCount,
      capacity,
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== HELPER FUNCTIONS ====================

function validateAvailability(availability) {
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  for (const item of availability) {
    if (!validDays.includes(item.day)) {
      return `Invalid day: ${item.day}`;
    }

    if (!Array.isArray(item.slots) || item.slots.length === 0) {
      return `${item.day} must have at least one slot`;
    }

    for (const slot of item.slots) {
      if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(slot)) {
        return `Invalid slot format: ${slot}. Expected HH:MM-HH:MM`;
      }

      const [start, end] = slot.split('-');
      if (start >= end) {
        return `Invalid time range in slot: ${slot}`;
      }
    }

    const overlap = checkOverlap(item.slots);
    if (overlap) {
      return `Overlapping slots found for ${item.day}: ${overlap}`;
    }
  }

  return null;
}

function checkOverlap(slots) {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const [start1, end1] = slots[i].split('-');
      const [start2, end2] = slots[j].split('-');

      if (start1 < end2 && start2 < end1) {
        return `${slots[i]} and ${slots[j]}`;
      }
    }
  }
  return null;
}