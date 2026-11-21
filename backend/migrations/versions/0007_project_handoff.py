"""Bring existing first drafts into projects and grant project permissions."""

from alembic import op

revision = "0007_project_handoff"
down_revision = "0006_projects"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO projects (
            id, user_id, title, industry, stage, audience, problem, solution_benefit, mentor_request
        )
        SELECT project_id, user_id,
               prefill ->> 'title', prefill ->> 'industry', prefill ->> 'stage',
               prefill ->> 'audience', prefill ->> 'problem',
               COALESCE(prefill ->> 'solution_benefit', prefill ->> 'solution'),
               prefill ->> 'mentor_request'
        FROM first_project_drafts
    """)
    op.execute("""
        INSERT INTO permissions (code)
        VALUES ('projects:read'), ('projects:manage'), ('projects:mentor')
        ON CONFLICT (code) DO NOTHING
    """)
    op.execute("""
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT roles.id, permissions.id
        FROM roles CROSS JOIN permissions
        WHERE (roles.code IN ('student', 'teacher') AND permissions.code = 'projects:read')
           OR (roles.code = 'student' AND permissions.code = 'projects:manage')
           OR (roles.code = 'teacher' AND permissions.code = 'projects:mentor')
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM permissions WHERE code IN ('projects:read', 'projects:manage', 'projects:mentor')
    """)
