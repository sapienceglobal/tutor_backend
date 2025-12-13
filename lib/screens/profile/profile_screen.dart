import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';
import '../../services/cloudinary_service.dart';
import '../../services/ota_update_service.dart';
import '../auth/login_screen.dart';
import 'edit_profile_screen.dart';
import 'change_password_screen.dart';
import 'notification_settings_screen.dart';
import 'language_settings_screen.dart';
import 'package:package_info_plus/package_info_plus.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  String _appVersion = '';
  final ImagePicker _picker = ImagePicker();
  bool _isUploadingImage = false;
  AnimationController? _animationController;
  Animation<double>? _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _getAppVersion();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController!, curve: Curves.easeOut),
    );
    _animationController!.forward();
  }

  @override
  void dispose() {
    _animationController?.dispose();
    super.dispose();
  }

  Future<void> _getAppVersion() async {
    final packageInfo = await PackageInfo.fromPlatform();
    if (mounted) {
      setState(() {
        // version = 1.0.0, buildNumber = 1
        _appVersion = '${packageInfo.version} (${packageInfo.buildNumber})';
        // या अगर सिर्फ 1.0.0 चाहिए तो: _appVersion = packageInfo.version;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.user;
    final lang = user?.language ?? 'en';
    final localizations = AppLocalizations(lang);
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FE),
      body: user == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async {
                await authProvider.refreshUser();
              },
              color: AppColors.primary,
              child: CustomScrollView(
                physics: const BouncingScrollPhysics(),
                slivers: [
                  // Modern App Bar with Profile Header
                  SliverAppBar(
                    expandedHeight:
                        320, // <--- CHANGED: Increased height to fix overflow
                    floating: false,
                    pinned: true,
                    elevation: 0,
                    backgroundColor: Colors.white,
                    automaticallyImplyLeading: false,
                    flexibleSpace: FlexibleSpaceBar(
                      background: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              AppColors.primary,
                              AppColors.primary.withOpacity(0.8),
                            ],
                          ),
                        ),
                        // Fix for white screen logic
                        child: _fadeAnimation != null
                            ? FadeTransition(
                                opacity: _fadeAnimation!,
                                child: _buildHeaderContent(user, lang),
                              )
                            : _buildHeaderContent(user, lang),
                      ),
                    ),
                    actions: [
                      Container(
                        margin: const EdgeInsets.only(right: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.1),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                        child: IconButton(
                          icon: Icon(
                            Icons.edit_rounded,
                            color: AppColors.primary,
                          ),
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
                      ),
                    ],
                  ),

                  // Content
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          // Personal Information
                          _buildSection(
                            context,
                            icon: Icons.person_rounded,
                            title: localizations.translate(
                              'personalInformation',
                            ),
                            children: [
                              _buildInfoTile(
                                icon: Icons.email_rounded,
                                title: localizations.translate('email'),
                                value: user.email,
                                color: const Color(0xFFEF5350),
                              ),
                              const SizedBox(height: 12),
                              _buildInfoTile(
                                icon: Icons.phone_rounded,
                                title: localizations.translate('phone'),
                                value: user.phone,
                                color: const Color(0xFF66BB6A),
                              ),
                              const SizedBox(height: 12),
                              _buildInfoTile(
                                icon: Icons.badge_rounded,
                                title: localizations.translate('role'),
                                value: _getRoleText(user.role, lang),
                                color: const Color(0xFF42A5F5),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),

                          // Settings
                          _buildSection(
                            context,
                            icon: Icons.settings_rounded,
                            title: localizations.translate('settings'),
                            children: [
                              _buildActionTile(
                                icon: Icons.notifications_active_rounded,
                                title: localizations.translate('notifications'),
                                subtitle: 'Manage notification preferences',
                                color: const Color(0xFFFFA726),
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
                              const Divider(height: 1),
                              _buildActionTile(
                                icon: Icons.lock_rounded,
                                title: localizations.translate(
                                  'changePassword',
                                ),
                                subtitle: 'Update your password',
                                color: const Color(0xFFE53935),
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          const ChangePasswordScreen(),
                                    ),
                                  );
                                },
                              ),
                              const Divider(height: 1),
                              _buildActionTile(
                                icon: Icons.language_rounded,
                                title: localizations.translate('language'),
                                subtitle: lang == 'en' ? 'English' : 'हिंदी',
                                color: const Color(0xFF42A5F5),
                                onTap: () async {
                                  final result = await Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          const LanguageSettingsScreen(),
                                    ),
                                  );
                                  if (result == true) {
                                    authProvider.refreshUser();
                                    setState(() {});
                                  }
                                },
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),

                          // Support & Info
                          _buildSection(
                            context,
                            icon: Icons.help_rounded,
                            title: localizations.translate('support'),
                            children: [
                              _buildActionTile(
                                icon: Icons.system_update_rounded,
                                title: 'Check for Updates',
                                subtitle: 'Check if a new version is available',
                                color: const Color(0xFF9C27B0),
                                onTap: () {
                                  OtaUpdateService().checkForUpdate(
                                    context,
                                    isManual: true,
                                  );
                                },
                              ),
                              const Divider(height: 1),
                              _buildActionTile(
                                icon: Icons.support_agent_rounded,
                                title: localizations.translate(
                                  'helpAndSupport',
                                ),
                                subtitle: 'Get help and support',
                                color: const Color(0xFF26A69A),
                                onTap: () {
                                  _showHelpDialog(context, localizations);
                                },
                              ),
                              const Divider(height: 1),
                              _buildActionTile(
                                icon: Icons.info_rounded,
                                title: localizations.translate('about'),
                                subtitle: 'App information',
                                color: const Color(0xFF5C6BC0),
                                onTap: () {
                                  _showAboutDialog(context, localizations);
                                },
                              ),
                              const Divider(height: 1),
                              _buildActionTile(
                                icon: Icons.privacy_tip_rounded,
                                title: localizations.translate('privacyPolicy'),
                                subtitle: 'Read our privacy policy',
                                color: const Color(0xFF78909C),
                                onTap: () {
                                  _showPrivacyPolicyDialog(
                                    context,
                                    localizations,
                                  );
                                },
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),

                          // Logout Button
                          Container(
                            height: 56,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFE53935), Color(0xFFEF5350)],
                              ),
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(
                                    0xFFE53935,
                                  ).withOpacity(0.4),
                                  blurRadius: 12,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                            ),
                            child: ElevatedButton(
                              onPressed: () => _logout(context, localizations),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.transparent,
                                shadowColor: Colors.transparent,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(
                                    Icons.logout_rounded,
                                    color: Colors.white,
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    localizations.translate('logout'),
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Version
                          Text(
                            '${localizations.translate('version')} ${_appVersion.isEmpty ? "..." : _appVersion}',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  // --- NEW HELPER METHOD FOR HEADER CONTENT ---
  Widget _buildHeaderContent(dynamic user, String lang) {
    return SafeArea(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 40),
          // Profile Picture
          Stack(
            children: [
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 4),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(60),
                  child: CachedNetworkImage(
                    imageUrl: user.profileImage,
                    width: 120,
                    height: 120,
                    fit: BoxFit.cover,
                    placeholder: (context, url) => Container(
                      color: Colors.white,
                      child: const Center(child: CircularProgressIndicator()),
                    ),
                    errorWidget: (context, url, error) => Container(
                      color: Colors.white,
                      child: const Icon(Icons.person, size: 60),
                    ),
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
                      child: CircularProgressIndicator(color: Colors.white),
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
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Colors.white, Colors.white],
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.camera_alt_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Name
          Text(
            user.name,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          // Role Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: Colors.white.withOpacity(0.3),
                width: 1.5,
              ),
            ),
            child: Text(
              _getRoleText(user.role, lang),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
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

  Widget _buildSection(
    BuildContext context, {
    required IconData icon,
    required String title,
    required List<Widget> children,
  }) {
    return Container(
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
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
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
          ),
          ...children,
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _buildInfoTile({
    required IconData icon,
    required String title,
    required String value,
    required Color color,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3)),
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
                    title,
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
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1A1A1A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              color: Colors.grey.shade400,
              size: 24,
            ),
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
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.image_rounded, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Text(
                  localizations.translate('changeProfilePicture'),
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _buildImageOption(
              icon: Icons.camera_alt_rounded,
              title: localizations.translate('takePhoto'),
              color: const Color(0xFF42A5F5),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.camera);
              },
            ),
            const SizedBox(height: 12),
            _buildImageOption(
              icon: Icons.photo_library_rounded,
              title: localizations.translate('chooseFromGallery'),
              color: const Color(0xFF66BB6A),
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

  Widget _buildImageOption({
    required IconData icon,
    required String title,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 14),
            Text(
              title,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
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
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white),
                const SizedBox(width: 12),
                Text('Error picking image: $e'),
              ],
            ),
            backgroundColor: const Color(0xFFE53935),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
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
      final result = await CloudinaryService.uploadImage(imageFile);

      if (result != null && mounted) {
        final success = await authProvider.updateProfileImage(
          profileImage: result['url'],
          cloudinaryId: result['publicId'],
        );

        if (success && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.check_circle, color: Colors.white),
                  const SizedBox(width: 12),
                  Text(localizations.translate('profileUpdated')),
                ],
              ),
              backgroundColor: const Color(0xFF43A047),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
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
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white),
                const SizedBox(width: 12),
                Text('Error: $e'),
              ],
            ),
            backgroundColor: const Color(0xFFE53935),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.support_agent_rounded,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Text(localizations.translate('helpAndSupport')),
          ],
        ),
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
              _buildContactItem(
                Icons.email_rounded,
                'Email',
                'support@tutormanagement.com',
              ),
              const SizedBox(height: 12),
              _buildContactItem(Icons.phone_rounded, 'Phone', '+91 1234567890'),
              const SizedBox(height: 12),
              _buildContactItem(
                Icons.language_rounded,
                'Website',
                'www.tutormanagement.com',
              ),
              const SizedBox(height: 16),
              Text(
                'Available: Monday - Friday, 9 AM - 6 PM IST',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.info_rounded, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Text(localizations.translate('about')),
          ],
        ),
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
              '${localizations.translate('version')} ${_appVersion.isEmpty ? "..." : _appVersion}',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 16),
            const Text(
              'A comprehensive platform to connect students with qualified tutors. Book appointments, manage schedules, and enhance your learning experience.',
              style: TextStyle(fontSize: 14, height: 1.5),
            ),
            const SizedBox(height: 16),
            Text(
              '© 2025 Tutor Management. All rights reserved.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
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
    BuildContext context,
    AppLocalizations localizations,
  ) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.privacy_tip_rounded, color: AppColors.primary),
            ),
            const SizedBox(width: 12),
            Text(localizations.translate('privacyPolicy')),
          ],
        ),
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
                'Last updated: December 2025',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
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
            style: TextStyle(
              fontSize: 13,
              color: Colors.grey.shade700,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _logout(
    BuildContext context,
    AppLocalizations localizations,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFE53935).withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.logout_rounded, color: Color(0xFFE53935)),
            ),
            const SizedBox(width: 12),
            Text(localizations.translate('logout')),
          ],
        ),
        content: Text(localizations.translate('areYouSureLogout')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(localizations.translate('no')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFE53935),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
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

// AppLocalizations class for multi-language support
class AppLocalizations {
  final String languageCode;

  AppLocalizations(this.languageCode);

  static final Map<String, Map<String, String>> _localizedValues = {
    'en': {
      'profile': 'Profile',
      'personalInformation': 'Personal Information',
      'email': 'Email',
      'phone': 'Phone',
      'role': 'Role',
      'settings': 'Settings',
      'notifications': 'Notifications',
      'changePassword': 'Change Password',
      'language': 'Language',
      'support': 'Support & Info',
      'helpAndSupport': 'Help & Support',
      'about': 'About',
      'privacyPolicy': 'Privacy Policy',
      'logout': 'Logout',
      'version': 'Version',
      'student': 'Student',
      'tutor': 'Tutor',
      'admin': 'Admin',
      'changeProfilePicture': 'Change Profile Picture',
      'takePhoto': 'Take Photo',
      'chooseFromGallery': 'Choose from Gallery',
      'profileUpdated': 'Profile updated successfully',
      'areYouSureLogout': 'Are you sure you want to logout?',
      'yes': 'Yes',
      'no': 'No',
      'cancel': 'Close',
    },
    'hi': {
      'profile': 'प्रोफ़ाइल',
      'personalInformation': 'व्यक्तिगत जानकारी',
      'email': 'ईमेल',
      'phone': 'फोन',
      'role': 'भूमिका',
      'settings': 'सेटिंग्स',
      'notifications': 'सूचनाएं',
      'changePassword': 'पासवर्ड बदलें',
      'language': 'भाषा',
      'support': 'सहायता और जानकारी',
      'helpAndSupport': 'मदद और सहायता',
      'about': 'के बारे में',
      'privacyPolicy': 'गोपनीयता नीति',
      'logout': 'लॉगआउट',
      'version': 'संस्करण',
      'student': 'छात्र',
      'tutor': 'शिक्षक',
      'admin': 'व्यवस्थापक',
      'changeProfilePicture': 'प्रोफाइल फोटो बदलें',
      'takePhoto': 'फोटो लें',
      'chooseFromGallery': 'गैलरी से चुनें',
      'profileUpdated': 'प्रोफाइल सफलतापूर्वक अपडेट हुई',
      'areYouSureLogout': 'क्या आप वाकई लॉगआउट करना चाहते हैं?',
      'yes': 'हाँ',
      'no': 'नहीं',
      'cancel': 'बंद करें',
    },
  };

  String translate(String key) {
    return _localizedValues[languageCode]?[key] ?? key;
  }
}
