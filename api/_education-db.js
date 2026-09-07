const { pool } = require('./_db');

let schemaPromise;

function ensureEducationSchema() {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS education_auth_limits (
        key_hash CHAR(64) PRIMARY KEY,
        attempts INTEGER NOT NULL,
        reset_at TIMESTAMPTZ NOT NULL
      );

      CREATE INDEX IF NOT EXISTS education_auth_limits_reset_at_idx
        ON education_auth_limits(reset_at);

      CREATE TABLE IF NOT EXISTS teacher_accounts (
        id UUID PRIMARY KEY,
        email VARCHAR(254) NOT NULL UNIQUE,
        school VARCHAR(160) NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS teacher_sessions (
        id UUID PRIMARY KEY,
        teacher_id UUID NOT NULL REFERENCES teacher_accounts(id) ON DELETE CASCADE,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS teacher_sessions_teacher_id_idx
        ON teacher_sessions(teacher_id);
      CREATE INDEX IF NOT EXISTS teacher_sessions_expires_at_idx
        ON teacher_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS education_classes (
        id UUID PRIMARY KEY,
        teacher_id UUID NOT NULL REFERENCES teacher_accounts(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        join_code VARCHAR(10) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS education_classes_teacher_id_idx
        ON education_classes(teacher_id);

      CREATE TABLE IF NOT EXISTS student_profiles (
        id UUID PRIMARY KEY,
        class_id UUID NOT NULL REFERENCES education_classes(id) ON DELETE CASCADE,
        display_name VARCHAR(80) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS student_profiles_class_id_idx
        ON student_profiles(class_id);

      CREATE TABLE IF NOT EXISTS mission_attempts (
        id UUID PRIMARY KEY,
        student_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
        mission_id VARCHAR(80) NOT NULL,
        prediction JSONB,
        result JSONB,
        explanation TEXT,
        score INTEGER NOT NULL,
        max_score INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS mission_attempts_student_id_idx
        ON mission_attempts(student_id);
      CREATE INDEX IF NOT EXISTS mission_attempts_mission_id_idx
        ON mission_attempts(mission_id);
    `).catch((error) => {
      schemaPromise = undefined;
      throw error;
    });
  }
  return schemaPromise;
}

module.exports = { ensureEducationSchema };
