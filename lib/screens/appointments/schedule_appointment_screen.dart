// lib/screens/tutor/schedule_management_screen.dart

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:my_app/providers/schedule_provider.dart';
import 'package:my_app/models/schedule_models.dart';

class ScheduleManagementScreen extends StatefulWidget {
  const ScheduleManagementScreen({super.key});

  @override
  State<ScheduleManagementScreen> createState() =>
      _ScheduleManagementScreenState();
}

class _ScheduleManagementScreenState extends State<ScheduleManagementScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadSchedule();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadSchedule() async {
    final provider = Provider.of<ScheduleProvider>(context, listen: false);
    // Load with current tutor ID (get from auth provider or pass as parameter)
    // await provider.loadSchedule(tutorId);
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Manage Schedule'),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.calendar_view_week), text: 'Weekly'),
            Tab(icon: Icon(Icons.block), text: 'Blocked'),
            Tab(icon: Icon(Icons.settings), text: 'Settings'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _WeeklyScheduleTab(onSnackBar: _showSnackBar),
          _BlockedDatesTab(onSnackBar: _showSnackBar),
          _BookingSettingsTab(onSnackBar: _showSnackBar),
        ],
      ),
    );
  }
}

// ==================== WEEKLY SCHEDULE TAB ====================

class _WeeklyScheduleTab extends StatelessWidget {
  final Function(String, {bool isError}) onSnackBar;

  const _WeeklyScheduleTab({required this.onSnackBar});

