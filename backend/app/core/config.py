from pydantic import Field, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NoSignal API"
    api_v1_prefix: str = "/api/v1"
    environment: str = Field(default="development", alias="ENVIRONMENT")
    jwt_secret: str = Field(default="CHANGE_ME", alias="JWT_SECRET")
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = Field(default=480, alias="JWT_EXPIRES_MINUTES")
    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/nosignal"
    upload_root: str = "uploads"
    auto_create_schema: bool = Field(
        default=False,
        alias="AUTO_CREATE_SCHEMA",
        description="Solo desarrollo: crea tablas con SQLAlchemy al iniciar.",
    )
    allow_insecure_defaults: bool = Field(
        default=False,
        alias="ALLOW_INSECURE_DEFAULTS",
        description="Permite secretos débiles solo para desarrollo local controlado.",
    )
    auth_users_json: str = Field(
        default="{}",
        alias="NOSIGNAL_AUTH_USERS",
        description='JSON object {"usuario":"clave",...} para login MVP.',
    )
    cors_origins: str = Field(
        default="http://localhost:5173",
        alias="CORS_ORIGINS",
        description="Orígenes permitidos separados por coma.",
    )
    cors_origin_regex: str | None = Field(
        default=None,
        alias="CORS_ORIGIN_REGEX",
        description="Regex de orígenes (opcional). Útil si CORS_ORIGINS no alcanza (subdominios, previews).",
    )
    expose_error_detail: bool = Field(
        default=False,
        alias="EXPOSE_ERROR_DETAIL",
        description="Si true, las respuestas 500 incluyen tipo y mensaje del error (solo diagnóstico; no en prod pública).",
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins_list(self) -> list[str]:
        parts = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        return parts if parts else ["http://localhost:5173"]

    @model_validator(mode="after")
    def validate_security_defaults(self) -> "Settings":
        env = self.environment.strip().lower()
        if self.allow_insecure_defaults or env not in {"production", "staging"}:
            return self
        if self.jwt_secret.strip() in {"", "CHANGE_ME"} or len(self.jwt_secret.strip()) < 32:
            raise ValueError(
                "JWT_SECRET inseguro. Usa al menos 32 caracteres aleatorios o define "
                "ALLOW_INSECURE_DEFAULTS=true solo en desarrollo local."
            )
        if not (self.auth_users_json or "").strip():
            raise ValueError("NOSIGNAL_AUTH_USERS no puede estar vacío en producción.")
        return self


settings = Settings()
