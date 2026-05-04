from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import settings


def create_access_token(subject: str) -> tuple[str, int]:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expires_minutes)
    payload = {
        "sub": subject,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(expire.timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    expires_in = int(timedelta(minutes=settings.jwt_expires_minutes).total_seconds())
    return token, expires_in


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
