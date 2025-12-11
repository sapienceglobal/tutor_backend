// lib/widgets/appointment_booking_UI.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:my_app/providers/appointment_provider.dart';
import 'package:my_app/providers/schedule_provider.dart';

class BookingSection extends StatefulWidget {
  final String tutorId;
  final String tutorName;
  final double hourlyRate;

  const BookingSection({
    super.key,
    required this.tutorId,
    required this.tutorName,
    required this.hourlyRate,
  });

  @override
  State<BookingSection> createState() => _BookingSectionState();
}

class _BookingSectionState extends State<BookingSection> {
  DateTime? _selectedDate;
  String? _selectedSlot;
  int _selectedDuration = 60; // minutes
  final TextEditingController _notesController = TextEditingController();

  bool _isLoadingSlots = false;
  List<String> _availableSlots = [];
  String? _selectedDay;

  @override
  void initState() {
    super.initState();
    _loadTutorSchedule();
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadTutorSchedule() async {
    setState(() => _isLoadingSlots = true);

    final scheduleProvider = Provider.of<ScheduleProvider>(
      context,
      listen: false,
    );

    try {
      await scheduleProvider.loadSchedule(widget.tutorId);
    } catch (e) {
      _showSnackBar('Failed to load schedule: ${e.toString()}', isError: true);
    } finally {
      setState(() => _isLoadingSlots = false);
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  DateTime _findFirstSelectableDate(ScheduleProvider provider) {
    DateTime date = provider.bookingSettings.minBookingDate;

    while (date.isBefore(provider.bookingSettings.maxBookingDate)) {
      if (!provider.isDateBlocked(date) &&
          provider.getSlotsForDate(date).isNotEmpty) {
        return date;
      }
      date = date.add(const Duration(days: 1));
    }

    return provider.bookingSettings.minBookingDate; // fallback
  }

  Future<void> _selectDate() async {
    final scheduleProvider = Provider.of<ScheduleProvider>(
      context,
      listen: false,
    );

    if (scheduleProvider.weeklySlots.isEmpty) {
      _showSnackBar('Tutor has not set availability yet', isError: true);
      return;
    }
    final initialValidDate = _findFirstSelectableDate(scheduleProvider);
    final picked = await showDatePicker(
      context: context,
      initialDate: initialValidDate,
      firstDate: scheduleProvider.bookingSettings.minBookingDate,
      lastDate: scheduleProvider.bookingSettings.maxBookingDate,
      selectableDayPredicate: (DateTime date) {
        // Check if date is blocked
        if (scheduleProvider.isDateBlocked(date)) {
          return false;
        }

        // Check if date has slots (weekly template or custom)
        final slots = scheduleProvider.getSlotsForDate(date);
        return slots.isNotEmpty;
      },
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.light(
              primary: Theme.of(context).primaryColor,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedDate = picked;
        _selectedSlot = null;
        _selectedDay = DateFormat('EEEE').format(picked);
        _loadAvailableSlots();
      });
    }
  }

  void _loadAvailableSlots() {
    if (_selectedDate == null) return;

    final scheduleProvider = Provider.of<ScheduleProvider>(
      context,
      listen: false,
    );
    final slots = scheduleProvider.getSlotsForDate(_selectedDate!);

    setState(() {
      _availableSlots = slots;
    });
  }

  double get _totalAmount {
    final hours = _selectedDuration / 60;
    return widget.hourlyRate * hours;
  }

  Future<void> _bookAppointment() async {
    if (_selectedDate == null) {
      _showSnackBar('Please select a date', isError: true);
      return;
    }

    if (_selectedSlot == null) {
      _showSnackBar('Please select a time slot', isError: true);
      return;
    }

    // Parse slot time
    final startTime = _selectedSlot!.split('-')[0];
    final timeParts = startTime.split(':');
    final hour = int.parse(timeParts[0]);
    final minute = int.parse(timeParts[1]);

    final appointmentDateTime = DateTime(
      _selectedDate!.year,
      _selectedDate!.month,
      _selectedDate!.day,
      hour,
      minute,
    );

    final appointmentProvider = Provider.of<AppointmentProvider>(
      context,
      listen: false,
    );

    final success = await appointmentProvider.createAppointment(
      tutorId: widget.tutorId,
      dateTime: appointmentDateTime,
      duration: _selectedDuration,
      notes: _notesController.text,
    );

    if (success) {
      _showSnackBar('Appointment booked successfully!');
      setState(() {
        _selectedDate = null;
        _selectedSlot = null;
        _selectedDay = null;
        _availableSlots = [];
        _notesController.clear();
      });
    } else {
      _showSnackBar(
        appointmentProvider.error ?? 'Failed to book appointment',
        isError: true,
      );
    }
  }

  Widget _buildDurationChip(int minutes) {
    final isSelected = _selectedDuration == minutes;
    final hours = minutes / 60;

    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedDuration = minutes),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected
                ? Theme.of(context).primaryColor
                : Colors.grey[200],
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected
                  ? Theme.of(context).primaryColor
                  : Colors.grey[300]!,
              width: 2,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                hours >= 1 ? '${hours.toInt()}h' : '${minutes}m',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isSelected ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '₹${(widget.hourlyRate * hours).toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 12,
                  color: isSelected ? Colors.white70 : Colors.black54,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSlotChip(String slot) {
    final isSelected = _selectedSlot == slot;
    final parts = slot.split('-');
    final startTime = parts[0];
    final endTime = parts[1];

    return InkWell(
      onTap: () => setState(() => _selectedSlot = slot),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? Theme.of(context).primaryColor.withOpacity(0.1)
              : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? Theme.of(context).primaryColor
                : Colors.grey[300]!,
            width: 2,
          ),
        ),
        child: Column(
          children: [
            Icon(
              Icons.access_time,
              color: isSelected
                  ? Theme.of(context).primaryColor
                  : Colors.grey[600],
              size: 20,
            ),
            const SizedBox(height: 4),
            Text(
              startTime,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: isSelected
                    ? Theme.of(context).primaryColor
                    : Colors.black87,
              ),
            ),
            Text('to', style: TextStyle(fontSize: 10, color: Colors.grey[600])),
            Text(
              endTime,
              style: TextStyle(
                fontSize: 12,
                color: isSelected
                    ? Theme.of(context).primaryColor
                    : Colors.black54,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheduleProvider = Provider.of<ScheduleProvider>(context);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.event_available,
                  color: Theme.of(context).primaryColor,
                ),
              ),
              const SizedBox(width: 12),
              const Text(
                'Book Appointment',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Loading State
          if (_isLoadingSlots)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: CircularProgressIndicator(),
              ),
            )
          else if (scheduleProvider.weeklySlots.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.orange[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.orange[200]!),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.orange[700]),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'This tutor has not set up their availability yet',
                      style: TextStyle(color: Colors.orange[700]),
                    ),
                  ),
                ],
              ),
            )
          else ...[
            // Booking Window Info
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.blue[200]!),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, size: 18, color: Colors.blue[700]),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Book ${scheduleProvider.bookingSettings.minAdvanceHours}h - ${scheduleProvider.bookingSettings.maxAdvanceDays} days in advance',
                      style: TextStyle(fontSize: 12, color: Colors.blue[700]),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Date Picker
            InkWell(
              onTap: _selectDate,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey[300]!),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.calendar_today,
                      color: Theme.of(context).primaryColor,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Select Date',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey[600],
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _selectedDate == null
                                ? 'Choose available date'
                                : DateFormat(
                                    'EEEE, MMM dd, yyyy',
                                  ).format(_selectedDate!),
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      Icons.arrow_forward_ios,
                      size: 16,
                      color: Colors.grey[400],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Available Slots
            if (_selectedDate != null) ...[
              Row(
                children: [
                  Icon(Icons.schedule, size: 20, color: Colors.grey[700]),
                  const SizedBox(width: 8),
                  Text(
                    'Available Time Slots',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[800],
                    ),
                  ),
                  if (scheduleProvider.hasCustomSlots(_selectedDate!))
                    Container(
                      margin: const EdgeInsets.only(left: 8),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.purple[100],
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        'Special',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.purple[700],
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),

              if (_availableSlots.isEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.red[50],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.event_busy, color: Colors.red[700]),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'No slots available for this day',
                          style: TextStyle(color: Colors.red[700]),
                        ),
                      ),
                    ],
                  ),
                )
              else
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    childAspectRatio: 1,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: _availableSlots.length,
                  itemBuilder: (context, index) {
                    return _buildSlotChip(_availableSlots[index]);
                  },
                ),
              const SizedBox(height: 24),
            ],

            // Duration Selector
            if (_selectedSlot != null) ...[
              Row(
                children: [
                  Icon(Icons.timer, size: 20, color: Colors.grey[700]),
                  const SizedBox(width: 8),
                  Text(
                    'Session Duration',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey[800],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _buildDurationChip(30),
                  const SizedBox(width: 8),
                  _buildDurationChip(60),
                  const SizedBox(width: 8),
                  _buildDurationChip(90),
                  const SizedBox(width: 8),
                  _buildDurationChip(120),
                ],
              ),
              const SizedBox(height: 20),

              // Notes
              TextField(
                controller: _notesController,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Notes (Optional)',
                  hintText: 'Add any specific requirements or topics...',
                  prefixIcon: const Icon(Icons.note),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.grey[300]!),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: Theme.of(context).primaryColor,
                      width: 2,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Amount Display
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Theme.of(context).primaryColor.withOpacity(0.1),
                      Theme.of(context).primaryColor.withOpacity(0.05),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Theme.of(context).primaryColor.withOpacity(0.3),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Total Amount',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey[700],
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${_selectedDuration} minutes session',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                    Text(
                      '₹${_totalAmount.toStringAsFixed(2)}',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).primaryColor,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Book Button
              Consumer<AppointmentProvider>(
                builder: (context, appointmentProvider, _) {
                  return SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: appointmentProvider.isLoading
                          ? null
                          : _bookAppointment,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Theme.of(context).primaryColor,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 2,
                      ),
                      child: appointmentProvider.isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.check_circle_outline),
                                const SizedBox(width: 8),
                                Text(
                                  'Confirm Booking - ₹${_totalAmount.toStringAsFixed(0)}',
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  );
                },
              ),
            ],
          ],
          const SizedBox(height: 16),

          // Available Days Info
          if (!_isLoadingSlots && scheduleProvider.weeklySlots.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.blue[50],
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        size: 16,
                        color: Colors.blue[700],
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Available Days',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.blue[700],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: scheduleProvider.weeklySlots.keys.map((day) {
                      return Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.blue[100],
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          day.substring(0, 3),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.blue[800],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
