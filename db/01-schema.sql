-- ============================================================================
--  DisasterAid (DRMS) — MySQL 8.0 schema
--
--  Conventions
--    · InnoDB, utf8mb4_0900_ai_ci  (Indian-language names and descriptions)
--    · BIGINT UNSIGNED AUTO_INCREMENT primary keys
--    · DATETIME(3) in UTC — not TIMESTAMP (no 2038 limit, no implicit TZ shifts)
--    · Foreign key names are schema-global in MySQL, so every one is prefixed
--    · ENUM member order is semantic: MySQL sorts by declaration ordinal, so
--      `ORDER BY urgency DESC` yields CRITICAL > HIGH > MEDIUM > LOW with no CASE
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---------------------------------------------------------------- users ----
CREATE TABLE users (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name          VARCHAR(120)    NOT NULL,
  email              VARCHAR(190)    NOT NULL,
  password_hash      VARCHAR(255)    NOT NULL,
  phone              VARCHAR(20)     NOT NULL,
  role               ENUM('ADMIN','VOLUNTEER','VICTIM','DONOR') NOT NULL,
  district           VARCHAR(80)     NOT NULL,
  is_active          BOOLEAN         NOT NULL DEFAULT TRUE,
  token_version      INT UNSIGNED    NOT NULL DEFAULT 0,
  terms_accepted_at  DATETIME(3)     NULL,
  last_seen_at       DATETIME(3)     NULL,
  created_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at         DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role_active (role, is_active),
  KEY ix_users_district (district)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- --------------------------------------------------- volunteer_profiles ----
-- Columns that apply only to volunteers live here, so they are not NULL on
-- every victim and admin row.
CREATE TABLE volunteer_profiles (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           BIGINT UNSIGNED NOT NULL,
  approval_status   ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  approved_by       BIGINT UNSIGNED NULL,
  approved_at       DATETIME(3)     NULL,
  service_radius_km INT UNSIGNED    NOT NULL DEFAULT 10,
  hours_logged      DECIMAL(7,2)    NOT NULL DEFAULT 0.00,
  completed_count   INT UNSIGNED    NOT NULL DEFAULT 0,
  rating_avg        DECIMAL(3,2)    NULL,
  rating_count      INT UNSIGNED    NOT NULL DEFAULT 0,
  created_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_vp_user (user_id),
  KEY ix_vp_approval (approval_status),
  CONSTRAINT fk_vp_user     FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_vp_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT ck_vp_radius   CHECK (service_radius_km BETWEEN 1 AND 200),
  CONSTRAINT ck_vp_rating   CHECK (rating_avg IS NULL OR (rating_avg >= 1 AND rating_avg <= 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- ------------------------------------------------------------ disasters ----
-- `status` (UPCOMING / ACTIVE / PAST) is DERIVED from the dates at query time,
-- never stored: a stored copy can contradict the dates, which is exactly the
-- defect the original mock data had.
CREATE TABLE disasters (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title           VARCHAR(120)    NOT NULL,
  type            VARCHAR(50)     NOT NULL,
  severity        ENUM('LOW','MODERATE','HIGH','SEVERE') NOT NULL,
  district        VARCHAR(80)     NOT NULL,
  latitude        DECIMAL(10,7)   NOT NULL,
  longitude       DECIMAL(10,7)   NOT NULL,
  radius_km       INT UNSIGNED    NOT NULL DEFAULT 25,
  helpline_number VARCHAR(20)     NULL,
  description     VARCHAR(500)    NULL,
  start_date      DATETIME(3)     NOT NULL,
  end_date        DATETIME(3)     NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_dis_dates (start_date, end_date),
  KEY ix_dis_district (district),
  CONSTRAINT ck_dis_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT ck_dis_lat   CHECK (latitude  BETWEEN -90  AND 90),
  CONSTRAINT ck_dis_lng   CHECK (longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------- request_categories ---
-- Reference data. This is what moves `icon: any` and `bg-red-500` OFF the
-- data model and into a table.
CREATE TABLE request_categories (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code             VARCHAR(30)     NOT NULL,
  name             VARCHAR(60)     NOT NULL,
  icon_key         VARCHAR(40)     NOT NULL,
  color_key        VARCHAR(30)     NOT NULL,
  default_priority TINYINT UNSIGNED NOT NULL DEFAULT 3,
  sort_order       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rc_code (code),
  CONSTRAINT ck_rc_priority CHECK (default_priority BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- --------------------------------------------------------- relief_camps ----
CREATE TABLE relief_camps (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  disaster_id       BIGINT UNSIGNED NULL,
  name              VARCHAR(120)    NOT NULL,
  address           VARCHAR(255)    NOT NULL,
  district          VARCHAR(80)     NOT NULL,
  latitude          DECIMAL(10,7)   NOT NULL,
  longitude         DECIMAL(10,7)   NOT NULL,
  capacity          INT UNSIGNED    NOT NULL,
  current_occupancy INT UNSIGNED    NOT NULL DEFAULT 0,
  status            ENUM('OPEN','FULL','CLOSED') NOT NULL DEFAULT 'OPEN',
  contact_phone     VARCHAR(20)     NULL,
  created_at        DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_camp_district_status (district, status),
  CONSTRAINT fk_camp_disaster FOREIGN KEY (disaster_id) REFERENCES disasters(id) ON DELETE SET NULL,
  CONSTRAINT ck_camp_occupancy CHECK (current_occupancy <= capacity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- --------------------------------------------------------------- skills ----
CREATE TABLE skills (
  id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30)     NOT NULL,
  name VARCHAR(60)     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_skill_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------- volunteer_skills -----
-- Composite primary key: a skill cannot be recorded twice for one volunteer.
CREATE TABLE volunteer_skills (
  user_id  BIGINT UNSIGNED NOT NULL,
  skill_id BIGINT UNSIGNED NOT NULL,
  added_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, skill_id),
  KEY ix_vs_skill (skill_id),
  CONSTRAINT fk_vs_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_vs_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- ------------------------------------------------------------- requests ----
CREATE TABLE requests (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference      VARCHAR(20)     NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  disaster_id    BIGINT UNSIGNED NULL,
  category_id    BIGINT UNSIGNED NOT NULL,
  urgency        ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  status         ENUM('SUBMITTED','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
  description    TEXT            NOT NULL,
  location_text  VARCHAR(255)    NOT NULL,
  district       VARCHAR(80)     NOT NULL,
  latitude       DECIMAL(10,7)   NOT NULL,
  longitude      DECIMAL(10,7)   NOT NULL,
  people_count   INT UNSIGNED    NOT NULL DEFAULT 1,
  contact_phone  VARCHAR(20)     NOT NULL,
  source         ENUM('WEB','SOS','PHONE','SMS') NOT NULL DEFAULT 'WEB',
  submitted_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  cancelled_at   DATETIME(3)     NULL,
  completed_at   DATETIME(3)     NULL,
  updated_at     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_req_reference (reference),
  KEY ix_req_status_urgency (status, urgency),
  KEY ix_req_user_status (user_id, status),
  KEY ix_req_submitted (submitted_at),
  KEY ix_req_disaster (disaster_id),
  KEY ix_req_category (category_id),
  KEY ix_req_district (district),
  CONSTRAINT fk_req_user     FOREIGN KEY (user_id)     REFERENCES users(id)              ON DELETE RESTRICT,
  CONSTRAINT fk_req_disaster FOREIGN KEY (disaster_id) REFERENCES disasters(id)          ON DELETE SET NULL,
  CONSTRAINT fk_req_category FOREIGN KEY (category_id) REFERENCES request_categories(id) ON DELETE RESTRICT,
  CONSTRAINT ck_req_people CHECK (people_count >= 1 AND people_count <= 999),
  CONSTRAINT ck_req_lat    CHECK (latitude  BETWEEN -90  AND 90),
  CONSTRAINT ck_req_lng    CHECK (longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- ------------------------------------------------- request_status_events ---
-- Append-only. Rows are INSERTed, never UPDATEd or DELETEd; this is enforced
-- by the GRANTs in 02-grants.sql, not merely by convention.
-- One table, three readers: the victim timeline, the admin activity feed and
-- the audit trail.
CREATE TABLE request_status_events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id  BIGINT UNSIGNED NOT NULL,
  from_status ENUM('SUBMITTED','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED') NULL,
  to_status   ENUM('SUBMITTED','ASSIGNED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL,
  actor_id    BIGINT UNSIGNED NOT NULL,
  actor_role  ENUM('ADMIN','VOLUNTEER','VICTIM','DONOR') NOT NULL,
  reason      VARCHAR(255)    NULL,
  occurred_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_rse_request (request_id, occurred_at),
  KEY ix_rse_occurred (occurred_at),
  CONSTRAINT fk_rse_request FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_rse_actor   FOREIGN KEY (actor_id)   REFERENCES users(id)    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- ---------------------------------------------------------- assignments ----
--  *** THE DOUBLE-DISPATCH GUARANTEE ***
--
--  MySQL has no partial (filtered) unique indexes, so the rule
--      "at most one ACTIVE assignment per request"
--  cannot be written as  UNIQUE (request_id) WHERE status IN (...).
--
--  Instead: a STORED generated column holds request_id while the assignment is
--  active and NULL once it is not. A plain UNIQUE index on that column then
--  enforces the rule, because MySQL treats NULLs in a unique index as DISTINCT.
--  So a request may accumulate unlimited COMPLETED/RELEASED rows, but can never
--  have two live ones.
--
--  The constraint lives in the database, so no code path can bypass it —
--  not the admin Assign dialog, not a script, not Adminer.
--
--  NOTE: no FOREIGN KEY on the generated column. MySQL restricts referential
--  actions on generated columns; the plain unique index is all that is needed.
CREATE TABLE assignments (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id             BIGINT UNSIGNED NOT NULL,
  volunteer_id           BIGINT UNSIGNED NOT NULL,
  assigned_by            BIGINT UNSIGNED NULL,
  status                 ENUM('ASSIGNED','IN_PROGRESS','COMPLETED','RELEASED') NOT NULL DEFAULT 'ASSIGNED',
  active_request_id      BIGINT UNSIGNED
                           GENERATED ALWAYS AS (
                             CASE WHEN status IN ('ASSIGNED','IN_PROGRESS')
                                  THEN request_id ELSE NULL END
                           ) STORED,
  progress_pct           TINYINT UNSIGNED NOT NULL DEFAULT 0,
  hours_logged           DECIMAL(5,2)    NULL,
  completion_notes       VARCHAR(500)    NULL,
  claimed_at             DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  started_at             DATETIME(3)     NULL,
  completed_at           DATETIME(3)     NULL,
  released_at            DATETIME(3)     NULL,
  updated_at             DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_one_active_assignment (active_request_id),
  KEY ix_as_volunteer_status (volunteer_id, status),
  KEY ix_as_request (request_id, claimed_at),
  KEY ix_as_completed (completed_at),
  CONSTRAINT fk_as_request   FOREIGN KEY (request_id)   REFERENCES requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_as_volunteer FOREIGN KEY (volunteer_id) REFERENCES users(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_as_assigner  FOREIGN KEY (assigned_by)  REFERENCES users(id)    ON DELETE SET NULL,
  CONSTRAINT ck_as_progress  CHECK (progress_pct <= 100),
  CONSTRAINT ck_as_hours     CHECK (hours_logged IS NULL OR (hours_logged >= 0 AND hours_logged <= 999))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- ------------------------------------------------------------- feedback ----
-- UNIQUE on request_id is what makes "one rating per request" a database rule
-- rather than an if-statement in a service.
CREATE TABLE feedback (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id         BIGINT UNSIGNED NOT NULL,
  user_id            BIGINT UNSIGNED NOT NULL,
  volunteer_id       BIGINT UNSIGNED NULL,
  rating             TINYINT UNSIGNED NOT NULL,
  comments           VARCHAR(1000)   NULL,
  contact_permission BOOLEAN         NOT NULL DEFAULT FALSE,
  submitted_at       DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_fb_request (request_id),
  KEY ix_fb_volunteer (volunteer_id),
  CONSTRAINT fk_fb_request   FOREIGN KEY (request_id)   REFERENCES requests(id) ON DELETE RESTRICT,
  CONSTRAINT fk_fb_user      FOREIGN KEY (user_id)      REFERENCES users(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_fb_volunteer FOREIGN KEY (volunteer_id) REFERENCES users(id)    ON DELETE SET NULL,
  CONSTRAINT ck_fb_rating    CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- -------------------------------------------------------- notifications ----
CREATE TABLE notifications (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_id BIGINT UNSIGNED NOT NULL,
  type         VARCHAR(40)     NOT NULL,
  title        VARCHAR(120)    NOT NULL,
  body         VARCHAR(500)    NOT NULL,
  target_url   VARCHAR(255)    NULL,
  read_at      DATETIME(3)     NULL,
  created_at   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_notif_recipient (recipient_id, read_at, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;

-- ------------------------------------------------------------ audit_logs ---
-- Records security-significant actions, in particular every disclosure of a
-- victim's personal data to a volunteer.
CREATE TABLE audit_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id     BIGINT UNSIGNED NULL,
  action       VARCHAR(60)     NOT NULL,
  entity_type  VARCHAR(40)     NOT NULL,
  entity_id    BIGINT UNSIGNED NULL,
  pii_revealed BOOLEAN         NOT NULL DEFAULT FALSE,
  detail       VARCHAR(500)    NULL,
  ip_address   VARCHAR(45)     NULL,
  occurred_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY ix_audit_occurred (occurred_at),
  KEY ix_audit_actor (actor_id),
  KEY ix_audit_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=DYNAMIC;
