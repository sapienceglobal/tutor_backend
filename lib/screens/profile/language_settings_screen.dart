import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../utils/constants.dart';

class LanguageSettingsScreen extends StatefulWidget {
  const LanguageSettingsScreen({super.key});

  @override
  State<LanguageSettingsScreen> createState() => _LanguageSettingsScreenState();
}

class _LanguageSettingsScreenState extends State<LanguageSettingsScreen> {
  String _selectedLanguage = 'en';
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final user = Provider.of<AuthProvider>(context, listen: false).user;
    if (user != null) {
      _selectedLanguage = user.language;
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final lang = authProvider.user?.language ?? 'en';
    final localizations = AppLocalizations(lang);

    return Scaffold(
      appBar: AppBar(
        title: Text(localizations.translate('language')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Info Card
          Container(
            padding: const EdgeInsets.all(16),
            margin: const EdgeInsets.only(bottom: 24),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Icon(Icons.language, color: AppColors.primary),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    lang == 'en'
                        ? 'Select your preferred language'
                        : 'अपनी पसंदीदा भाषा चुनें',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Language Options Card
          Container(
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
              children: [
                // English
                _buildLanguageTile(
                  code: 'en',
                  title: 'English',
                  subtitle: 'English',
                  flag: '🇬🇧',
                ),
                const Divider(height: 1),

                // Hindi
                _buildLanguageTile(
                  code: 'hi',
                  title: 'हिंदी',
                  subtitle: 'Hindi',
                  flag: '🇮🇳',
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Save Button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _saveLanguage,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _isLoading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      localizations.translate('save'),
                      style: const TextStyle(fontSize: 16),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLanguageTile({
    required String code,
    required String title,
    required String subtitle,
    required String flag,
  }) {
    final isSelected = _selectedLanguage == code;

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withOpacity(0.2)
              : Colors.grey.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          flag,
          style: const TextStyle(fontSize: 24),
        ),
      ),
      title: Text(
        title,
        style: TextStyle(
          fontSize: 16,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          color: isSelected ? AppColors.primary : Colors.black,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: TextStyle(
          fontSize: 12,
          color: Colors.grey[600],
        ),
      ),
      trailing: Radio<String>(
        value: code,
        groupValue: _selectedLanguage,
        onChanged: (value) {
          if (value != null) {
            setState(() {
              _selectedLanguage = value;
            });
          }
        },
        activeColor: AppColors.primary,
      ),
      onTap: () {
        setState(() {
          _selectedLanguage = code;
        });
      },
    );
  }

  Future<void> _saveLanguage() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    // If language hasn't changed, just go back
    if (_selectedLanguage == authProvider.user?.language) {
      Navigator.of(context).pop(false);
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final lang = authProvider.user?.language ?? 'en';
    final localizations = AppLocalizations(lang);

    final success = await authProvider.updateLanguage(_selectedLanguage);

    setState(() {
      _isLoading = false;
    });

    if (mounted) {
      if (success) {
        // Show success message in NEW language
        final newLocalizations = AppLocalizations(_selectedLanguage);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(newLocalizations.translate('settingsUpdated')),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.of(context).pop(true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(authProvider.error ??
                localizations.translate('somethingWentWrong')),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}