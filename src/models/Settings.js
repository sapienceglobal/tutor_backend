import mongoose from 'mongoose';

// ─── Reusable theme sub-schema ───────────────────────────────────────────────
const themeSchema = new mongoose.Schema({
  primaryColor: { type: String, default: '#4338ca' },
  secondaryColor: { type: String, default: '#f8fafc' },
  accentColor: { type: String, default: '#6366f1' },
  sidebarColor: { type: String, default: '#1e1b4b' },
  fontFamily: { type: String, default: "'DM Sans', sans-serif" },
  fontSize: { type: String, default: '14' },
}, { _id: false });

// ─── Main settings schema ────────────────────────────────────────────────────
const settingsSchema = new mongoose.Schema({

  // ── Basic Info ────────────────────────────────────────────────────────────
  siteName: { type: String, default: 'Sapience LMS' },
  supportEmail: { type: String, default: 'support@sapience.com' },
  defaultLanguage: { type: String, enum: ['English', 'Spanish', 'French', 'Hindi'], default: 'English' },
  footerText: { type: String, default: '© 2026 Sapience LMS. All rights reserved.' },
  contactEmail: { type: String, default: 'hello@sapience.com' },
  contactAddress: { type: String, default: '' },
  supportPhone: { type: String, default: '' },

  // ── Social Links ──────────────────────────────────────────────────────────
  facebookLink: { type: String, default: '' },
  twitterLink: { type: String, default: '' },
  instagramLink: { type: String, default: '' },
  linkedinLink: { type: String, default: '' },
  youtubeLink: { type: String, default: '' },

  // ── SEO & Tracking ────────────────────────────────────────────────────────
  favicon: { type: String, default: '' },
  googleAnalyticsId: { type: String, default: '' },
  metaPixelId: { type: String, default: '' },

  // ── Platform Controls ─────────────────────────────────────────────────────
  maintenanceMode: { type: Boolean, default: false },
  allowRegistration: { type: Boolean, default: true },
  autoApproveCourses: { type: Boolean, default: false },
  autoApproveTutors: { type: Boolean, default: false },
  allowGuestBrowsing: { type: Boolean, default: true },
  platformCommission: { type: Number, default: 10 },

  // ── Theme Mode ────────────────────────────────────────────────────────────
  enableDarkMode: { type: Boolean, default: true },

  // ── Branding Permissions ──────────────────────────────────────────────────
  // SuperAdmin can lock down or allow institute-level customization
  allowInstituteBranding: { type: Boolean, default: true },
  enforceGlobalTheme: { type: Boolean, default: false },

  // ── Global Theme (shown as read-only to institute admins) ─────────────────
  // Used as fallback for users NOT attached to any institute
  // Also the reference theme institute admins can see but not edit
  globalTheme: {
    type: themeSchema,
    default: () => ({
      primaryColor: '#4338ca',
      secondaryColor: '#f8fafc',
      accentColor: '#6366f1',
      sidebarColor: '#1e1b4b',
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '14',
    }),
  },

  // ── Student Theme (global default for student role) ───────────────────────
  // Applied to: students NOT in any institute, OR if institute has useGlobalTheme=true
  // Institute admin can override with their own studentTheme
  studentTheme: {
    type: themeSchema,
    default: () => ({
      primaryColor: '#4338ca',
      secondaryColor: '#f8fafc',
      accentColor: '#6366f1',
      sidebarColor: '#1e1b4b',
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '14',
    }),
  },

  // ── Tutor Theme (global default for tutor role) ───────────────────────────
  // Applied to: tutors NOT in any institute, OR if institute has useGlobalTheme=true
  // Institute admin can override with their own tutorTheme
  tutorTheme: {
    type: themeSchema,
    default: () => ({
      primaryColor: '#f97316',
      secondaryColor: '#fff7ed',
      accentColor: '#fb923c',
      sidebarColor: '#0f172a',
      fontFamily: "'DM Sans', sans-serif",
      fontSize: '14',
    }),
  },

  // ── Legacy flat color fields (kept for backward compatibility) ────────────
  primaryColor: { type: String, default: '#4338ca' },
  secondaryColor: { type: String, default: '#f8fafc' },
  accentColor: { type: String, default: '#6366f1' },
  fontFamily: { type: String, default: "'DM Sans', sans-serif" },
  fontSize: { type: Number, default: 14 },

  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('Settings', settingsSchema);