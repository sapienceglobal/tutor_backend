import nodemailer from 'nodemailer';

// ─── Transporter ──────────────────────────────────────────────────────────────
export const sendEmail = async (options) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD,
            },
        });

        const mailOptions = {
            from: `"Sapience LMS" <${process.env.EMAIL_USER}>`,
            to: options.email,
            subject: options.subject,
            html: options.html,
        };

        await transporter.sendMail(mailOptions);
        console.log('✅ Email sent to:', options.email);
        return true;
    } catch (error) {
        console.error('❌ Email error:', error);
        return false;
    }
};

// ─── Shared base layout ───────────────────────────────────────────────────────
const baseTemplate = ({ previewText = '', body }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Sapience LMS</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #f4f5fa; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; }
    img { border: 0; display: block; }
  </style>
</head>
<body style="background:#f4f5fa; margin:0; padding:0;">

  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f4f5fa;">${previewText}</div>

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f5fa; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

          <!-- ── HEADER ─────────────────────────────────────── -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%); border-radius:16px 16px 0 0; padding: 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Logo -->
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:rgba(255,255,255,0.15); border-radius:10px; padding:8px 10px; width:36px; height:36px; text-align:center; vertical-align:middle;">
                          <span style="font-size:18px; line-height:1;">🎓</span>
                        </td>
                        <td style="padding-left:10px; vertical-align:middle;">
                          <span style="font-size:20px; font-weight:700; color:#ffffff; letter-spacing:-0.3px;">Sapience</span><span style="font-size:20px; font-weight:700; color:rgba(255,255,255,0.6);">LMS</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── BODY ───────────────────────────────────────── -->
          <tr>
            <td style="background:#ffffff; padding: 40px 40px 32px; border-left:1px solid #ece9ff; border-right:1px solid #ece9ff;">
              ${body}
            </td>
          </tr>

          <!-- ── FOOTER ─────────────────────────────────────── -->
          <tr>
            <td style="background:#f8f7ff; border:1px solid #ece9ff; border-top:none; border-radius:0 0 16px 16px; padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid #e8e4ff; padding-top:20px;">
                    <p style="font-size:12px; color:#9ca3af; text-align:center; line-height:1.7; margin:0;">
                      This is an automated message from <strong style="color:#7c3aed;">Sapience LMS</strong>. Please do not reply to this email.<br/>
                      © ${new Date().getFullYear()} Sapience LMS. All rights reserved.<br/>
                      <span style="color:#c4b5fd;">Enterprise AI-Powered Learning Platform</span>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─── Reusable snippet helpers ─────────────────────────────────────────────────
const greeting = (name) =>
    `<p style="font-size:16px; color:#1e1b4b; margin:0 0 8px; font-weight:600;">Hello, ${name} 👋</p>`;

const divider = () =>
    `<div style="border-top:1px solid #f0edff; margin:28px 0;"></div>`;

const primaryButton = (label, href) => `
  <table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr>
      <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed); border-radius:12px; padding:0;">
        <a href="${href}" target="_blank"
           style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:12px; letter-spacing:0.2px;">
          ${label} →
        </a>
      </td>
    </tr>
  </table>`;

const infoRow = (icon, text) =>
    `<tr><td style="padding:6px 0;"><table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="width:28px; height:28px; background:#f5f3ff; border-radius:8px; text-align:center; vertical-align:middle; font-size:13px;">${icon}</td>
      <td style="padding-left:10px; font-size:14px; color:#4b5563; vertical-align:middle;">${text}</td>
    </tr></table></td></tr>`;

const alertBox = (type, content) => {
    const styles = {
        warning:  { bg: '#fffbeb', border: '#f59e0b', icon: '⚠️', label: 'Security Notice' },
        info:     { bg: '#f0f9ff', border: '#0ea5e9', icon: 'ℹ️', label: 'Note' },
        success:  { bg: '#f0fdf4', border: '#22c55e', icon: '✅', label: 'Success' },
        error:    { bg: '#fef2f2', border: '#ef4444', icon: '🚫', label: 'Alert' },
    };
    const s = styles[type] || styles.info;
    return `
      <div style="background:${s.bg}; border-left:4px solid ${s.border}; border-radius:0 8px 8px 0; padding:14px 16px; margin:20px 0;">
        <p style="font-size:13px; font-weight:700; color:#374151; margin:0 0 4px;">${s.icon} ${s.label}</p>
        <p style="font-size:13px; color:#6b7280; margin:0; line-height:1.6;">${content}</p>
      </div>`;
};

