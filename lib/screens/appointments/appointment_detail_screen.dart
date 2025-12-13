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
    IconData statusIcon;
    switch (appointment.status) {
      case 'confirmed':
        statusColor = const Color(0xFF43A047);
        statusIcon = Icons.check_circle_rounded;
        break;
      case 'pending':
        statusColor = const Color(0xFFFFA726);
        statusIcon = Icons.schedule_rounded;
        break;
      case 'completed':
        statusColor = const Color(0xFF42A5F5);
        statusIcon = Icons.done_all_rounded;
        break;
      case 'cancelled':
        statusColor = const Color(0xFFE53935);
        statusIcon = Icons.cancel_rounded;
        break;
      default:
        statusColor = Colors.grey;
        statusIcon = Icons.info_outline;
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FE),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Appointment Details',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Color(0xFF1A1A1A),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [statusColor, statusColor.withOpacity(0.8)],
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: statusColor.withOpacity(0.4),
                    blurRadius: 12,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.3),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(statusIcon, color: Colors.white, size: 32),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Status',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          appointment.status.toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Participant Section
            _buildSection(
              title: isStudent ? 'Tutor Information' : 'Student Information',
              icon: Icons.person_rounded,
              child: Column(
                children: [
                  _buildInfoRow(
                    icon: Icons.badge_rounded,
                    label: 'Name',
                    value: isStudent
                        ? appointment.tutor.user.name
                        : appointment.student.name,
                    color: const Color(0xFF42A5F5),
                  ),
                  const SizedBox(height: 12),
                  _buildInfoRow(
                    icon: Icons.email_rounded,
                    label: 'Email',
                    value: isStudent
                        ? appointment.tutor.user.email
                        : appointment.student.email,
                    color: const Color(0xFFEF5350),
                  ),
                  const SizedBox(height: 12),
                  _buildInfoRow(
                    icon: Icons.phone_rounded,
                    label: 'Phone',
                    value: isStudent
                        ? appointment.tutor.user.phone
                        : appointment.student.phone,
                    color: const Color(0xFF66BB6A),
                  ),
                  if (isStudent) ...[
                    const SizedBox(height: 12),
                    _buildInfoRow(
                      icon: Icons.category_rounded,
                      label: 'Category',
                      value: appointment.tutor.category.name,
                      color: const Color(0xFFAB47BC),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Appointment Details Section
            _buildSection(
              title: 'Appointment Details',
              icon: Icons.calendar_month_rounded,
              child: Column(
                children: [
                  _buildInfoRow(
                    icon: Icons.calendar_today_rounded,
                    label: 'Date',
                    value: DateFormat('EEEE, MMM dd, yyyy')
                        .format(appointment.dateTime),
                    color: const Color(0xFF42A5F5),
                  ),
                  const SizedBox(height: 12),
                  _buildInfoRow(
                    icon: Icons.access_time_rounded,
                    label: 'Time',
                    value: DateFormat('hh:mm a').format(appointment.dateTime),
                    color: const Color(0xFFAB47BC),
                  ),
                  const SizedBox(height: 12),
                  _buildInfoRow(
                    icon: Icons.timer_rounded,
                    label: 'Duration',
                    value: '${appointment.duration} minutes',
                    color: const Color(0xFF26A69A),
                  ),
                  const SizedBox(height: 12),
                  _buildInfoRow(
                    icon: Icons.currency_rupee_rounded,
                    label: 'Amount',
                    value: '₹${appointment.amount.toStringAsFixed(2)}',
                    color: AppColors.primary,
                  ),
                ],
              ),
            ),

            // Notes Section
            if (appointment.notes.isNotEmpty) ...[
              const SizedBox(height: 20),
              _buildSection(
                title: 'Notes',
                icon: Icons.note_rounded,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Colors.grey.shade300,
                    ),
                  ),
                  child: Text(
                    appointment.notes,
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.6,
                      color: Colors.grey.shade800,
                    ),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 24),

            // Action Buttons
            if (appointment.status == 'pending') ...[
              if (isTutor)
                _buildActionButton(
                  context: context,
                  label: 'Confirm Appointment',
                  icon: Icons.check_circle_rounded,
                  gradient: const LinearGradient(
                    colors: [Color(0xFF43A047), Color(0xFF66BB6A)],
                  ),
                  onPressed: () => _confirmAppointment(context),
                ),
              if (isStudent) ...[
                const SizedBox(height: 12),
                _buildActionButton(
                  context: context,
                  label: 'Cancel Appointment',
                  icon: Icons.cancel_rounded,
                  gradient: const LinearGradient(
                    colors: [Color(0xFFE53935), Color(0xFFEF5350)],
                  ),
                  onPressed: () => _cancelAppointment(context),
                  isOutlined: true,
                ),
              ],
            ],
            if (appointment.status == 'confirmed' && isTutor)
              _buildActionButton(
                context: context,
                label: 'Mark as Completed',
                icon: Icons.done_all_rounded,
                gradient: LinearGradient(
                  colors: [AppColors.primary, AppColors.primary.withOpacity(0.8)],
                ),
                onPressed: () => _completeAppointment(context),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required IconData icon,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 12),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1A1A1A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: color.withOpacity(0.3),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton({
    required BuildContext context,
    required String label,
    required IconData icon,
    required Gradient gradient,
    required VoidCallback onPressed,
    bool isOutlined = false,
  }) {
    return Consumer<AppointmentProvider>(
      builder: (context, appointmentProvider, _) {
        return Container(
          height: 56,
          decoration: BoxDecoration(
            gradient: isOutlined ? null : gradient,
            borderRadius: BorderRadius.circular(16),
            border: isOutlined
                ? Border.all(color: gradient.colors.first, width: 2)
                : null,
            boxShadow: isOutlined
                ? []
                : [
                    BoxShadow(
                      color: gradient.colors.first.withOpacity(0.4),
                      blurRadius: 12,
                      offset: const Offset(0, 6),
                    ),
                  ],
          ),
          child: ElevatedButton(
            onPressed: appointmentProvider.isLoading ? null : onPressed,
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  isOutlined ? Colors.transparent : Colors.transparent,
              shadowColor: Colors.transparent,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            child: appointmentProvider.isLoading
                ? SizedBox(
                    height: 24,
                    width: 24,
                    child: CircularProgressIndicator(
                      color: isOutlined ? gradient.colors.first : Colors.white,
                      strokeWidth: 3,
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        icon,
                        color: isOutlined ? gradient.colors.first : Colors.white,
                      ),
                      const SizedBox(width: 12),
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isOutlined ? gradient.colors.first : Colors.white,
                        ),
                      ),
                    ],
                  ),
          ),
        );
      },
    );
  }

  Future<void> _confirmAppointment(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.check_circle_outline, color: Color(0xFF43A047)),
            SizedBox(width: 12),
            Text('Confirm Appointment'),
          ],
        ),
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
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF43A047),
            ),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(
                  success ? Icons.check_circle : Icons.error_outline,
                  color: Colors.white,
                ),
                const SizedBox(width: 12),
                Text(
                  success
                      ? 'Appointment confirmed successfully'
                      : appointmentProvider.error ?? 'Failed to confirm',
                ),
              ],
            ),
            backgroundColor: success ? const Color(0xFF43A047) : const Color(0xFFE53935),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
        if (success) Navigator.of(context).pop();
      }
    }
  }

  Future<void> _completeAppointment(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.done_all, color: Color(0xFF42A5F5)),
            SizedBox(width: 12),
            Text('Complete Appointment'),
          ],
        ),
        content: const Text('Mark this appointment as completed?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF42A5F5),
            ),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(
                  success ? Icons.check_circle : Icons.error_outline,
                  color: Colors.white,
                ),
                const SizedBox(width: 12),
                Text(
                  success
                      ? 'Appointment completed successfully'
                      : appointmentProvider.error ?? 'Failed to complete',
                ),
              ],
            ),
            backgroundColor: success ? const Color(0xFF43A047) : const Color(0xFFE53935),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
        if (success) Navigator.of(context).pop();
      }
    }
  }

  Future<void> _cancelAppointment(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.cancel, color: Color(0xFFE53935)),
            SizedBox(width: 12),
            Text('Cancel Appointment'),
          ],
        ),
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
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFE53935),
            ),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                Icon(
                  success ? Icons.check_circle : Icons.error_outline,
                  color: Colors.white,
                ),
                const SizedBox(width: 12),
                Text(
                  success
                      ? 'Appointment cancelled successfully'
                      : appointmentProvider.error ?? 'Failed to cancel',
                ),
              ],
            ),
            backgroundColor: success ? const Color(0xFF43A047) : const Color(0xFFE53935),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
        if (success) Navigator.of(context).pop();
      }
    }
  }
}