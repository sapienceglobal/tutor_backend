import nodemailer from 'nodemailer';

export const sendEmail = async (options) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      }
    });

    const mailOptions = {
      from: `"Tutor Management" <${process.env.EMAIL_USER}>`,
      to: options.email,
      subject: options.subject,
      html: options.html
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully to:', options.email);
    return true;
  } catch (error) {
    console.error('❌ Email send error:', error);
    return false;
  }
};

// OTP Email Template
export const getOTPEmailTemplate = (name, otp) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp-box { background: white; border: 2px dashed #2196F3; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .otp-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2196F3; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #999; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${name}</strong>,</p>
          <p>You requested to reset your password. Use the OTP below to proceed:</p>
          
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <p style="margin: 10px 0 0 0; color: #666;">This OTP is valid for 10 minutes</p>
          </div>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email and ensure your account is secure.
          </div>
          
          <p>For security reasons:</p>
          <ul>
            <li>Never share this OTP with anyone</li>
            <li>We will never ask for your password via email</li>
            <li>This OTP will expire in 10 minutes</li>
          </ul>
          
          <p>Best regards,<br><strong>Tutor Management Team</strong></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Tutor Management. All rights reserved.</p>
          <p>This is an automated email. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Welcome Email Template
export const getWelcomeEmailTemplate = (name) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to Tutor Management!</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${name}</strong>,</p>
          <p>Welcome aboard! We're excited to have you join our community of learners and educators.</p>
          
          <p>Your account has been successfully created. You can now:</p>
          <ul>
            <li>Browse and connect with qualified tutors</li>
            <li>Book appointments at your convenience</li>
            <li>Manage your learning schedule</li>
            <li>Track your progress</li>
          </ul>
          
          <p>If you have any questions, feel free to reach out to our support team.</p>
          
          <p>Happy Learning!<br><strong>Tutor Management Team</strong></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Tutor Management. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};