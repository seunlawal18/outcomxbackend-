import { Resend } from 'resend';
import config from '../config';

const resend = new Resend(config.resendApiKey);

// ─── Verification email ───────────────────────────────────────────────────────

export async function sendVerificationEmail(
  email: string,
  name: string,
  code: string,
): Promise<boolean> {
  try {
    await resend.emails.send({
      from:    config.fromEmail,
      to:      email,
      subject: `Your ${config.appName} verification code: ${code}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#10b981">Welcome to ${config.appName}</h2>
          <p>Hi ${name}, your verification code is:</p>
          <div style="font-size:36px;font-weight:900;letter-spacing:12px;color:#10b981;
                      padding:24px;background:#0d1f15;border-radius:12px;
                      text-align:center;margin:24px 0">
            ${code}
          </div>
          <p style="color:#666">
            This code expires in 15 minutes. Do not share it with anyone.
          </p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err);
    return false;
  }
}

// ─── Password reset email ─────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string,
): Promise<boolean> {
  try {
    await resend.emails.send({
      from:    config.fromEmail,
      to:      email,
      subject: `Reset your ${config.appName} password`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#10b981">${config.appName} Password Reset</h2>
          <p>Hi ${name}, click the button below to reset your password.</p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#10b981;color:#fff;
                    padding:14px 28px;border-radius:8px;text-decoration:none;
                    font-weight:700;margin:16px 0">
            Reset Password
          </a>
          <p style="color:#666">
            This link expires in 1 hour. If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err);
    return false;
  }
}
