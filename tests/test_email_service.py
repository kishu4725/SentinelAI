"""
SentinelAI Email Service Unit Tests
Verifies SMTP delivery logic, mock dev sink, TLS/SSL connection handling, and error resilience.
"""

import unittest
from unittest.mock import patch, MagicMock

from backend.app.core.config import settings
from backend.app.services.email_service import send_otp_email, SENT_EMAILS, clear_sent_emails


class TestEmailService(unittest.TestCase):

    def setUp(self):
        clear_sent_emails()

    def test_mock_mode_email_dispatch(self):
        """Tests email service in dev/mock mode when SMTP_HOST is empty or 'console'."""
        with patch.object(settings, "SMTP_HOST", ""):
            success = send_otp_email("user@example.com", "888999", purpose="registration")
            self.assertTrue(success)
            self.assertEqual(len(SENT_EMAILS), 1)
            self.assertEqual(SENT_EMAILS[0]["to_email"], "user@example.com")
            self.assertEqual(SENT_EMAILS[0]["otp_code"], "888999")
            self.assertEqual(SENT_EMAILS[0]["mode"], "mock")

    @patch("smtplib.SMTP")
    def test_smtp_tls_successful_delivery(self, mock_smtp):
        """Tests successful email delivery via SMTP with STARTTLS."""
        mock_instance = MagicMock()
        mock_smtp.return_value = mock_instance

        with patch.object(settings, "SMTP_HOST", "smtp.testserver.com"), \
             patch.object(settings, "SMTP_PORT", 587), \
             patch.object(settings, "SMTP_USER", "testuser"), \
             patch.object(settings, "SMTP_PASSWORD", "testpass"), \
             patch.object(settings, "SMTP_TLS", True), \
             patch.object(settings, "SMTP_SSL", False):

            success = send_otp_email("smtpuser@domain.com", "123987", purpose="registration")

            self.assertTrue(success)
            mock_smtp.assert_called_once_with("smtp.testserver.com", 587, timeout=10)
            mock_instance.starttls.assert_called_once()
            mock_instance.login.assert_called_once_with("testuser", "testpass")
            mock_instance.sendmail.assert_called_once()
            mock_instance.quit.assert_called_once()

            self.assertEqual(len(SENT_EMAILS), 1)
            self.assertEqual(SENT_EMAILS[0]["mode"], "smtp")

    @patch("smtplib.SMTP")
    def test_smtp_failure_returns_false(self, mock_smtp):
        """Tests that SMTP connection/authentication failure returns False without throwing."""
        mock_instance = MagicMock()
        mock_instance.login.side_effect = Exception("SMTP Authentication Error")
        mock_smtp.return_value = mock_instance

        with patch.object(settings, "SMTP_HOST", "smtp.testserver.com"), \
             patch.object(settings, "SMTP_USER", "baduser"), \
             patch.object(settings, "SMTP_PASSWORD", "badpass"):

            success = send_otp_email("failed@domain.com", "555666", purpose="registration")

            self.assertFalse(success)
            self.assertEqual(len(SENT_EMAILS), 0)


if __name__ == "__main__":
    unittest.main()
