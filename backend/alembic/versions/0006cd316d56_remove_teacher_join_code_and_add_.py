"""remove_teacher_join_code_and_add_understanding_metrics

Revision ID: 0006cd316d56
Revises: 
Create Date: 2026-10-14 16:37:47.408685

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0006cd316d56'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: drop courses.join_code if present, add understanding metrics to learner_mastery, and create remediation_sessions table."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # 1. Drop join_code from courses if exists
    courses_columns = [c["name"] for c in inspector.get_columns("courses")] if "courses" in inspector.get_table_names() else []
    if "join_code" in courses_columns:
        op.drop_column("courses", "join_code")

    # 2. Add columns to learner_mastery if not present
    if "learner_mastery" in inspector.get_table_names():
        mastery_columns = [c["name"] for c in inspector.get_columns("learner_mastery")]
        if "understanding_score" not in mastery_columns:
            op.add_column("learner_mastery", sa.Column("understanding_score", sa.Float(), nullable=False, server_default="0.0"))
        if "understanding_level" not in mastery_columns:
            op.add_column("learner_mastery", sa.Column("understanding_level", sa.String(50), nullable=False, server_default="Not assessed"))
        if "misconception_counts" not in mastery_columns:
            op.add_column("learner_mastery", sa.Column("misconception_counts", sa.JSON(), nullable=True))
        if "history_scores" not in mastery_columns:
            op.add_column("learner_mastery", sa.Column("history_scores", sa.JSON(), nullable=True))

    # 3. Create remediation_sessions table if not present
    if "remediation_sessions" not in inspector.get_table_names():
        op.create_table(
            "remediation_sessions",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
            sa.Column("topic_id", sa.Integer(), sa.ForeignKey("topics.id"), nullable=False, index=True),
            sa.Column("concept_name", sa.String(255), nullable=False),
            sa.Column("round_number", sa.Integer(), default=1),
            sa.Column("explanation_style", sa.String(50), default="simpler"),
            sa.Column("explanation_text", sa.Text(), nullable=False),
            sa.Column("worked_example", sa.Text(), nullable=True),
            sa.Column("misconception_addressed", sa.String(255), nullable=True),
            sa.Column("check_questions", sa.JSON(), nullable=True),
            sa.Column("check_answers", sa.JSON(), nullable=True),
            sa.Column("score", sa.Float(), default=0.0),
            sa.Column("is_improving", sa.Boolean(), default=False),
            sa.Column("status", sa.String(50), default="in_progress"),
            sa.Column("suggested_readings", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
            sa.Column("completed_at", sa.DateTime(), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if "remediation_sessions" in inspector.get_table_names():
        op.drop_table("remediation_sessions")

    if "learner_mastery" in inspector.get_table_names():
        mastery_columns = [c["name"] for c in inspector.get_columns("learner_mastery")]
        if "history_scores" in mastery_columns:
            op.drop_column("learner_mastery", "history_scores")
        if "misconception_counts" in mastery_columns:
            op.drop_column("learner_mastery", "misconception_counts")
        if "understanding_level" in mastery_columns:
            op.drop_column("learner_mastery", "understanding_level")
        if "understanding_score" in mastery_columns:
            op.drop_column("learner_mastery", "understanding_score")

    if "courses" in inspector.get_table_names():
        courses_columns = [c["name"] for c in inspector.get_columns("courses")]
        if "join_code" not in courses_columns:
            op.add_column("courses", sa.Column("join_code", sa.String(20), nullable=True, unique=True))

