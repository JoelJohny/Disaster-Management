-- Drop and rebuild the whole schema, then reseed. Used by `npm run db:reset`.
-- Takes about 3 seconds; far faster and safer than `docker compose down -v`,
-- which destroys the volume and forces a multi-minute re-initialisation.
DROP DATABASE IF EXISTS drms;
CREATE DATABASE drms CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE drms;
SOURCE /docker-entrypoint-initdb.d/01-schema.sql;
SOURCE /docker-entrypoint-initdb.d/02-grants.sql;
SOURCE /docker-entrypoint-initdb.d/03-seed.sql;
SELECT 'reset complete' AS status;
