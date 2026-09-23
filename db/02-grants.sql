-- ============================================================================
--  Privileges for the application account.
--
--  request_status_events is APPEND-ONLY, and this file is what makes that
--  true rather than merely intended: the app account is granted SELECT and
--  INSERT on it, but never UPDATE or DELETE. An attempt to rewrite history
--  fails with ERROR 1142 no matter what the application code says.
--
--  IMPORTANT — why this grants narrowly instead of revoking:
--  The obvious form,
--      GRANT ALL ON drms.* TO 'drms_app'@'%';
--      REVOKE UPDATE, DELETE ON drms.request_status_events FROM 'drms_app'@'%';
--  does NOT work. MySQL refuses to revoke a table-level privilege that exists
--  only as a database-level grant:
--      ERROR 1147 (42000): There is no such grant defined for user ...
--  The mysql image entrypoint runs with `set -eo pipefail`, so that error
--  aborts first-time initialisation and leaves the volume half-populated.
--  Grant database-wide SELECT+INSERT, then add UPDATE/DELETE table by table.
--
--  Table-level GRANT requires the table to exist, so this file must sort
--  after 01-schema.sql. Docker runs /docker-entrypoint-initdb.d/* in
--  filename order, hence the numeric prefixes.
-- ============================================================================

USE drms;

-- The entrypoint has already issued GRANT ALL ON `drms`.* for MYSQL_USER.
-- Strip it, then re-grant deliberately.
REVOKE ALL PRIVILEGES ON drms.* FROM 'drms_app'@'%';

GRANT SELECT, INSERT ON drms.*                     TO 'drms_app'@'%';

GRANT UPDATE, DELETE ON drms.users                 TO 'drms_app'@'%';
GRANT UPDATE, DELETE ON drms.volunteer_profiles    TO 'drms_app'@'%';
GRANT UPDATE, DELETE ON drms.disasters             TO 'drms_app'@'%';
GRANT UPDATE, DELETE ON drms.request_categories    TO 'drms_app'@'%';
GRANT UPDATE, DELETE ON drms.relief_camps          TO 'drms_app'@'%';
GRANT UPDATE, DELETE ON drms.skills                TO 'drms_app'@'%';
GRANT UPDATE, DELETE ON drms.volunteer_skills      TO 'drms_app'@'%';
GRANT UPDATE, DELETE ON drms.requests              TO 'drms_app'@'%';
GRANT UPDATE, DELETE ON drms.assignments           TO 'drms_app'@'%';
GRANT UPDATE, DELETE ON drms.feedback              TO 'drms_app'@'%';
GRANT UPDATE, DELETE ON drms.notifications         TO 'drms_app'@'%';

-- drms.request_status_events  — deliberately omitted: SELECT + INSERT only.
-- drms.audit_logs             — deliberately omitted: SELECT + INSERT only.

FLUSH PRIVILEGES;
