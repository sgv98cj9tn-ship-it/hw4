"""Password hashing and session tokens for Campus Customs.

Passwords are stored as ``pbkdf2_sha256$<salt>$<hex digest>``, matching the
seeded test user: PBKDF2-HMAC-SHA256, 120,000 iterations, with the salt text
(UTF-8) as the salt bytes. Passwords are never stored or logged in plain text.
"""

import base64
import hashlib
import hmac
import os
import secrets
import time

ALGORITHM = "pbkdf2_sha256"
ITERATIONS = 120_000
TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60  # one week

# Signs session tokens. Set SESSION_SECRET in .env so logins survive a restart;
# without it, a random secret is used and everyone is logged out on restart.
_SESSION_SECRET = (os.environ.get("SESSION_SECRET") or secrets.token_hex(32)).encode()


def _pbkdf2(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()


def hash_password(password: str) -> str:
    """Hash a new password with a fresh random salt."""
    salt = secrets.token_hex(16)
    return f"{ALGORITHM}${salt}${_pbkdf2(password, salt)}"


def verify_password(password: str, stored: str) -> bool:
    """Re-hash the typed password with the stored salt and compare in constant time."""
    try:
        algorithm, salt, digest = stored.split("$")
    except ValueError:
        return False
    if algorithm != ALGORITHM:
        return False
    return hmac.compare_digest(_pbkdf2(password, salt), digest)


# A password check against this dummy hash keeps "unknown email" as slow as
# "wrong password", so response time doesn't reveal which emails have accounts.
DUMMY_HASH = hash_password(secrets.token_hex(16))


def _sign(payload: str) -> str:
    return hmac.new(_SESSION_SECRET, payload.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: int) -> str:
    payload = f"{user_id}.{int(time.time()) + TOKEN_TTL_SECONDS}"
    raw = f"{payload}.{_sign(payload)}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def read_token(token: str) -> int | None:
    """Return the user id for a valid, unexpired token, otherwise None."""
    try:
        user_id, expires, signature = base64.urlsafe_b64decode(token.encode()).decode().split(".")
        if not hmac.compare_digest(_sign(f"{user_id}.{expires}"), signature):
            return None
        if int(expires) < time.time():
            return None
        return int(user_id)
    except (ValueError, UnicodeDecodeError):
        return None
