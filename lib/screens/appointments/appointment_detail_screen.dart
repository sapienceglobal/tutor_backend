import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../models/appointment_model.dart';
import '../../providers/appointment_provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';

class AppointmentDetailScreen extends StatelessWidget {
  final AppointmentModel appointment;

  const AppointmentDetailScreen({super.key, required this.appointment});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final isStudent = authProvider.user?.role == 'student';
    final isTutor = authProvider.user?.role == 'tutor';

    Color statusColor;
    switch (appointment.status) {
      case 'confirmed':
        statusColor = Colors.green;
        break;
      case 'pending':
        statusColor = Colors.orange;
        break;
      case 'completed':
        statusColor = Colors.blue;
        break;
      case 'cancelled':
        statusColor = Colors.red;
        break;
      default:
        statusColor = Colors.grey;
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Appointment Details')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.info_outline, color: statusColor, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Status: ${appointment.status.toUpperCase()}',
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Participant Info
            _buildSectionTitle(
              isStudent ? 'Tutor Information' : 'Student Information',
            ),
            const SizedBox(height: 12),
            _buildInfoCard(
              context,
              icon: Icons.person,
              title: 'Name',
              value: isStudent
                  ? appointment.tutor.user.name
                  : appointment.student.name,
            ),
            const SizedBox(height: 8),
            _buildInfoCard(
              context,
              icon: Icons.email,
              title: 'Email',
              value: isStudent
                  ? appointment.tutor.user.email
                  : appointment.student.email,
            ),
            const SizedBox(height: 8),
            _buildInfoCard(
              context,
              icon: Icons.phone,
              title: 'Phone',
              value: isStudent
                  ? appointment.tutor.user.phone
                  : appointment.student.phone,
            ),
            if (isStudent) ...[
              const SizedBox(height: 8),
              _buildInfoCard(
                context,
                icon: Icons.category,
                title: 'Category',
                value: appointment.tutor.category.name,
              ),
            ],
            const SizedBox(height: 24),

            // Appointment Details
            _buildSectionTitle('Appointment Details'),
            const SizedBox(height: 12),
            _buildInfoCard(
              context,
              icon: Icons.calendar_today,
              title: 'Date',
              value: DateFormat(
                'EEEE, MMM dd, yyyy',
              ).format(appointment.dateTime),
            ),
            const SizedBox(height: 8),
            _buildInfoCard(
              context,
              icon: Icons.access_time,
              title: 'Time',
              value: DateFormat('hh:mm a').format(appointment.dateTime),
            ),
            const SizedBox(height: 8),
            _buildInfoCard(
              context,
              icon: Icons.timer,
              title: 'Duration',
              value: '${appointment.duration} minutes',
            ),
            const SizedBox(height: 8),
            _buildInfoCard(
              context,
              icon: Icons.attach_money,
              title: 'Amount',
              value: '₹${appointment.amount.toStringAsFixed(2)}',
            ),
            const SizedBox(height: 24),

            // Notes
            if (appointment.notes.isNotEmpty) ...[
              _buildSectionTitle('Notes'),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  appointment.notes,
                  style: const TextStyle(fontSize: 14, height: 1.5),
                ),
              ),
              const SizedBox(height: 24),
            ],

            // Action Buttons
            if (appointment.status == 'pending') ...[
              if (isTutor) ...[
                // Tutor can confirm
                Consumer<AppointmentProvider>(
                  builder: (context, appointmentProvider, _) {
                    return SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: appointmentProvider.isLoading
                            ? null
                            : () => _confirmAppointment(context),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.green,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
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
                            : const Text(
                                'Confirm Appointment',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 12),
              ],
              if (isStudent) ...[
                // Student can cancel
                Consumer<AppointmentProvider>(
                  builder: (context, appointmentProvider, _) {
                    return SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: appointmentProvider.isLoading
                            ? null
                            : () => _cancelAppointment(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red,
                          side: const BorderSide(color: Colors.red),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: appointmentProvider.isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.red,
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text(
                                'Cancel Appointment',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                    );
                  },
                ),
              ],
            ],
            if (appointment.status == 'confirmed' && isTutor) ...[
              Consumer<AppointmentProvider>(
                builder: (context, appointmentProvider, _) {
                  return SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: appointmentProvider.isLoading
                          ? null
                          : () => _completeAppointment(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
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
                          : const Text(
                              'Mark as Completed',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                  );
                },
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
    );
  }

  Widget _buildInfoCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmAppointment(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Appointment'),
        content: const Text(
          'Are you sure you want to confirm this appointment?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      final appointmentProvider = Provider.of<AppointmentProvider>(
        context,
        listen: false,
      );
      final success = await appointmentProvider.updateAppointment(
        id: appointment.id,
        status: 'confirmed',
      );

      if (context.mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Appointment confirmed successfully'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                appointmentProvider.error ?? 'Failed to confirm appointment',
              ),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  Future<void> _completeAppointment(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Complete Appointment'),
        content: const Text('Mark this appointment as completed?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Complete'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      final appointmentProvider = Provider.of<AppointmentProvider>(
        context,
        listen: false,
      );
      final success = await appointmentProvider.updateAppointment(
        id: appointment.id,
        status: 'completed',
      );

      if (context.mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Appointment completed successfully'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                appointmentProvider.error ?? 'Failed to complete appointment',
              ),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  Future<void> _cancelAppointment(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Appointment'),
        content: const Text(
          'Are you sure you want to cancel this appointment?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('No'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      final appointmentProvider = Provider.of<AppointmentProvider>(
        context,
        listen: false,
      );
      final success = await appointmentProvider.cancelAppointment(
        appointment.id,
      );

      if (context.mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Appointment cancelled successfully'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.of(context).pop();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                appointmentProvider.error ?? 'Failed to cancel appointment',
              ),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }
}
