"""
Payload and command classifiers for the honeypot sensors.

They map raw attacker activity onto the event-type vocabulary the backend ML service already
understands (see backend/app/services/ml_service.py), so no backend change is needed:

    LOGIN_FAILED            failed login (risk grows with failed_count; 10+ is Critical)
    UNAUTHORIZED_DOWNLOAD   sensitive-file probe, path traversal, wget/curl in a shell
    FILE_DELETE             destructive shell command
    PRIVILEGE_ESCALATION    sudo / passwd / authorized_keys style commands
    RAPID_RESOURCE_ACCESS   request flood / scanning burst (derived by the sessionizer)
    HTTP_SQLI / HTTP_XSS    injection payloads (the ML adapter also inspects url/query itself)
    HTTP_SCAN / HTTP_PROBE  scanner user agents / bait-route hits
    HONEYPOT_COMMAND        harmless recon commands (whoami, ls, ...)
    HTTP_REQUEST            ordinary request
"""
import re
from typing import List, Tuple
from urllib.parse import unquote_plus

MAX_SCAN_LEN = 2000  # never run regexes over unbounded attacker input

_SQLI = [re.compile(p, re.I) for p in (
    r"['\"]\s*(or|and)\s+['\"\d(]",
    r"\bor\b\s+\d+\s*=\s*\d+",
    r"\bunion\b\s+(all\s+)?select\b",
    r"\bselect\b\s+[\w\*,\s\(\)`'\.]{1,80}\bfrom\b",
    r"\bdrop\s+table\b",
    r"\binsert\s+into\b",
    r"['\"]\s*(--|#|/\*)",
    r"\bsleep\s*\(\s*\d+",
    r"\bbenchmark\s*\(",
    r"information_schema",
    r"\bxp_cmdshell\b",
)]
_XSS = [re.compile(p, re.I) for p in (
    r"<\s*script",
    r"javascript\s*:",
    r"\bon(error|load|click|mouseover)\s*=",
    r"<\s*(img|svg|iframe)\b[^>]{0,100}\bon\w+\s*=",
    r"\balert\s*\(",
)]
_TRAVERSAL = [re.compile(p, re.I) for p in (
    r"\.\./", r"\.\.\\", r"/etc/(passwd|shadow)", r"c:\\windows", r"%00",
)]
_SENSITIVE_FILE = [re.compile(p, re.I) for p in (
    r"(^|/)\.(env|git|svn|htpasswd|aws|ssh)(\b|/|$)",
    r"\.(bak|sql|old|swp|zip|tar|gz)$",
    r"wp-config", r"id_rsa", r"config\.php", r"web\.config",
)]

SCANNER_USER_AGENTS = (
    "sqlmap", "nikto", "nmap", "masscan", "zgrab", "gobuster", "dirbuster", "dirb",
    "wpscan", "hydra", "burp", "nuclei", "acunetix", "nessus", "openvas", "whatweb",
)

BAIT_ROUTES = {
    "/admin", "/login", "/test", "/wp-login.php", "/wp-admin", "/phpmyadmin",
    "/administrator", "/manager/html", "/console", "/config", "/backup",
}
LOGIN_PATHS = {
    "/login", "/admin", "/wp-login.php", "/phpmyadmin", "/phpmyadmin/index.php",
    "/administrator", "/user/login", "/api/login",
}

USERNAME_FIELDS = ("username", "user", "log", "email", "login", "uname")
PASSWORD_FIELDS = ("password", "pass", "pwd", "passwd")


def normalize(value) -> str:
    """Bounded, repeatedly URL-decoded, lower-cased text for matching."""
    text = str(value or "")[:MAX_SCAN_LEN]
    for _ in range(2):
        decoded = unquote_plus(text)
        if decoded == text:
            break
        text = decoded
    return text.lower()


def _first_match(patterns, text: str):
    for pat in patterns:
        m = pat.search(text)
        if m:
            return m.group(0)[:80]
    return None


def classify_http(
    method: str,
    path: str,
    scan_text: str,
    user_agent: str,
    is_login_attempt: bool,
) -> Tuple[str, List[str], List[str]]:
    """
    Returns (event_type, tags, matched_snippets).
    scan_text = query string + body fields (including password values, which are matched
    against but never stored or sent).
    Priority: SQLi > XSS > traversal / sensitive file > login attempt > scanner UA > bait route.
    """
    path_n = normalize(path)
    blob = normalize(scan_text)
    full = f"{path_n} {blob}"
    ua = (user_agent or "").lower()

    snippet = _first_match(_SQLI, full)
    if snippet:
        return "HTTP_SQLI", ["sqli"], [snippet]

    snippet = _first_match(_XSS, full)
    if snippet:
        return "HTTP_XSS", ["xss"], [snippet]

    snippet = _first_match(_TRAVERSAL, full)
    if snippet:
        return "UNAUTHORIZED_DOWNLOAD", ["path_traversal"], [snippet]

    snippet = _first_match(_SENSITIVE_FILE, path_n)
    if snippet:
        return "UNAUTHORIZED_DOWNLOAD", ["sensitive_file"], [snippet]

    if is_login_attempt:
        return "LOGIN_FAILED", ["login_attempt"], []

    if any(s in ua for s in SCANNER_USER_AGENTS):
        return "HTTP_SCAN", ["scanner_user_agent"], []

    if path_n.rstrip("/") in BAIT_ROUTES or path_n in BAIT_ROUTES:
        return "HTTP_PROBE", ["bait_route"], []

    return "HTTP_REQUEST", [], []


_CMD_RULES = [
    ("FILE_DELETE", "destructive",
     re.compile(r"\b(rm\s+-\w*[rf]\w*|mkfs\S*|shred|wipefs|dd\s+if=)|>\s*/dev/sd", re.I)),
    ("UNAUTHORIZED_DOWNLOAD", "download",
     re.compile(r"\b(wget|curl|tftp|ftpget|scp)\b", re.I)),
    ("PRIVILEGE_ESCALATION", "privilege",
     re.compile(r"(\bsudo\b|\bsu(\s+-\w*)?\s*$|chmod\s+(\+x|[0-7]*7[0-7]*)|/etc/(passwd|shadow|sudoers)"
                r"|\buseradd\b|\bpasswd\b|authorized_keys|\bcrontab\b)", re.I)),
]


def classify_command(command: str) -> Tuple[str, str]:
    """Returns (event_type, category) for a shell command typed into the honeypot."""
    cmd = str(command or "")[:MAX_SCAN_LEN]
    for event_type, category, pattern in _CMD_RULES:
        if pattern.search(cmd):
            return event_type, category
    return "HONEYPOT_COMMAND", "recon"
