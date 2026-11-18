"""Seed the student and teacher roles."""

import sqlalchemy as sa
from alembic import op

revision = "0002_roles"
down_revision = "0001_auth"
branch_labels = None
depends_on = None


def upgrade():
    roles = sa.table("roles", sa.column("code", sa.String()))
    permissions = sa.table("permissions", sa.column("code", sa.String()))
    op.bulk_insert(roles, [{"code": "student"}, {"code": "teacher"}])
    op.bulk_insert(permissions, [{"code": "diagnostic:use"}, {"code": "learning:use"}])
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT roles.id, permissions.id
        FROM roles CROSS JOIN permissions
        WHERE roles.code = 'student' AND permissions.code IN ('diagnostic:use', 'learning:use')
    """)


def downgrade():
    op.execute("DELETE FROM permissions WHERE code IN ('diagnostic:use', 'learning:use')")
    op.execute("DELETE FROM roles WHERE code IN ('student', 'teacher')")
