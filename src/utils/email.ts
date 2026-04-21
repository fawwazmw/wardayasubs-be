import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@wardayasubs.com';

function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`📧 [Email not configured] Email verification for ${to}:\n   ${verifyUrl}`);
    return;
  }

  await transporter.sendMail({
    from: `"wardayasubs" <${FROM}>`,
    to,
    subject: 'Verify your email - wardayasubs',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
        <h2 style="color: #fff; margin-top: 0;">
          <span style="color: #fff;">wardaya</span><span style="color: #a855f7;">subs</span>
        </h2>
        <p>Welcome! Please verify your email address to get started:</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #94a3b8; font-size: 14px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
        <p style="color: #64748b; font-size: 12px;">wardayasubs - Subscription Tracker</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`📧 [Email not configured] Password reset for ${to}:\n   ${resetUrl}`);
    return;
  }

  await transporter.sendMail({
    from: `"wardayasubs" <${FROM}>`,
    to,
    subject: 'Reset your password - wardayasubs',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
        <h2 style="color: #fff; margin-top: 0;">
          <span style="color: #fff;">wardaya</span><span style="color: #a855f7;">subs</span>
        </h2>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #94a3b8; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
        <p style="color: #64748b; font-size: 12px;">wardayasubs - Subscription Tracker</p>
      </div>
    `,
  });
}

export async function sendRenewalReminderEmail(
  to: string,
  userName: string,
  reminders: { name: string; amount: number; currency: string; daysUntil: number }[]
): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`📧 [Email not configured] Renewal reminder for ${to}: ${reminders.map(r => r.name).join(', ')}`);
    return;
  }

  const rows = reminders.map(r => {
    const dayText = r.daysUntil === 1 ? 'tomorrow' : `in ${r.daysUntil} days`;
    return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #1e293b; color: #fff;">${r.name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #1e293b; color: #a855f7; font-weight: 600;">${r.currency} ${r.amount}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #1e293b; color: #94a3b8;">${dayText}</td>
      </tr>
    `;
  }).join('');

  await transporter.sendMail({
    from: `"wardayasubs" <${FROM}>`,
    to,
    subject: `Upcoming renewals - wardayasubs`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
        <h2 style="color: #fff; margin-top: 0;">
          <span style="color: #fff;">wardaya</span><span style="color: #a855f7;">subs</span>
        </h2>
        <p>Hi ${userName}, you have upcoming subscription renewals:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="text-align: left;">
              <th style="padding: 8px 12px; border-bottom: 2px solid #334155; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Subscription</th>
              <th style="padding: 8px 12px; border-bottom: 2px solid #334155; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Amount</th>
              <th style="padding: 8px 12px; border-bottom: 2px solid #334155; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Renews</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard#subscriptions" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0;">
          View Dashboard
        </a>
        <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
        <p style="color: #64748b; font-size: 12px;">wardayasubs - Subscription Tracker</p>
      </div>
    `,
  });
}
