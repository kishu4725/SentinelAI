"""
GeoIP lookup utility for SentinelAI backend.
Uses ip-api.com (free, no API key, 1000 req/min limit for non-commercial use).
Falls back gracefully when: IP is private/reserved, lookup times out, or service unavailable.
Results are cached in-process to avoid repeated lookups for the same IP.
"""
import ipaddress
import logging
from typing import Optional, Dict
from functools import lru_cache

logger = logging.getLogger("SentinelAI.GeoIP")

# Private / reserved IP ranges — never attempt geo-lookup on these
_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def _is_private_ip(ip: str) -> bool:
    """Returns True if the IP is private, loopback, or otherwise non-routable."""
    try:
        addr = ipaddress.ip_address(ip.strip())
        return any(addr in net for net in _PRIVATE_NETWORKS)
    except ValueError:
        return True  # Treat invalid IPs as private (safe default)


@lru_cache(maxsize=512)
def _cached_lookup(ip: str) -> Optional[Dict]:
    """
    Cached geo-IP lookup via ip-api.com JSON endpoint.
    Returns dict with city/country/lat/lng or None on failure.
    Cache is per-process and limited to 512 unique IPs.
    """
    try:
        import urllib.request
        import json
        url = f"http://ip-api.com/json/{ip}?fields=status,country,regionName,city,lat,lon,query"
        with urllib.request.urlopen(url, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            if data.get("status") == "success":
                return {
                    "country": data.get("country", "Unknown"),
                    "region": data.get("regionName", ""),
                    "city": data.get("city", "Unknown"),
                    "lat": float(data.get("lat", 0.0)),
                    "lng": float(data.get("lon", 0.0)),
                }
    except Exception as exc:
        logger.debug("GeoIP lookup failed for %s: %s", ip, exc)
    return None


def get_geo_for_ip(ip: Optional[str]) -> Dict:
    """
    Main public function. Returns geo-location dict for a given IP.

    Returns:
        dict with keys: city, country, region, lat, lng, geo_source
        - geo_source = "geoip"    → real lookup succeeded
        - geo_source = "private"  → IP is non-routable, no lookup attempted
        - geo_source = "unknown"  → lookup failed or timed out
    """
    if not ip or not ip.strip() or ip in ("0.0.0.0", "::1", "127.0.0.1"):
        return {"city": "Unknown", "country": "Unknown", "region": "", "lat": 0.0, "lng": 0.0, "geo_source": "unknown"}

    clean_ip = ip.strip().split(":")[0]  # Strip port if present

    if _is_private_ip(clean_ip):
        return {"city": "Private Network", "country": "Local", "region": "", "lat": 0.0, "lng": 0.0, "geo_source": "private"}

    result = _cached_lookup(clean_ip)
    if result:
        result["geo_source"] = "geoip"
        return result

    return {"city": "Unknown", "country": "Unknown", "region": "", "lat": 0.0, "lng": 0.0, "geo_source": "unknown"}
