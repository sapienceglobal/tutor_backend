import Appointment from '../models/Appointment.js';
import Tutor from '../models/Tutor.js';
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