  void _showAddSlotDialog(BuildContext context, String day) {
    final provider = Provider.of<ScheduleProvider>(context, listen: false);
    TimeOfDay startTime = const TimeOfDay(hour: 9, minute: 0);
    TimeOfDay endTime = const TimeOfDay(hour: 10, minute: 0);

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text('Add Slot for $day'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                title: const Text('Start Time'),
                trailing: TextButton(
                  onPressed: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: startTime,
                    );
                    if (picked != null) {
                      setState(() => startTime = picked);
                    }
                  },
                  child: Text(startTime.format(context)),
                ),
              ),
              ListTile(
                title: const Text('End Time'),
                trailing: TextButton(
                  onPressed: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: endTime,
                    );
                    if (picked != null) {
                      setState(() => endTime = picked);
                    }
                  },
                  child: Text(endTime.format(context)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                final slot =
                    '${_formatTime(startTime)}-${_formatTime(endTime)}';
                final error = provider.setDaySlot(day, slot);

                if (error != null) {
                  onSnackBar(error, isError: true);
                } else {
                  onSnackBar('Slot added successfully');
                  Navigator.pop(context);
                }
              },
              child: const Text('Add'),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(TimeOfDay time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }

  void _showQuickAddDialog(BuildContext context, String day) {
    final provider = Provider.of<ScheduleProvider>(context, listen: false);
    TimeOfDay startTime = const TimeOfDay(hour: 9, minute: 0);
    TimeOfDay endTime = const TimeOfDay(hour: 17, minute: 0);
    int slotDuration = 60;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text('Quick Add Slots - $day'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                title: const Text('Start Time'),
                trailing: TextButton(
                  onPressed: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: startTime,
                    );
                    if (picked != null) {
                      setState(() => startTime = picked);
                    }
                  },
                  child: Text(startTime.format(context)),
                ),
              ),
              ListTile(
                title: const Text('End Time'),
                trailing: TextButton(
                  onPressed: () async {
                    final picked = await showTimePicker(
                      context: context,
                      initialTime: endTime,
                    );
                    if (picked != null) {
                      setState(() => endTime = picked);
                    }
                  },
                  child: Text(endTime.format(context)),
                ),
              ),
              ListTile(
                title: const Text('Slot Duration'),
                trailing: DropdownButton<int>(
                  value: slotDuration,
                  items: [30, 60, 90, 120].map((min) {
                    return DropdownMenuItem(
                      value: min,
                      child: Text('$min min'),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setState(() => slotDuration = val);
                    }
                  },
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                _generateSlots(
                  context,
                  provider,
                  day,
                  startTime,
                  endTime,
                  slotDuration,
                );
                Navigator.pop(context);
              },
              child: const Text('Generate'),
            ),
          ],
        ),
      ),
    );
  }

  void _generateSlots(
    BuildContext context,
    ScheduleProvider provider,
    String day,
    TimeOfDay start,
    TimeOfDay end,
    int duration,
  ) {
    int startMinutes = start.hour * 60 + start.minute;
    int endMinutes = end.hour * 60 + end.minute;

    int added = 0;
    while (startMinutes + duration <= endMinutes) {
      final slotStart = TimeOfDay(
        hour: startMinutes ~/ 60,
        minute: startMinutes % 60,
      );
      final slotEnd = TimeOfDay(
        hour: (startMinutes + duration) ~/ 60,
        minute: (startMinutes + duration) % 60,
      );

      final slot = '${_formatTime(slotStart)}-${_formatTime(slotEnd)}';
      final error = provider.setDaySlot(day, slot);

      if (error == null) added++;

      startMinutes += duration;
    }

    onSnackBar('$added slots added successfully');
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ScheduleProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        final days = [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ];

        return Column(
          children: [
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: days.length,
                itemBuilder: (context, index) {
                  final day = days[index];
                  final slots = provider.weeklySlots[day] ?? [];
                  final hasSlots = slots.isNotEmpty;

                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ExpansionTile(
                      title: Text(
                        day,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        hasSlots ? '${slots.length} slots' : 'Not available',
                        style: TextStyle(
                          color: hasSlots ? Colors.green : Colors.grey,
                        ),
                      ),
                      trailing: hasSlots
                          ? IconButton(
                              icon: const Icon(Icons.delete, color: Colors.red),
                              onPressed: () async {
                                final confirm = await showDialog<bool>(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Text('Delete Day'),
                                    content: Text('Remove all slots for $day?'),
                                    actions: [
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pop(ctx, false),
                                        child: const Text('Cancel'),
                                      ),
                                      ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: Colors.red,
                                        ),
                                        onPressed: () =>
                                            Navigator.pop(ctx, true),
                                        child: const Text('Delete'),
                                      ),
                                    ],
                                  ),
                                );

                                if (confirm == true) {
                                  try {
                                    await provider.deleteDay(day);
                                    onSnackBar('Day removed successfully');
                                  } catch (e) {
                                    onSnackBar(e.toString(), isError: true);
                                  }
                                }
                              },
                            )
                          : null,
                      children: [
                        if (hasSlots)
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: slots.map((slot) {
                                return Chip(
                                  label: Text(slot),
                                  deleteIcon: const Icon(Icons.close, size: 18),
                                  onDeleted: () =>
                                      provider.removeSlot(day, slot),
                                );
                              }).toList(),
                            ),
                          ),
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () =>
                                      _showAddSlotDialog(context, day),
                                  icon: const Icon(Icons.add),
                                  label: const Text('Add Slot'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () =>
                                      _showQuickAddDialog(context, day),
                                  icon: const Icon(Icons.auto_awesome),
                                  label: const Text('Quick Add'),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Container(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: provider.weeklySlots.isEmpty
                      ? null
                      : () async {
                          try {
                            await provider.saveSchedule();
                            onSnackBar('Schedule saved successfully');
                          } catch (e) {
                            onSnackBar(e.toString(), isError: true);
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text('Save Schedule'),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

// ==================== BLOCKED DATES TAB ====================

class _BlockedDatesTab extends StatelessWidget {
  final Function(String, {bool isError}) onSnackBar;

  const _BlockedDatesTab({required this.onSnackBar});

  void _showBlockDateDialog(BuildContext context) {
    final provider = Provider.of<ScheduleProvider>(context, listen: false);
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1));
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Block Date'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                title: const Text('Date'),
                subtitle: Text(DateFormat('MMM dd, yyyy').format(selectedDate)),
                trailing: IconButton(
                  icon: const Icon(Icons.calendar_today),
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: selectedDate,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) {
                      setState(() => selectedDate = picked);
                    }
                  },
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: reasonController,
                decoration: const InputDecoration(
                  labelText: 'Reason (Optional)',
                  hintText: 'e.g., Holiday, Personal Leave',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () async {
                final dateStr = provider.formatDate(selectedDate);
                try {
                  await provider.blockDate(
                    dateStr,
                    reason: reasonController.text.isEmpty
                        ? null
                        : reasonController.text,
                  );
                  onSnackBar('Date blocked successfully');
                  Navigator.pop(context);
                } catch (e) {
                  onSnackBar(e.toString(), isError: true);
                }
              },
              child: const Text('Block Date'),
            ),
          ],
        ),
      ),
    );
  }

  void _showCustomSlotsDialog(BuildContext context) {
    final provider = Provider.of<ScheduleProvider>(context, listen: false);
    DateTime selectedDate = DateTime.now().add(const Duration(days: 1));
    final reasonController = TextEditingController();
    List<String> customSlots = [];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: const Text('Set Custom Slots'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  title: const Text('Date'),
                  subtitle: Text(
                    DateFormat('MMM dd, yyyy').format(selectedDate),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.calendar_today),
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: selectedDate,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (picked != null) {
                        setState(() => selectedDate = picked);
                      }
                    },
                  ),
                ),
                TextField(
                  controller: reasonController,
                  decoration: const InputDecoration(
                    labelText: 'Reason (Optional)',
                    hintText: 'e.g., Exam Preparation',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                if (customSlots.isNotEmpty)
                  Wrap(
                    spacing: 8,
                    children: customSlots.map((slot) {
                      return Chip(
                        label: Text(slot),
                        deleteIcon: const Icon(Icons.close, size: 18),
                        onDeleted: () {
                          setState(() => customSlots.remove(slot));
                        },
                      );
                    }).toList(),
                  ),
                const SizedBox(height: 8),
                ElevatedButton.icon(
                  onPressed: () async {
                    TimeOfDay? start = await showTimePicker(
                      context: context,
                      initialTime: const TimeOfDay(hour: 9, minute: 0),
                    );
                    if (start == null) return;

                    TimeOfDay? end = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay(
                        hour: start.hour + 1,
                        minute: start.minute,
                      ),
                    );
                    if (end == null) return;

                    final slot = '${_formatTime(start)}-${_formatTime(end)}';
                    setState(() => customSlots.add(slot));
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Add Slot'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: customSlots.isEmpty
                  ? null
                  : () async {
                      final dateStr = provider.formatDate(selectedDate);
                      try {
                        await provider.setCustomSlots(
                          dateStr,
                          customSlots,
                          reason: reasonController.text.isEmpty
                              ? null
                              : reasonController.text,
                        );
                        onSnackBar('Custom slots set successfully');
                        Navigator.pop(context);
                      } catch (e) {
                        onSnackBar(e.toString(), isError: true);
                      }
                    },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(TimeOfDay time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ScheduleProvider>(
      builder: (context, provider, _) {
        final blockedDates =
            provider.dateOverrides.where((o) => o.isBlocked).toList()
              ..sort((a, b) => a.date.compareTo(b.date));

        final customSlotDates =
            provider.dateOverrides
                .where((o) => !o.isBlocked && o.customSlots.isNotEmpty)
                .toList()
              ..sort((a, b) => a.date.compareTo(b.date));

        return Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Blocked Dates Section
                  Row(
                    children: [
                      const Icon(Icons.block, color: Colors.red),
                      const SizedBox(width: 8),
                      const Text(
                        'Blocked Dates',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Spacer(),
                      TextButton.icon(
                        onPressed: () => _showBlockDateDialog(context),
                        icon: const Icon(Icons.add),
                        label: const Text('Block Date'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (blockedDates.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text(
                          'No blocked dates',
                          style: TextStyle(color: Colors.grey),
                        ),
                      ),
                    )
                  else
                    ...blockedDates.map((override) {
                      final date = DateTime.parse(override.date);
                      return Card(
                        child: ListTile(
                          leading: const Icon(Icons.block, color: Colors.red),
                          title: Text(
                            DateFormat('EEEE, MMM dd, yyyy').format(date),
                          ),
                          subtitle: override.reason != null
                              ? Text(override.reason!)
                              : null,
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () async {
                              try {
                                await provider.unblockDate(override.date);
                                onSnackBar('Date unblocked');
                              } catch (e) {
                                onSnackBar(e.toString(), isError: true);
                              }
                            },
                          ),
                        ),
                      );
                    }),

                  const SizedBox(height: 24),

                  // Custom Slots Section
                  Row(
                    children: [
                      const Icon(Icons.star, color: Colors.purple),
                      const SizedBox(width: 8),
                      const Text(
                        'Custom Availability',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Spacer(),
                      TextButton.icon(
                        onPressed: () => _showCustomSlotsDialog(context),
                        icon: const Icon(Icons.add),
                        label: const Text('Add Custom'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (customSlotDates.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(16),
                        child: Text(
                          'No custom availability',
                          style: TextStyle(color: Colors.grey),
                        ),
                      ),
                    )
                  else
                    ...customSlotDates.map((override) {
                      final date = DateTime.parse(override.date);
                      return Card(
                        child: ListTile(
                          leading: const Icon(Icons.star, color: Colors.purple),
                          title: Text(
                            DateFormat('EEEE, MMM dd, yyyy').format(date),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (override.reason != null)
                                Text(override.reason!),
                              const SizedBox(height: 4),
                              Wrap(
                                spacing: 4,
                                children: override.customSlots.map((slot) {
                                  return Chip(
                                    label: Text(
                                      slot,
                                      style: const TextStyle(fontSize: 11),
                                    ),
                                    materialTapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                  );
                                }).toList(),
                              ),
                            ],
                          ),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline),
                            onPressed: () async {
                              try {
                                await provider.unblockDate(override.date);
                                onSnackBar('Custom slots removed');
                              } catch (e) {
                                onSnackBar(e.toString(), isError: true);
                              }
                            },
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

// ==================== BOOKING SETTINGS TAB ====================

class _BookingSettingsTab extends StatefulWidget {
  final Function(String, {bool isError}) onSnackBar;

  const _BookingSettingsTab({required this.onSnackBar});

  @override
  State<_BookingSettingsTab> createState() => _BookingSettingsTabState();
}

class _BookingSettingsTabState extends State<_BookingSettingsTab> {
  late int minAdvanceHours;
  late int maxAdvanceDays;
  late bool allowSameDayBooking;
  late int slotCapacity;

  @override
  void initState() {
    super.initState();
    final provider = Provider.of<ScheduleProvider>(context, listen: false);
    minAdvanceHours = provider.bookingSettings.minAdvanceHours;
    maxAdvanceDays = provider.bookingSettings.maxAdvanceDays;
    allowSameDayBooking = provider.bookingSettings.allowSameDayBooking;
    slotCapacity = provider.bookingSettings.slotCapacity;
  }

  Future<void> _saveSettings() async {
    final provider = Provider.of<ScheduleProvider>(context, listen: false);

    final settings = BookingSettings(
      minAdvanceHours: minAdvanceHours,
      maxAdvanceDays: maxAdvanceDays,
      allowSameDayBooking: allowSameDayBooking,
      slotCapacity: slotCapacity,
    );

    try {
      await provider.updateBookingSettings(settings);
      widget.onSnackBar('Settings saved successfully');
    } catch (e) {
      widget.onSnackBar(e.toString(), isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Advance Booking Window',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),

                // Min Advance Hours
                ListTile(
                  title: const Text('Minimum advance booking'),
                  subtitle: Text('$minAdvanceHours hours'),
                  trailing: DropdownButton<int>(
                    value: minAdvanceHours,
                    items: [0, 12, 24, 48, 72].map((hours) {
                      return DropdownMenuItem(
                        value: hours,
                        child: Text('$hours hours'),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => minAdvanceHours = val);
                      }
                    },
                  ),
                ),

                const Divider(),

                // Max Advance Days
                ListTile(
                  title: const Text('Maximum advance booking'),
                  subtitle: Text('$maxAdvanceDays days'),
                  trailing: DropdownButton<int>(
                    value: maxAdvanceDays,
                    items: [7, 14, 30, 60, 90].map((days) {
                      return DropdownMenuItem(
                        value: days,
                        child: Text('$days days'),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => maxAdvanceDays = val);
                      }
                    },
                  ),
                ),

                const Divider(),

                // Same Day Booking
                SwitchListTile(
                  title: const Text('Allow same-day booking'),
                  subtitle: const Text('Let students book on the same day'),
                  value: allowSameDayBooking,
                  onChanged: (val) {
                    setState(() => allowSameDayBooking = val);
                  },
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 16),

        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Slot Capacity',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),

                ListTile(
                  title: const Text('Students per slot'),
                  subtitle: Text(
                    slotCapacity == 1
                        ? '1-on-1 sessions'
                        : 'Group sessions (up to $slotCapacity)',
                  ),
                  trailing: DropdownButton<int>(
                    value: slotCapacity,
                    items: [1, 2, 3, 4, 5, 10].map((capacity) {
                      return DropdownMenuItem(
                        value: capacity,
                        child: Text('$capacity'),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() => slotCapacity = val);
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 24),

        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _saveSettings,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: const Text('Save Settings'),
          ),
        ),

        const SizedBox(height: 16),

        Card(
          color: Colors.blue[50],
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.info_outline, color: Colors.blue[700]),
                    const SizedBox(width: 8),
                    Text(
                      'How it works',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.blue[900],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '• Min advance: Students must book at least this many hours before the appointment\n'
                  '• Max advance: Students can book up to this many days in the future\n'
                  '• Slot capacity: How many students can book the same time slot',
                  style: TextStyle(fontSize: 13, color: Colors.blue[900]),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
