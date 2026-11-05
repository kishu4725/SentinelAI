"""
SentinelAI Audio Engine Delegation & Profile Integration Test Suite
Verifies:
- Single source of truth sound service structure in admin-frontend
- Delegation of audioAlerts.js to soundService.js
- Integration of futuristic cyber_hacking_alarm profile
- Preservation of user-frontend independence
"""

import unittest
import os
import re

class TestSentinelAIAudioEngine(unittest.TestCase):

    def setUp(self):
        self.project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        self.sound_service_path = os.path.join(self.project_root, "admin-frontend", "src", "services", "soundService.js")
        self.audio_alerts_path = os.path.join(self.project_root, "admin-frontend", "src", "services", "audioAlerts.js")
        self.app_shell_path = os.path.join(self.project_root, "admin-frontend", "src", "components", "layout", "AppShell.jsx")
        self.user_frontend_dir = os.path.join(self.project_root, "user-frontend")

    def test_sound_service_has_cyber_hacking_alarm(self):
        """Verifies soundService.js contains cyber_hacking_alarm profile definition."""
        self.assertTrue(os.path.exists(self.sound_service_path), f"Missing {self.sound_service_path}")
        with open(self.sound_service_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("cyber_hacking_alarm", content)
        self.assertIn("targetProfile === 'cyber_hacking_alarm'", content)
        self.assertIn("sawtooth", content)
        self.assertIn("square", content)

    def test_audio_alerts_delegates_to_sound_service(self):
        """Verifies audioAlerts.js delegates sound playback to soundService.js."""
        self.assertTrue(os.path.exists(self.audio_alerts_path), f"Missing {self.audio_alerts_path}")
        with open(self.audio_alerts_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("import", content)
        self.assertIn("from './soundService'", content)
        self.assertIn("playAlertSound", content)
        # Ensure hardcoded HTML5 Audio play of red_alert_siren.wav is removed from active execution paths
        self.assertNotIn("new Audio('/sounds/red_alert_siren.wav')", content)

    def test_app_shell_triggers_delegated_audio(self):
        """Verifies AppShell.jsx invokes audio functions that delegate to soundService."""
        self.assertTrue(os.path.exists(self.app_shell_path), f"Missing {self.app_shell_path}")
        with open(self.app_shell_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("playSeveritySound", content)
        self.assertIn("testAlertSound", content)

    def test_user_frontend_remains_unmodified(self):
        """Verifies User Portal has zero references to SOC cyber hacking alarm sound service."""
        for root, _, files in os.walk(self.user_frontend_dir):
            for file in files:
                if file.endswith((".js", ".jsx", ".ts", ".tsx")):
                    full_path = os.path.join(root, file)
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    self.assertNotIn("cyber_hacking_alarm", content)
                    self.assertNotIn("soundService.js", content)

if __name__ == "__main__":
    unittest.main()
