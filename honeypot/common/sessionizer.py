"""
Per-source session tracking for honeypot sensors.

The ML adapter scores *behaviour* (how many failures, how long, how many commands), not single
packets, so each event we send carries cumulative session counters. A session is one
(source IP, protocol) pair that is replaced after `idle_timeout` seconds of silence.
"""
import threading
import time
from collections import OrderedDict, deque
from typing import Callable, Deque, Dict, Optional, Tuple


class _Session:
    __slots__ = ("ip", "protocol", "first_seen", "last_seen", "failed_count", "login_attempts",
                 "success_count", "command_count", "request_count", "last_username",
                 "request_times", "last_rapid_flag")

    def __init__(self, ip: str, protocol: str, now: float):
        self.ip = ip
        self.protocol = protocol
        self.first_seen = now
        self.last_seen = now
        self.failed_count = 0
        self.login_attempts = 0
        self.success_count = 0
        self.command_count = 0
        self.request_count = 0
        self.last_username: Optional[str] = None
        self.request_times: Deque[float] = deque()
        self.last_rapid_flag: Optional[float] = None


class Sessionizer:
    def __init__(
        self,
        idle_timeout: float = 300.0,
        rapid_window: float = 10.0,
        rapid_threshold: int = 15,
        rapid_cooldown: float = 60.0,
        max_sessions: int = 10000,
        clock: Callable[[], float] = time.time,
    ):
        self.idle_timeout = idle_timeout
        self.rapid_window = rapid_window
        self.rapid_threshold = rapid_threshold
        self.rapid_cooldown = rapid_cooldown
        self.max_sessions = max_sessions
        self._clock = clock
        self._lock = threading.Lock()
        self._sessions: "OrderedDict[Tuple[str, str], _Session]" = OrderedDict()

    # ---- internals (caller holds the lock) ----
    def _get(self, ip: str, protocol: str) -> _Session:
        now = self._clock()
        key = (ip, protocol)
        sess = self._sessions.get(key)
        if sess is None or (now - sess.last_seen) > self.idle_timeout:
            sess = _Session(ip, protocol, now)
            self._sessions[key] = sess
        sess.last_seen = now
        self._sessions.move_to_end(key)
        while len(self._sessions) > self.max_sessions:
            self._sessions.popitem(last=False)
        return sess

    @staticmethod
    def _snapshot(sess: _Session, rapid: bool = False) -> Dict:
        return {
            "session_id": f"{sess.protocol}-{sess.ip}-{int(sess.first_seen)}",
            "ip": sess.ip,
            "protocol": sess.protocol,
            "failed_count": sess.failed_count,
            "login_attempts": sess.login_attempts,
            "command_count": sess.command_count,
            "request_count": sess.request_count,
            "session_duration": round(max(0.0, sess.last_seen - sess.first_seen), 3),
            "last_username": sess.last_username,
            "rapid": rapid,
        }

    # ---- public API ----
    def record_login(self, ip: str, protocol: str, username: Optional[str], success: bool) -> Dict:
        with self._lock:
            sess = self._get(ip, protocol)
            sess.login_attempts += 1
            if username:
                sess.last_username = username
            if success:
                sess.success_count += 1
            else:
                sess.failed_count += 1
            return self._snapshot(sess)

    def record_command(self, ip: str, protocol: str = "SSH") -> Dict:
        with self._lock:
            sess = self._get(ip, protocol)
            sess.command_count += 1
            return self._snapshot(sess)

    def record_request(
        self, ip: str, is_login_attempt: bool = False, username: Optional[str] = None
    ) -> Dict:
        """HTTP request. The honeypot never accepts a login, so every attempt is a failure."""
        with self._lock:
            sess = self._get(ip, "HTTP")
            now = sess.last_seen
            sess.request_count += 1
            if is_login_attempt:
                sess.login_attempts += 1
                sess.failed_count += 1
                if username:
                    sess.last_username = username

            sess.request_times.append(now)
            while sess.request_times and (now - sess.request_times[0]) > self.rapid_window:
                sess.request_times.popleft()

            rapid = False
            if len(sess.request_times) >= self.rapid_threshold and (
                sess.last_rapid_flag is None or (now - sess.last_rapid_flag) >= self.rapid_cooldown
            ):
                rapid = True
                sess.last_rapid_flag = now
            return self._snapshot(sess, rapid=rapid)
