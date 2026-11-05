"""
DEMO ONLY: fake geography for documentation-range IPs.

RFC 5737 test ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) have no real location, so the
attack map would show nothing for simulated attackers. When HONEYPOT_DEMO_GEO=true the sensor
assigns each such IP a deterministic city. Every event it touches is marked details.geo_simulated.
"""
import ipaddress
from typing import Dict, Optional

_RANGES = [ipaddress.ip_network(n) for n in ("192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24")]

_CITIES = [
    {"city": "Moscow", "country": "Russia", "region": "Moscow", "lat": 55.7558, "lng": 37.6173},
    {"city": "Beijing", "country": "China", "region": "Beijing", "lat": 39.9042, "lng": 116.4074},
    {"city": "Sao Paulo", "country": "Brazil", "region": "Sao Paulo", "lat": -23.5505, "lng": -46.6333},
    {"city": "Lagos", "country": "Nigeria", "region": "Lagos", "lat": 6.5244, "lng": 3.3792},
    {"city": "Frankfurt", "country": "Germany", "region": "Hesse", "lat": 50.1109, "lng": 8.6821},
    {"city": "Singapore", "country": "Singapore", "region": "Singapore", "lat": 1.3521, "lng": 103.8198},
    {"city": "Sydney", "country": "Australia", "region": "New South Wales", "lat": -33.8688, "lng": 151.2093},
    {"city": "Ashburn", "country": "United States", "region": "Virginia", "lat": 39.0438, "lng": -77.4874},
]


def demo_geo_for_ip(ip: str) -> Optional[Dict]:
    try:
        addr = ipaddress.ip_address(str(ip).strip())
    except ValueError:
        return None
    for index, net in enumerate(_RANGES):
        if addr in net:
            last_octet = int(str(addr).split(".")[-1])
            return dict(_CITIES[(index * 3 + last_octet) % len(_CITIES)])
    return None
