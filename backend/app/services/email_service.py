"""
SentinelAI Dedicated Server-Side OTP Email Delivery Service
Handles SMTP email dispatch for user registration and password recovery.
Supports production SMTP delivery and safe dev/test mock sinks.
"""

import smtplib
import time
import logging
from typing import Dict, List, Any
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from backend.app.core.config import settings

logger = logging.getLogger("SentinelAI.EmailService")

# In-memory mock sink for dev/test verification without exposing OTP via HTTP APIs
SENT_EMAILS: List[Dict[str, Any]] = []


def clear_sent_emails() -> None:
    """Utility function to reset sent email records (used primarily in automated tests)."""
    SENT_EMAILS.clear()


def send_otp_email(to_email: str, otp_code: str, purpose: str = "registration") -> bool:
    """
    Sends a 6-digit OTP verification code to the target email address.

    Args:
        to_email (str): Recipient email address.
        otp_code (str): Server-generated 6-digit OTP string.
        purpose (str): Purpose of OTP ("registration" or "password_recovery").

    Returns:
        bool: True if email dispatch succeeded (or accepted by dev mock), False if SMTP delivery failed.
    """
    if purpose == "password_recovery":
        subject = "SentinelAI Security - Password Reset Verification Code"
        heading = "Password Reset Request"
        instruction = "You requested a password reset for your SentinelAI portal account."
    else:
        subject = "SentinelAI Security - Email Verification Code"
        heading = "Account Registration Verification"
        instruction = "Thank you for registering with SentinelAI Security Portal."

    # Plain text email body
    plain_text = f"""
SentinelAI Security Notification

{heading}
{instruction}

Your 6-Digit Verification OTP Code is: {otp_code}

This code is valid for 10 minutes. 
Security Notice: Never share your OTP code with anyone. SentinelAI administrators will never ask for your verification code.

If you did not request this code, please ignore this message.
"""

    # HTML email body
    html_text = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #1e293b; }}
        .card {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; shadow: 0 4px 12px rgba(0,0,0,0.05); }}
        .header {{ display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }}
        .brand {{ font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; }}
        .brand span {{ color: #3b82f6; }}
        .otp-box {{ background: #f0fdf4; border: 1px dashed #22c55e; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; }}
        .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #16a34a; font-family: monospace; }}
        .warning {{ font-size: 13px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <div class="brand">Sentinel<span>AI</span> Security</div>
        </div>
        <h2>{heading}</h2>
        <p>{instruction}</p>
        <p>Please enter the following 6-digit OTP code to complete your verification:</p>
        <div class="otp-box">
            <div class="otp-code">{otp_code}</div>
        </div>
        <p><strong>Note:</strong> This OTP code will expire in <strong>10 minutes</strong>.</p>
        <div class="warning">
            🔒 <strong>Security Warning:</strong> Never share this code with anyone. SentinelAI Support will never request your verification code.
        </div>
    </div>
</body>
</html>
"""

    # Check if real SMTP host is configured (bypass for synthetic test domains like @example.com)
    smtp_host = settings.SMTP_HOST.strip() if settings.SMTP_HOST else ""
    is_real_smtp = bool(
        smtp_host
        and smtp_host.lower() not in ("console", "mock", "none")
        and not to_email.endswith("@example.com")
    )

    if is_real_smtp:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = to_email

            msg.attach(MIMEText(plain_text, "plain", "utf-8"))
            msg.attach(MIMEText(html_text, "html", "utf-8"))

            if settings.SMTP_SSL:
                server = smtplib.SMTP_SSL(smtp_host, settings.SMTP_PORT, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, settings.SMTP_PORT, timeout=10)
                if settings.SMTP_TLS:
                    server.starttls()

            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
            server.quit()

            logger.info(f"Delivered OTP email to {to_email} via SMTP host {smtp_host}:{settings.SMTP_PORT}")
            SENT_EMAILS.append({
                "to_email": to_email,
                "subject": subject,
                "otp_code": otp_code,
                "purpose": purpose,
                "mode": "smtp",
                "timestamp": time.time()
            })
            return True

        except Exception as err:
            logger.error(f"Failed to deliver OTP email to {to_email} via SMTP ({smtp_host}): {err}")
            return False

    else:
        # Dev / Mock Mode: Log dispatch and store in memory sink
        logger.info(f"[DEV MOCK EMAIL DISPATCH] Purpose: {purpose} | Target: {to_email} | OTP: {otp_code}")
        SENT_EMAILS.append({
            "to_email": to_email,
            "subject": subject,
            "otp_code": otp_code,
            "purpose": purpose,
            "mode": "mock",
            "timestamp": time.time()
        })
        return True
