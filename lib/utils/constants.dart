import 'package:flutter/material.dart';

class AppColors {
  static const Color primary = Color(0xFF2196F3);
  static const Color accent = Color(0xFFFF9800);
  static const Color background = Color(0xFFF5F5F5);
  static const Color success = Color(0xFF4CAF50);
  static const Color error = Color(0xFFF44336);
  static const Color warning = Color(0xFFFFC107);
}

class AppStrings {
  static const String appName = 'Tutor Management';
  static const String learnAtYourPace = 'Learn at Your Own Pace';

  // English
  static const Map<String, String> en = {
    'profile': 'Profile',
    'editProfile': 'Edit Profile',
    'personalInformation': 'Personal Information',
    'email': 'Email',
    'phone': 'Phone',
    'role': 'Role',
    'settings': 'Settings',
    'notifications': 'Notifications',
    'changePassword': 'Change Password',
    'language': 'Language',
    'support': 'Support',
    'helpAndSupport': 'Help & Support',
    'about': 'About',
    'privacyPolicy': 'Privacy Policy',
    'logout': 'Logout',
    'student': 'Student',
    'tutor': 'Tutor',
    'admin': 'Admin',
    'version': 'Version',
    'name': 'Name',
    'save': 'Save',
    'cancel': 'Cancel',
    'currentPassword': 'Current Password',
    'newPassword': 'New Password',
    'confirmPassword': 'Confirm Password',
    'emailNotifications': 'Email Notifications',
    'pushNotifications': 'Push Notifications',
    'smsNotifications': 'SMS Notifications',
    'selectLanguage': 'Select Language',
    'english': 'English',
    'hindi': 'हिंदी',
    'areYouSureLogout': 'Are you sure you want to logout?',
    'yes': 'Yes',
    'no': 'No',
    'profileUpdated': 'Profile updated successfully',
    'passwordChanged': 'Password changed successfully',
    'settingsUpdated': 'Settings updated successfully',
    'somethingWentWrong': 'Something went wrong',
    'enterValidName': 'Please enter a valid name',
    'enterValidPhone': 'Please enter a valid phone number',
    'passwordTooShort': 'Password must be at least 6 characters',
    'passwordsDoNotMatch': 'Passwords do not match',
    'enterCurrentPassword': 'Please enter current password',
    'enterNewPassword': 'Please enter new password',
    'changeProfilePicture': 'Change Profile Picture',
    'takePhoto': 'Take Photo',
    'chooseFromGallery': 'Choose from Gallery',
    'uploadingImage': 'Uploading image...',
    'forgotPassword': 'Forgot Password?',
    'sendOTP': 'Send OTP',
    'verifyOTP': 'Verify OTP',
    'enterOTP': 'Enter OTP',
    'otpSent': 'OTP sent to your email',
    'enterEmail': 'Enter your email',
    'resetPassword': 'Reset Password',
    'backToLogin': 'Back to Login',
  };

  // Hindi
  static const Map<String, String> hi = {
    'profile': 'प्रोफाइल',
    'editProfile': 'प्रोफाइल संपादित करें',
    'personalInformation': 'व्यक्तिगत जानकारी',
    'email': 'ईमेल',
    'phone': 'फोन',
    'role': 'भूमिका',
    'settings': 'सेटिंग्स',
    'notifications': 'सूचनाएं',
    'changePassword': 'पासवर्ड बदलें',
    'language': 'भाषा',
    'support': 'सहायता',
    'helpAndSupport': 'मदद और सहायता',
    'about': 'के बारे में',
    'privacyPolicy': 'गोपनीयता नीति',
    'logout': 'लॉगआउट',
    'student': 'छात्र',
    'tutor': 'शिक्षक',
    'admin': 'व्यवस्थापक',
    'version': 'संस्करण',
    'name': 'नाम',
    'save': 'सेव करें',
    'cancel': 'रद्द करें',
    'currentPassword': 'वर्तमान पासवर्ड',
    'newPassword': 'नया पासवर्ड',
    'confirmPassword': 'पासवर्ड की पुष्टि करें',
    'emailNotifications': 'ईमेल सूचनाएं',
    'pushNotifications': 'पुश सूचनाएं',
    'smsNotifications': 'SMS सूचनाएं',
    'selectLanguage': 'भाषा चुनें',
    'english': 'English',
    'hindi': 'हिंदी',
    'areYouSureLogout': 'क्या आप लॉगआउट करना चाहते हैं?',
    'yes': 'हां',
    'no': 'नहीं',
    'profileUpdated': 'प्रोफाइल सफलतापूर्वक अपडेट हुआ',
    'passwordChanged': 'पासवर्ड सफलतापूर्वक बदला गया',
    'settingsUpdated': 'सेटिंग्स सफलतापूर्वक अपडेट हुईं',
    'somethingWentWrong': 'कुछ गलत हो गया',
    'enterValidName': 'कृपया एक मान्य नाम दर्ज करें',
    'enterValidPhone': 'कृपया एक मान्य फोन नंबर दर्ज करें',
    'passwordTooShort': 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए',
    'passwordsDoNotMatch': 'पासवर्ड मेल नहीं खाते',
    'enterCurrentPassword': 'कृपया वर्तमान पासवर्ड दर्ज करें',
    'enterNewPassword': 'कृपया नया पासवर्ड दर्ज करें',
    'changeProfilePicture': 'प्रोफाइल फोटो बदलें',
    'takePhoto': 'फोटो लें',
    'chooseFromGallery': 'गैलरी से चुनें',
    'uploadingImage': 'छवि अपलोड हो रही है...',
    'forgotPassword': 'पासवर्ड भूल गए?',
    'sendOTP': 'OTP भेजें',
    'verifyOTP': 'OTP सत्यापित करें',
    'enterOTP': 'OTP दर्ज करें',
    'otpSent': 'आपके ईमेल पर OTP भेजा गया',
    'enterEmail': 'अपना ईमेल दर्ज करें',
    'resetPassword': 'पासवर्ड रीसेट करें',
    'backToLogin': 'लॉगिन पर वापस जाएं',
  };
}

// Localization Helper
class AppLocalizations {
  final String languageCode;

  AppLocalizations(this.languageCode);

  String translate(String key) {
    if (languageCode == 'hi') {
      return AppStrings.hi[key] ?? AppStrings.en[key] ?? key;
    }
    return AppStrings.en[key] ?? key;
  }
}
