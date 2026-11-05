import json
import csv
import os
from collections import defaultdict
from datetime import datetime

LOG_FOLDER = "logs"
OUTPUT_FILE = os.path.join(LOG_FOLDER, "security_logs.csv")


def read_json_file(filename):
    path = os.path.join(LOG_FOLDER, filename)

    if not os.path.exists(path):
        return []

    try:
        with open(path, "r") as file:
            return json.load(file)
    except:
        return []


def calculate_features(logs):

    ip_data = defaultdict(lambda: {
        "failed_attempts": 0,
        "command_count": 0,
        "timestamps": []
    })

    for log in logs:

        ip = log.get("ip", "")

        if not ip:
            continue

        # Count failed login attempts
        if log.get("event") == "login_attempt":
            if log.get("login_success") is False:
                ip_data[ip]["failed_attempts"] += 1

        # Count commands
        if log.get("event") == "command_activity":
            ip_data[ip]["command_count"] += 1

        # Store timestamp
        timestamp = log.get("timestamp")

        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp)
                ip_data[ip]["timestamps"].append(dt)
            except:
                pass

    # Calculate session duration for each IP
    for ip in ip_data:

        timestamps = ip_data[ip]["timestamps"]

        if len(timestamps) >= 2:
            duration = (
                max(timestamps) - min(timestamps)
            ).total_seconds()
        else:
            duration = 0

        ip_data[ip]["session_duration"] = duration

    return ip_data


def convert_logs():

    all_logs = []

    # Read HTTP logs
    all_logs.extend(
        read_json_file("http_logs.json")
    )

    # Read SSH logs
    all_logs.extend(
        read_json_file("ssh_logs.json")
    )

    # Read simulator logs
    all_logs.extend(
        read_json_file("simulator_logs.json")
    )

    # Calculate features
    ip_features = calculate_features(all_logs)

    fields = [
        "timestamp",
        "ip",
        "protocol",
        "method",
        "request",
        "username",
        "login_success",
        "command",
        "event",
        "failed_attempts",
        "session_duration",
        "command_count"
    ]

    with open(
        OUTPUT_FILE,
        "w",
        newline=""
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=fields
        )

        writer.writeheader()

        for log in all_logs:

            ip = log.get("ip", "")

            features = ip_features.get(
                ip,
                {
                    "failed_attempts": 0,
                    "session_duration": 0,
                    "command_count": 0
                }
            )

            row = {
                "timestamp":
                    log.get("timestamp", ""),

                "ip":
                    ip,

                "protocol":
                    log.get("protocol", ""),

                "method":
                    log.get("method", ""),

                "request":
                    log.get("request", ""),

                "username":
                    log.get("username", ""),

                "login_success":
                    log.get("login_success", ""),

                "command":
                    log.get("command", ""),

                "event":
                    log.get("event", ""),

                "failed_attempts":
                    features["failed_attempts"],

                "session_duration":
                    features["session_duration"],

                "command_count":
                    features["command_count"]
            }

            writer.writerow(row)

    print("===================================")
    print("     SECURITY LOG PROCESSING")
    print("===================================")
    print(f"Total records: {len(all_logs)}")
    print(f"CSV created: {OUTPUT_FILE}")
    print("New features:")
    print("- failed_attempts")
    print("- session_duration")
    print("- command_count")


if __name__ == "__main__":
    convert_logs()