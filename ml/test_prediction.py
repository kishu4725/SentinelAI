from predict import predict_activity


result = predict_activity(
    protocol=0,              # SSH
    failed_attempts=4,
    session_duration=12,
    command_count=3,
    login_success=0,
    has_request=0,
    has_command=1,
    is_login_attempt=1,
    is_http_request=0
)

print("\nBackend-style ML response:")

print(result)