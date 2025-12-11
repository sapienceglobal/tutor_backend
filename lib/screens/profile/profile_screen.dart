import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';
import '../../services/cloudinary_service.dart';
import '../auth/login_screen.dart';
import 'edit_profile_screen.dart';
import 'change_password_screen.dart';
import 'notification_settings_screen.dart';
import 'language_settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ImagePicker _picker = ImagePicker();
  bool _isUploadingImage = false;

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.user;
    final lang = user?.language ?? 'en';
    final localizations = AppLocalizations(lang);

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.translate('profile')),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () async {
              final result = await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const EditProfileScreen(),
                ),
              );
              if (result == true) {
                authProvider.refreshUser();
              }
            },
          ),
        ],
      ),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async {
                await authProvider.refreshUser();
              },
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    // Profile Picture
                    Center(
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(60),
                            child: CachedNetworkImage(
                              imageUrl: user.profileImage,
                              width: 120,
                              height: 120,
                              fit: BoxFit.cover,
                              placeholder: (context, url) => Container(
                                color: Colors.grey[300],
                                child: const Center(
                                  child: CircularProgressIndicator(),
                                ),
                              ),
                              errorWidget: (context, url, error) => Container(
                                color: Colors.grey[300],
                                child: const Icon(Icons.person, size: 60),
                              ),
                            ),
                          ),
                          if (_isUploadingImage)
                            Positioned.fill(
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.black54,
                                  borderRadius: BorderRadius.circular(60),
                                ),
                                child: const Center(
                                  child: CircularProgressIndicator(
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          Positioned(
                            bottom: 0,
                            right: 0,
                            child: GestureDetector(
                              onTap: _isUploadingImage
                                  ? null
                                  : () => _showImageSourceDialog(context),
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 2,
                                  ),
                                ),
                                child: const Icon(
                                  Icons.camera_alt,
                                  color: Colors.white,
                                  size: 20,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Name
                    Text(
                      user.name,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),

                    // Role Badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _getRoleText(user.role, lang),
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // User Info Card
                    _buildInfoSection(
                      context,
                      localizations: localizations,
                      title: localizations.translate('personalInformation'),
                      children: [
                        _buildInfoTile(
                          icon: Icons.email,
                          title: localizations.translate('email'),
                          value: user.email,
                        ),
                        _buildInfoTile(
                          icon: Icons.phone,
                          title: localizations.translate('phone'),
                          value: user.phone,
                        ),
                        _buildInfoTile(
                          icon: Icons.person_outline,
                          title: localizations.translate('role'),
                          value: _getRoleText(user.role, lang),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Settings Section
                    _buildInfoSection(
                      context,
                      localizations: localizations,
                      title: localizations.translate('settings'),
                      children: [
                        _buildActionTile(
                          icon: Icons.notifications_outlined,
                          title: localizations.translate('notifications'),
                          onTap: () async {
                            final result = await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    const NotificationSettingsScreen(),
                              ),
                            );
                            if (result == true) {
                              authProvider.refreshUser();
                            }
                          },
                        ),
                        _buildActionTile(
                          icon: Icons.lock_outline,
                          title: localizations.translate('changePassword'),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const ChangePasswordScreen(),
                              ),
                            );
                          },
                        ),
                        _buildActionTile(
                          icon: Icons.language,
                          title: localizations.translate('language'),
                          trailing: Text(
                            lang == 'en' ? 'English' : 'हिंदी',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 14,
                            ),
                          ),
                          onTap: () async {
                            final result = await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const LanguageSettingsScreen(),
                              ),
                            );
                            if (result == true) {
                              authProvider.refreshUser();
                              setState(() {}); // Rebuild to update language
                            }
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Support Section
                    _buildInfoSection(
                      context,
                      localizations: localizations,
                      title: localizations.translate('support'),
                      children: [
                        _buildActionTile(
                          icon: Icons.help_outline,
                          title: localizations.translate('helpAndSupport'),
                          onTap: () {
                            _showHelpDialog(context, localizations);
                          },
                        ),
                        _buildActionTile(
                          icon: Icons.info_outline,
                          title: localizations.translate('about'),
                          onTap: () {
                            _showAboutDialog(context, localizations);
                          },
                        ),
                        _buildActionTile(
                          icon: Icons.privacy_tip_outlined,
                          title: localizations.translate('privacyPolicy'),
                          onTap: () {
                            _showPrivacyPolicyDialog(context, localizations);
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Logout Button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => _logout(context, localizations),
                        icon: const Icon(Icons.logout),
                        label: Text(localizations.translate('logout')),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Version Info
                    Text(
                      '${localizations.translate('version')} 1.0.0',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
    );
  }

  String _getRoleText(String role, String lang) {
    final localizations = AppLocalizations(lang);
    switch (role) {
      case 'student':
        return localizations.translate('student');
      case 'tutor':
        return localizations.translate('tutor');
      case 'admin':
        return localizations.translate('admin');
      default:
        return role;
    }
  }

  Widget _buildInfoSection(
    BuildContext context, {
    required AppLocalizations localizations,
    required String title,
    required List<Widget> children,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
          const Divider(height: 1),
          ...children,
        ],
      ),
    );
  }

  Widget _buildInfoTile({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 16),
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

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            if (trailing != null)
              trailing
            else
              Icon(Icons.chevron_right, color: Colors.grey[400]),
          ],
        ),
      ),
    );
  }

  void _showImageSourceDialog(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final lang = authProvider.user?.language ?? 'en';
    final localizations = AppLocalizations(lang);

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              localizations.translate('changeProfilePicture'),
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 20),
            ListTile(
              leading: const Icon(Icons.camera_alt, color: AppColors.primary),
              title: Text(localizations.translate('takePhoto')),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library, color: AppColors.primary),
              title: Text(localizations.translate('chooseFromGallery')),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.gallery);
              },
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );

      if (image != null && mounted) {
        await _uploadImage(File(image.path));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error picking image: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _uploadImage(File imageFile) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final lang = authProvider.user?.language ?? 'en';
    final localizations = AppLocalizations(lang);

    setState(() {
      _isUploadingImage = true;
    });

    try {
      // Upload to Cloudinary
      final result = await CloudinaryService.uploadImage(imageFile);

      if (result != null && mounted) {
        // Update profile image in backend
        final success = await authProvider.updateProfileImage(
          profileImage: result['url'],
          cloudinaryId: result['publicId'],
        );

        if (success && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(localizations.translate('profileUpdated')),
              backgroundColor: AppColors.success,
            ),
          );
        } else if (mounted) {
          throw Exception('Failed to update profile image');
        }
      } else if (mounted) {
        throw Exception('Failed to upload image');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isUploadingImage = false;
        });
      }
    }
  }

  void _showHelpDialog(BuildContext context, AppLocalizations localizations) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(localizations.translate('helpAndSupport')),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Need help? Contact us:',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              _buildContactItem(Icons.email, 'Email', 'support@tutormanagement.com'),
              const SizedBox(height: 12),
              _buildContactItem(Icons.phone, 'Phone', '+91 1234567890'),
              const SizedBox(height: 12),
              _buildContactItem(Icons.language, 'Website', 'www.tutormanagement.com'),
              const SizedBox(height: 16),
              const Text(
                'Available: Monday - Friday, 9 AM - 6 PM IST',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(localizations.translate('cancel')),
          ),
        ],
      ),
    );
  }

  Widget _buildContactItem(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, color: AppColors.primary, size: 20),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
            Text(
              value,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ],
    );
  }

  void _showAboutDialog(BuildContext context, AppLocalizations localizations) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(localizations.translate('about')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Tutor Management App',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              '${localizations.translate('version')} 1.0.0',
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),
            const SizedBox(height: 16),
            const Text(
              'A comprehensive platform to connect students with qualified tutors. Book appointments, manage schedules, and enhance your learning experience.',
              style: TextStyle(fontSize: 14, height: 1.5),
            ),
            const SizedBox(height: 16),
            Text(
              '© 2024 Tutor Management. All rights reserved.',
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(localizations.translate('cancel')),
          ),
        ],
      ),
    );
  }

  void _showPrivacyPolicyDialog(
      BuildContext context, AppLocalizations localizations) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(localizations.translate('privacyPolicy')),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildPolicySection(
                'Data Collection',
                'We collect personal information such as name, email, phone number, and profile pictures to provide our services.',
              ),
              _buildPolicySection(
                'Data Usage',
                'Your data is used to facilitate connections between students and tutors, manage appointments, and improve our services.',
              ),
              _buildPolicySection(
                'Data Security',
                'We implement industry-standard security measures to protect your personal information.',
              ),
              _buildPolicySection(
                'Third-Party Services',
                'We may use third-party services (like Cloudinary for image storage) that have their own privacy policies.',
              ),
              _buildPolicySection(
                'Your Rights',
                'You have the right to access, modify, or delete your personal information at any time.',
              ),
              const SizedBox(height: 8),
              Text(
                'Last updated: December 2024',
                style: TextStyle(fontSize: 12, color: Colors.grey[600]),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(localizations.translate('cancel')),
          ),
        ],
      ),
    );
  }

  Widget _buildPolicySection(String title, String content) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            content,
            style: TextStyle(fontSize: 13, color: Colors.grey[700], height: 1.4),
          ),
        ],
      ),
    );
  }

  Future<void> _logout(
      BuildContext context, AppLocalizations localizations) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(localizations.translate('logout')),
        content: Text(localizations.translate('areYouSureLogout')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(localizations.translate('no')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: Text(localizations.translate('yes')),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      await authProvider.logout();

      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
          (route) => false,
        );
      }
    }
  }
}