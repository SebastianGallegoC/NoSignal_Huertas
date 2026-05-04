import json
import logging
from time import time

from fastapi import APIRouter, HTTPException, status
from passlib.context import CryptContext

from app.core.config import settings
from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter()
logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
FAILED_ATTEMPTS: dict[str, list[float]] = {}
MAX_FAILED_ATTEMPTS = 5
WINDOW_SECONDS = 300


def _prune_attempts(username: str) -> None:
    now = time()
    FAILED_ATTEMPTS[username] = [t for t in FAILED_ATTEMPTS.get(username, []) if now - t <= WINDOW_SECONDS]
    if not FAILED_ATTEMPTS[username]:
        FAILED_ATTEMPTS.pop(username, None)


def _is_rate_limited(username: str) -> bool:
    _prune_attempts(username)
    return len(FAILED_ATTEMPTS.get(username, [])) >= MAX_FAILED_ATTEMPTS


def _register_failure(username: str) -> None:
    attempts = FAILED_ATTEMPTS.setdefault(username, [])
    attempts.append(time())
    _prune_attempts(username)


def _clear_failures(username: str) -> None:
    FAILED_ATTEMPTS.pop(username, None)


def _verify_password(stored: str, provided: str) -> bool:
    value = (stored or "").strip()
    if value.startswith(("bcrypt:", "$2a$", "$2b$", "$2y$")):
        digest = value.removeprefix("bcrypt:")
        return pwd_context.verify(provided, digest)
    if value.startswith("plain:"):
        return value.removeprefix("plain:") == provided
    # Compatibilidad temporal para despliegues heredados.
    logger.warning(
        "Auth user con password en texto plano detectado. Migra a bcrypt para endurecer seguridad."
    )
    return value == provided


def _user_password_map() -> dict[str, str]:
    raw = (settings.auth_users_json or "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(k): str(v) for k, v in data.items()}


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    if _is_rate_limited(payload.username):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="too_many_attempts",
        )
    users = _user_password_map()
    expected = users.get(payload.username)
    if expected is None or not _verify_password(expected, payload.password):
        _register_failure(payload.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_credentials",
        )
    _clear_failures(payload.username)
    token, expires_in = create_access_token(payload.username)
    return TokenResponse(access_token=token, expires_in=expires_in)
