"""Use canonical email as the account identity."""

import re

import sqlalchemy as sa
from alembic import op

revision = "0008_email_auth"
down_revision = "0007_project_handoff"
branch_labels = None
depends_on = None

LOCAL_PART = re.compile(r"[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*")
DOMAIN_LABEL = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")


def normalize(candidate: str | None) -> str | None:
    email = (candidate or "").strip().lower()
    local, at, domain = email.partition("@")
    labels = domain.split(".")
    if (
        at
        and len(email) <= 254
        and len(local) <= 64
        and LOCAL_PART.fullmatch(local)
        and len(labels) >= 2
        and all(DOMAIN_LABEL.fullmatch(label) for label in labels)
    ):
        return email
    return None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_new", sa.String(length=254), nullable=True))
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, email, login FROM users ORDER BY id")).all()
    reserved = set()
    assigned = {}

    # Preserve valid email addresses before generating aliases from legacy logins.
    for user in rows:
        email = normalize(user.email)
        if email and email not in reserved:
            assigned[user.id] = email
            reserved.add(email)

    for user in rows:
        if user.id in assigned:
            continue
        email = normalize(user.login) or normalize(f"{user.login}@example.com")
        if not email or email in reserved:
            base = f"legacy-{str(user.id).replace('-', '')}"
            email = f"{base}@example.com"
            suffix = 2
            while email in reserved:
                email = f"{base}-{suffix}@example.com"
                suffix += 1
        assigned[user.id] = email
        reserved.add(email)

    if assigned:
        conn.execute(
            sa.text("UPDATE users SET email_new = :email WHERE id = :user_id"),
            [{"email": email, "user_id": user_id} for user_id, email in assigned.items()],
        )
    op.drop_column("users", "email")
    op.alter_column("users", "email_new", new_column_name="email", nullable=False)
    op.create_unique_constraint("uq_users_email", "users", ["email"])
    op.create_check_constraint("ck_users_email_lowercase", "users", "email = lower(email)")
    op.drop_constraint("users_login_key", "users", type_="unique")
    op.drop_column("users", "login")


def downgrade() -> None:
    op.add_column("users", sa.Column("login", sa.String(length=254), nullable=True))
    op.execute("UPDATE users SET login = email")
    op.alter_column("users", "login", nullable=False)
    op.create_unique_constraint("users_login_key", "users", ["login"])
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_constraint("ck_users_email_lowercase", "users", type_="check")
    op.alter_column("users", "email", nullable=True)
