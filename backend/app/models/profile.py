"""Public user profile, 1:1 with Supabase `auth.users`.

Replaces the former `users` table. **We never store credentials** — Supabase
Auth owns passwords, sessions, and MFA secrets, so there is no password column
here to leak.

There is also no `role` column. An admin is an `auth.users` row whose
`app_metadata.role = 'admin'`, which is writable only with the service_role
key. Putting a role here would create a second, weaker path to privilege.
"""

from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Profile(TimestampMixin, Base):
    __tablename__ = "profiles"

    # No default: the id always comes from auth.users, created by the
    # on_auth_user_created trigger.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    reviews: Mapped[list["Review"]] = relationship(back_populates="user")  # noqa: F821
