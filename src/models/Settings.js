import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
    default: 'TutorApp',
  },
  supportEmail: {
    type: String,
    default: 'support@tutorapp.com',
  },
  defaultLanguage: {
    type: String,
    enum: ['English', 'Spanish', 'French', 'Hindi'],
    default: 'English',
  },
  maintenanceMode: {
    type: Boolean,
    default: false,
  },
  allowRegistration: {
    type: Boolean,
    default: true,
  },
  autoApproveCourses: {
    type: Boolean,
    default: false, // Industry standard: Admin must approve tutor content manually
  },
  autoApproveTutors: {
    type: Boolean,
    default: false, // Industry standard: Admin must approve tutors manually
  },
  allowGuestBrowsing: {
    type: Boolean,
    default: true, // Can public users see courses?
  },
  platformCommission: {
    type: Number,
    default: 10, // Platform takes 10% cut
  },
  supportPhone: {
    type: String,
    default: '',
  },
  facebookLink: {
    type: String,
    default: '',
  },
  twitterLink: {
    type: String,
    default: '',
  },
  primaryColor: {
    type: String,
    default: '#4f46e5', // indigo-600
  },
  footerText: {
    type: String,
    default: '© 2024 Sapience LMS. All rights reserved.',
  },
  contactEmail: {
    type: String,
    default: 'hello@sapience.com',
  },
  contactAddress: {
    type: String,
    default: '',
  },

  // --- Tracking & SEO ---
  favicon: {
    type: String,
    default: '',
  },
  googleAnalyticsId: {
    type: String,
    default: '',
  },
  metaPixelId: {
    type: String,
    default: '',
  },

  // --- Extended Social Links ---
  instagramLink: {
    type: String,
    default: '',
  },
  linkedinLink: {
    type: String,
    default: '',
  },
  youtubeLink: {
    type: String,
    default: '',
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Settings', settingsSchema);