// ─── 1. OTP Email ─────────────────────────────────────────────────────────────
export const getOTPEmailTemplate = (name, otp) => baseTemplate({
    previewText: `Your Sapience LMS verification code is ${otp}`,
    body: `
    ${greeting(name)}
    <p style="font-size:15px; color:#6b7280; margin:0 0 28px; line-height:1.6;">
      We received a request to verify your identity. Use the one-time code below to proceed.
    </p>

    <!-- OTP Box -->
    <div style="background:linear-gradient(135deg,#faf5ff,#ede9fe); border:1.5px solid #d8b4fe; border-radius:16px; padding:28px; text-align:center; margin:0 0 24px;">
      <p style="font-size:12px; font-weight:700; color:#7c3aed; letter-spacing:0.15em; text-transform:uppercase; margin:0 0 12px;">Your Verification Code</p>
      <div style="font-size:44px; font-weight:800; letter-spacing:14px; color:#4f46e5; font-family:'Courier New', monospace; line-height:1.1;">${otp}</div>
      <p style="font-size:12px; color:#9ca3af; margin:12px 0 0;">Valid for <strong style="color:#7c3aed;">10 minutes</strong> · Do not share with anyone</p>
    </div>

    ${alertBox('warning', "If you didn't request this code, please ignore this email. Your account remains secure.")}
    ${divider()}

    <p style="font-size:13px; color:#9ca3af; margin:0; line-height:1.7;">
      Best regards,<br/>
      <strong style="color:#4f46e5;">The Sapience LMS Team</strong>
    </p>
  `,
});

// ─── 2. Welcome Email ─────────────────────────────────────────────────────────
export const getWelcomeEmailTemplate = (name) => baseTemplate({
    previewText: `Welcome to Sapience LMS, ${name}! Your account is ready.`,
    body: `
    ${greeting(name)}
    <p style="font-size:15px; color:#6b7280; margin:0 0 24px; line-height:1.6;">
      Welcome aboard! Your Sapience LMS account is ready. We're thrilled to have you as part of our community of learners and educators.
    </p>

    <!-- Feature highlights -->
    <div style="background:#faf5ff; border:1px solid #ede9fe; border-radius:14px; padding:24px; margin:0 0 24px;">
      <p style="font-size:13px; font-weight:700; color:#7c3aed; letter-spacing:0.1em; text-transform:uppercase; margin:0 0 16px;">What you can do now</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${infoRow('📚', 'Browse and enroll in courses')}
        ${infoRow('🤖', 'Get 24/7 help from your AI Tutor')}
        ${infoRow('📝', 'Take adaptive exams and quizzes')}
        ${infoRow('🎥', 'Attend live classes via Zoom')}
        ${infoRow('📊', 'Track your learning progress & analytics')}
      </table>
    </div>

    ${primaryButton('Go to Dashboard', `${process.env.NEXT_PUBLIC_APP_URL || '#'}/student/dashboard`)}
    ${divider()}

    <p style="font-size:13px; color:#9ca3af; margin:0; line-height:1.7;">
      Happy Learning! 🎉<br/>
      <strong style="color:#4f46e5;">The Sapience LMS Team</strong>
    </p>
  `,
});

