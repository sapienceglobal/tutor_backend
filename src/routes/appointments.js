import express from 'express';
import {
  getMyAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  
  getSchedule,
  saveSchedule,
  deleteDay,
  deleteSlot,
  blockDate,
  unblockDate,
  setCustomSlots,
  getDateOverrides,
  updateBookingSettings,
  checkSlotAvailability
} from '../controllers/appointmentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
// --- Weekly Schedule (existing) ---
router.get("/schedule/:tutorId", getSchedule);
router.post("/schedule", saveSchedule);
router.delete("/schedule/:day", deleteDay);
router.post("/schedule/slot/delete", deleteSlot);

// --- Date Overrides (NEW) ---
router.post("/schedule/block-date", blockDate);
router.delete("/schedule/unblock-date/:date", unblockDate);
router.post("/schedule/custom-slots", setCustomSlots);
router.get("/schedule/overrides/:tutorId", getDateOverrides);

// --- Booking Settings (NEW) ---
router.put("/schedule/booking-settings", updateBookingSettings);

// --- Availability Check (NEW) ---
router.get("/schedule/check-availability", checkSlotAvailability);

// --- Then appointment routes ---
router.get('/', getMyAppointments);
router.post('/', createAppointment);

router.get('/:id', getAppointmentById);
router.patch('/:id', updateAppointment);
router.delete('/:id', deleteAppointment);

export default router;