// ─── 3. Password Reset Email ──────────────────────────────────────────────────
export const getPasswordResetEmailTemplate = (name, resetLink) => baseTemplate({
    previewText: `Reset your Sapience LMS password`,
    body: `
    ${greeting(name)}
    <p style="font-size:15px; color:#6b7280; margin:0 0 24px; line-height:1.6;">
      We received a request to reset the password for your Sapience LMS account. Click the button below to create a new password.
    </p>

    ${primaryButton('Reset My Password', resetLink)}

    <p style="font-size:13px; color:#9ca3af; margin:0 0 16px;">
      Or copy and paste this link into your browser:<br/>
      <a href="${resetLink}" style="color:#7c3aed; word-break:break-all; font-size:12px;">${resetLink}</a>
    </p>

    ${alertBox('warning', "This link expires in 1 hour. If you didn't request a password reset, please ignore this email — your password will not change.")}
    ${divider()}

    <p style="font-size:13px; color:#9ca3af; margin:0; line-height:1.7;">
      Stay secure,<br/>
      <strong style="color:#4f46e5;">The Sapience LMS Team</strong>
    </p>
  `,
});

// ─── 4. Invite Email (Tutor / Student) ───────────────────────────────────────
export const getInviteEmailTemplate = (name, instituteName, role, inviteLink) => baseTemplate({
    previewText: `You've been invited to join ${instituteName} on Sapience LMS`,
    body: `
    ${greeting(name)}
    <p style="font-size:15px; color:#6b7280; margin:0 0 24px; line-height:1.6;">
      You've been invited to join <strong style="color:#1e1b4b;">${instituteName}</strong> on Sapience LMS as a
      <span style="display:inline-block; background:#f5f3ff; border:1px solid #ddd6fe; color:#7c3aed; font-size:12px; font-weight:700; padding:2px 10px; border-radius:20px; letter-spacing:0.05em; text-transform:capitalize;">${role}</span>
    </p>

    <!-- Invite card -->
    <div style="background:linear-gradient(135deg,#faf5ff,#ede9fe); border:1.5px solid #d8b4fe; border-radius:16px; padding:24px; margin:0 0 24px; text-align:center;">
      <p style="font-size:13px; color:#7c3aed; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; margin:0 0 8px;">You're invited to</p>
      <p style="font-size:22px; font-weight:800; color:#1e1b4b; margin:0 0 4px;">${instituteName}</p>
      <p style="font-size:14px; color:#6b7280; margin:0 0 20px;">Join as a <strong style="color:#4f46e5; text-transform:capitalize;">${role}</strong></p>
    </div>

    ${primaryButton('Accept Invitation', inviteLink)}

    ${alertBox('info', `This invite link expires in 7 days. If you weren't expecting this invitation, you can safely ignore this email.`)}
    ${divider()}

    <p style="font-size:13px; color:#9ca3af; margin:0; line-height:1.7;">
      Looking forward to having you onboard,<br/>
      <strong style="color:#4f46e5;">The Sapience LMS Team</strong>
    </p>
  `,
});

// ─── 5. Institute Suspension Notice ──────────────────────────────────────────
export const getInstituteSuspensionEmailTemplate = (name, instituteName, reason = '') => baseTemplate({
    previewText: `Important notice regarding ${instituteName} on Sapience LMS`,
    body: `
    ${greeting(name)}
    <p style="font-size:15px; color:#6b7280; margin:0 0 24px; line-height:1.6;">
      We're writing to inform you that <strong style="color:#1e1b4b;">${instituteName}</strong> has been <strong style="color:#dc2626;">temporarily suspended</strong> on the Sapience LMS platform.
    </p>

    ${alertBox('error', reason ? `Reason: ${reason}` : 'Your institute has been suspended by the platform administrator. Please contact support for more information.')}

    <div style="background:#fef2f2; border:1px solid #fee2e2; border-radius:14px; padding:20px; margin:0 0 24px;">
      <p style="font-size:13px; font-weight:700; color:#dc2626; margin:0 0 12px;">What this means:</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${infoRow('🔒', 'Admin & tutor accounts are temporarily disabled')}
        ${infoRow('📖', 'Students can still view purchased courses (read-only)')}
        ${infoRow('🚫', 'No new enrollments, courses or activities are allowed')}
        ${infoRow('📞', 'Contact platform support to resolve this')}
      </table>
    </div>

    ${primaryButton('Contact Support', `mailto:${process.env.SUPPORT_EMAIL || 'support@sapienceLMS.com'}`)}
    ${divider()}

    <p style="font-size:13px; color:#9ca3af; margin:0; line-height:1.7;">
      Regards,<br/>
      <strong style="color:#4f46e5;">Sapience LMS Platform Team</strong>
    </p>
  `,
});

// ─── 6. Account Blocked Notice ────────────────────────────────────────────────
export const getAccountBlockedEmailTemplate = (name) => baseTemplate({
    previewText: `Your Sapience LMS account has been blocked`,
    body: `
    ${greeting(name)}
    <p style="font-size:15px; color:#6b7280; margin:0 0 24px; line-height:1.6;">
      Your Sapience LMS account has been <strong style="color:#dc2626;">blocked</strong> by the platform administrator. You will not be able to access the platform until your account is unblocked.
    </p>

    ${alertBox('error', 'All your data is safe and will be fully restored once your account is unblocked. Please contact the platform administrator for more details.')}

    ${primaryButton('Contact Support', `mailto:${process.env.SUPPORT_EMAIL || 'support@sapienceLMS.com'}`)}
    ${divider()}

    <p style="font-size:13px; color:#9ca3af; margin:0; line-height:1.7;">
      Regards,<br/>
      <strong style="color:#4f46e5;">Sapience LMS Platform Team</strong>
    </p>
  `,
});

// ─── 7. Account Unblocked / Institute Reactivated ─────────────────────────────
export const getAccountRestoredEmailTemplate = (name, type = 'account') => baseTemplate({
    previewText: `Great news — your ${type} has been reactivated on Sapience LMS`,
    body: `
    ${greeting(name)}

    <!-- Success banner -->
    <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7); border:1.5px solid #86efac; border-radius:16px; padding:24px; text-align:center; margin:0 0 24px;">
      <div style="font-size:36px; margin:0 0 8px;">🎉</div>
      <p style="font-size:18px; font-weight:800; color:#166534; margin:0 0 4px;">
        ${type === 'institute' ? 'Institute Reactivated!' : 'Account Unblocked!'}
      </p>
      <p style="font-size:14px; color:#15803d; margin:0;">You can now access all features on Sapience LMS</p>
    </div>

    ${primaryButton('Go to Dashboard', `${process.env.NEXT_PUBLIC_APP_URL || '#'}/student/dashboard`)}
    ${divider()}

    <p style="font-size:13px; color:#9ca3af; margin:0; line-height:1.7;">
      Welcome back!<br/>
      <strong style="color:#4f46e5;">The Sapience LMS Team</strong>
    </p>
  `,
});

// ─── 8. New Exam Published Notification ──────────────────────────────────────
export const getExamPublishedEmailTemplate = (studentName, examTitle, courseName, examDate, examLink) => baseTemplate({
    previewText: `New exam available: ${examTitle} — ${courseName}`,
    body: `
    ${greeting(studentName)}
    <p style="font-size:15px; color:#6b7280; margin:0 0 24px; line-height:1.6;">
      A new exam has been scheduled for your course. Check the details below and make sure you're prepared!
    </p>

    <!-- Exam card -->
    <div style="background:#faf5ff; border:1.5px solid #ddd6fe; border-radius:14px; padding:24px; margin:0 0 24px;">
      <p style="font-size:12px; font-weight:700; color:#7c3aed; text-transform:uppercase; letter-spacing:0.1em; margin:0 0 12px;">📝 Exam Details</p>
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        ${infoRow('📖', `<strong>Exam:</strong> ${examTitle}`)}
        ${infoRow('🎓', `<strong>Course:</strong> ${courseName}`)}
        ${examDate ? infoRow('📅', `<strong>Scheduled:</strong> ${examDate}`) : ''}
      </table>
    </div>

    ${primaryButton('Start Exam', examLink)}
    ${alertBox('info', 'Make sure you have a stable internet connection before starting the exam. Once started, the timer cannot be paused.')}
    ${divider()}

    <p style="font-size:13px; color:#9ca3af; margin:0; line-height:1.7;">
      Best of luck! 💪<br/>
      <strong style="color:#4f46e5;">The Sapience LMS Team</strong>
    </p>
  `,
});