-- ============================================================================
--  Seed data — Kerala Floods 2026 scenario.
--
--  INVARIANT, and it is checked by scripts/db-verify.mjs:
--    volunteer_profiles.completed_count = COUNT of that volunteer's COMPLETED assignments
--    volunteer_profiles.hours_logged    = SUM   of that volunteer's assignment hours
--    volunteer_profiles.rating_count    = COUNT of feedback rows naming that volunteer
--    volunteer_profiles.rating_avg      = AVG   of those ratings
--  An examiner who adds up the numbers on screen and finds they disagree has
--  found a worse bug than any missing feature.
--
--  All passwords below are the bcrypt hash of:  Password@123
-- ============================================================================

USE drms;

SET @PW = '$2a$12$QncIa137gsHN1Vr0kEvWRuojCinLcQ03/wtYL0O127jVU1zJ6OSoK';
SET @NOW = UTC_TIMESTAMP(3);

-- ------------------------------------------------------------- users ------
INSERT INTO users (id, full_name, email, password_hash, phone, role, district, is_active, terms_accepted_at, created_at) VALUES
 (1,'Divya Nair',      'admin@drms.local',    @PW,'+91 98470 90001','ADMIN',    'Ernakulam',  TRUE, @NOW, @NOW - INTERVAL 60 DAY),
 (2,'Arun Kumar',      'arun@drms.local',     @PW,'+91 98470 55221','VOLUNTEER','Ernakulam',  TRUE, @NOW, @NOW - INTERVAL 45 DAY),
 (3,'Priya Menon',     'priya@drms.local',    @PW,'+91 98470 11234','VICTIM',   'Ernakulam',  TRUE, @NOW, @NOW - INTERVAL 30 DAY),
 (4,'Meera Thomas',    'meera@drms.local',    @PW,'+91 98470 55882','VOLUNTEER','Ernakulam',  TRUE, @NOW, @NOW - INTERVAL 5  DAY),
 (5,'Sneha Raj',       'sneha@drms.local',    @PW,'+91 98470 55334','VOLUNTEER','Ernakulam',  TRUE, @NOW, @NOW - INTERVAL 40 DAY),
 (6,'Rahul Varghese',  'rahul@drms.local',    @PW,'+91 98470 55447','VOLUNTEER','Thrissur',   TRUE, @NOW, @NOW - INTERVAL 38 DAY),
 (7,'Rajesh Pillai',   'rajesh@drms.local',   @PW,'+91 98470 22456','VICTIM',   'Ernakulam',  TRUE, @NOW, @NOW - INTERVAL 20 DAY),
 (8,'Fathima Basheer', 'fathima@drms.local',  @PW,'+91 98470 33567','VICTIM',   'Ernakulam',  TRUE, @NOW, @NOW - INTERVAL 18 DAY),
 (9,'Suresh Varma',    'suresh@drms.local',   @PW,'+91 98470 44678','VICTIM',   'Ernakulam',  TRUE, @NOW, @NOW - INTERVAL 15 DAY),
(10,'Anita Joseph',    'anita@drms.local',    @PW,'+91 98470 66789','VICTIM',   'Thrissur',   TRUE, @NOW, @NOW - INTERVAL 12 DAY);

-- -------------------------------------------------- volunteer_profiles ----
-- Aggregates are filled in at the END of this file, computed from real rows.
INSERT INTO volunteer_profiles (user_id, approval_status, approved_by, approved_at, service_radius_km) VALUES
 (2,'APPROVED', 1, @NOW - INTERVAL 44 DAY, 15),
 (4,'PENDING',  NULL, NULL,                10),   -- the volunteer the admin approves in the demo
 (5,'APPROVED', 1, @NOW - INTERVAL 39 DAY, 20),
 (6,'APPROVED', 1, @NOW - INTERVAL 37 DAY, 25);

-- ------------------------------------------------------------ skills -----
INSERT INTO skills (id, code, name) VALUES
 (1,'FIRST_AID','First Aid'),
 (2,'MEDICAL','Medical Professional'),
 (3,'BOAT_OPERATOR','Boat Operator'),
 (4,'DRIVER','Heavy Vehicle Driver'),
 (5,'TRANSLATOR','Translator'),
 (6,'COOKING','Cooking'),
 (7,'CHILDCARE','Childcare');

INSERT INTO volunteer_skills (user_id, skill_id) VALUES
 (2,1),(2,3),
 (4,1),(4,5),
 (5,2),(5,1),
 (6,4),(6,3);

-- ------------------------------------------------- request_categories ----
INSERT INTO request_categories (id, code, name, icon_key, color_key, default_priority, sort_order) VALUES
 (1,'MEDICAL','Medical Assistance','faBriefcaseMedical','red',    1, 1),
 (2,'RESCUE','Rescue / Evacuation','faLifeRing',        'orange', 1, 2),
 (3,'FOOD_WATER','Food & Water',   'faBowlFood',        'blue',   3, 3),
 (4,'SHELTER','Shelter / Housing', 'faHouse',           'green',  3, 4),
 (5,'OTHER','Other',               'faEllipsis',        'gray',   4, 5);

-- --------------------------------------------------------- disasters -----
-- Status is DERIVED from these dates, never stored.
INSERT INTO disasters (id, title, type, severity, district, latitude, longitude, radius_km, helpline_number, description, start_date, end_date) VALUES
 (1,'Kerala Floods 2026','Flood','SEVERE','Ernakulam',10.1081000,76.3517000,40,'1077',
    'Severe flooding across low-lying areas of Ernakulam district following sustained monsoon rainfall.',
    @NOW - INTERVAL 36 DAY, NULL),                                            -- ACTIVE
 (2,'Pre-Monsoon Preparedness','Preparedness','MODERATE','Kozhikode',11.2588000,75.7804000,30,'1077',
    'Planned preparedness exercise ahead of the monsoon season.',
    @NOW + INTERVAL 11 DAY, @NOW + INTERVAL 15 DAY),                          -- UPCOMING
 (3,'Cyclone Remal Response','Cyclone','SEVERE','Kannur',11.8745000,75.3704000,35,'1077',
    'Coastal evacuation and relief operations following Cyclone Remal.',
    @NOW - INTERVAL 120 DAY, @NOW - INTERVAL 105 DAY),                        -- PAST
 (4,'Wayanad Landslide Relief','Landslide','HIGH','Wayanad',11.6854000,76.1320000,20,'1077',
    'Search, rescue and relief following landslides in hill settlements.',
    @NOW - INTERVAL 75 DAY, @NOW - INTERVAL 60 DAY);                          -- PAST

-- ------------------------------------------------------ relief_camps -----
INSERT INTO relief_camps (id, disaster_id, name, address, district, latitude, longitude, capacity, current_occupancy, status, contact_phone) VALUES
 (1,1,'Govt. HSS Aluva',         'Bank Junction, Aluva',        'Ernakulam',10.1299000,76.3514000,300,180,'OPEN','+91 484 260 1001'),
 (2,1,'St. Xavier''s School',     'Market Road, Kalamassery',    'Ernakulam',10.0540000,76.3254000,250,250,'FULL','+91 484 260 1002'),
 (3,1,'Community Hall Edathala', 'Edathala South',              'Ernakulam',10.0700000,76.3400000,150, 62,'OPEN','+91 484 260 1003'),
 (4,1,'Govt. UP School Angamaly','Church Road, Angamaly',       'Ernakulam',10.1960000,76.3860000,200, 95,'OPEN','+91 484 260 1004'),
 (5,1,'Town Hall Perumbavoor',   'MC Road, Perumbavoor',        'Ernakulam',10.1074000,76.4750000,180,  0,'CLOSED','+91 484 260 1005'),
 (6,3,'Coastal Relief Centre',   'Payyambalam, Kannur',         'Kannur',   11.8745000,75.3704000,220,  0,'CLOSED','+91 497 270 2001');

-- ---------------------------------------------------------- requests -----
--  Distribution:  SUBMITTED 6 · ASSIGNED 2 · IN_PROGRESS 2 · COMPLETED 8 · CANCELLED 2  = 20
INSERT INTO requests (id, reference, user_id, disaster_id, category_id, urgency, status, description, location_text, district, latitude, longitude, people_count, contact_phone, source, submitted_at, completed_at, cancelled_at) VALUES
 -- SUBMITTED (the volunteer pool)
 ( 1,'REQ-2026-000041', 7,1,1,'CRITICAL','SUBMITTED','Elderly man with chest pain, no transport available. Water waist-deep on the approach road.','Kunnathunad, near the temple','Ernakulam',10.0330000,76.4600000,2,'+91 98470 22456','WEB', @NOW - INTERVAL 5 HOUR, NULL, NULL),
 ( 2,'REQ-2026-000042', 8,1,2,'CRITICAL','SUBMITTED','Six people including two children stranded on the first floor. Water still rising.','Chengamanad, near the canal','Ernakulam',10.1800000,76.3700000,6,'+91 98470 33567','SOS', @NOW - INTERVAL 4 HOUR, NULL, NULL),
 ( 3,'REQ-2026-000043', 9,1,3,'MEDIUM','SUBMITTED','No drinking water or dry rations since yesterday. Five adults.','Edathala, near the junction','Ernakulam',10.0700000,76.3400000,5,'+91 98470 44678','WEB', @NOW - INTERVAL 3 HOUR, NULL, NULL),
 ( 4,'REQ-2026-000044', 3,1,4,'HIGH','SUBMITTED','Ground floor flooded, need shelter for tonight for three people.','Desom, Aluva','Ernakulam',10.1120000,76.3550000,3,'+91 98470 11234','WEB', @NOW - INTERVAL 2 HOUR, NULL, NULL),
 ( 5,'REQ-2026-000045',10,1,1,'HIGH','SUBMITTED','Diabetic patient out of insulin for two days.','Mala, Thrissur border','Thrissur',10.2300000,76.2900000,1,'+91 98470 66789','WEB', @NOW - INTERVAL 90 MINUTE, NULL, NULL),
 ( 6,'REQ-2026-000046', 7,1,5,'LOW','SUBMITTED','Need help moving documents and medicines to the first floor.','Kunnathunad','Ernakulam',10.0330000,76.4600000,2,'+91 98470 22456','WEB', @NOW - INTERVAL 45 MINUTE, NULL, NULL),
 -- ASSIGNED
 ( 7,'REQ-2026-000035', 3,1,3,'MEDIUM','ASSIGNED','Family of four needs dry rations and baby food.','Desom, Aluva','Ernakulam',10.1120000,76.3550000,4,'+91 98470 11234','WEB', @NOW - INTERVAL 1 DAY, NULL, NULL),
 ( 8,'REQ-2026-000036', 8,1,4,'HIGH','ASSIGNED','House unsafe after wall collapse, need relocation to a camp.','Chengamanad','Ernakulam',10.1800000,76.3700000,3,'+91 98470 33567','WEB', @NOW - INTERVAL 1 DAY, NULL, NULL),
 -- IN_PROGRESS
 ( 9,'REQ-2026-000030', 9,1,2,'HIGH','IN_PROGRESS','Two elderly people need evacuation before nightfall.','Edathala South','Ernakulam',10.0700000,76.3400000,2,'+91 98470 44678','WEB', @NOW - INTERVAL 2 DAY, NULL, NULL),
 (10,'REQ-2026-000031', 3,1,1,'MEDIUM','IN_PROGRESS','Child with high fever, needs to reach a clinic.','Desom, Aluva','Ernakulam',10.1120000,76.3550000,1,'+91 98470 11234','WEB', @NOW - INTERVAL 2 DAY, NULL, NULL),
 -- COMPLETED
 (11,'REQ-2026-000020', 3,1,3,'HIGH','COMPLETED','Drinking water and rations for four.','Desom, Aluva','Ernakulam',10.1120000,76.3550000,4,'+91 98470 11234','WEB', @NOW - INTERVAL 6 DAY, @NOW - INTERVAL 6 DAY + INTERVAL 3 HOUR, NULL),
 (12,'REQ-2026-000021', 7,1,1,'CRITICAL','COMPLETED','Insulin required urgently.','Kunnathunad','Ernakulam',10.0330000,76.4600000,1,'+91 98470 22456','WEB', @NOW - INTERVAL 6 DAY, @NOW - INTERVAL 6 DAY + INTERVAL 2 HOUR, NULL),
 (13,'REQ-2026-000022', 8,1,2,'CRITICAL','COMPLETED','Evacuation of five from a flooded lane.','Chengamanad','Ernakulam',10.1800000,76.3700000,5,'+91 98470 33567','SOS', @NOW - INTERVAL 5 DAY, @NOW - INTERVAL 5 DAY + INTERVAL 4 HOUR, NULL),
 (14,'REQ-2026-000023', 9,1,4,'MEDIUM','COMPLETED','Shelter for two nights.','Edathala','Ernakulam',10.0700000,76.3400000,2,'+91 98470 44678','WEB', @NOW - INTERVAL 5 DAY, @NOW - INTERVAL 5 DAY + INTERVAL 5 HOUR, NULL),
 (15,'REQ-2026-000024',10,1,3,'LOW','COMPLETED','Rations for an elderly couple.','Mala','Thrissur',10.2300000,76.2900000,2,'+91 98470 66789','WEB', @NOW - INTERVAL 4 DAY, @NOW - INTERVAL 4 DAY + INTERVAL 6 HOUR, NULL),
 (16,'REQ-2026-000025', 3,1,5,'LOW','COMPLETED','Help clearing debris from the doorway.','Desom, Aluva','Ernakulam',10.1120000,76.3550000,2,'+91 98470 11234','WEB', @NOW - INTERVAL 3 DAY, @NOW - INTERVAL 3 DAY + INTERVAL 2 HOUR, NULL),
 (17,'REQ-2026-000026', 7,1,3,'MEDIUM','COMPLETED','Dry rations and candles.','Kunnathunad','Ernakulam',10.0330000,76.4600000,3,'+91 98470 22456','WEB', @NOW - INTERVAL 2 DAY, @NOW - INTERVAL 2 DAY + INTERVAL 3 HOUR, NULL),
 (18,'REQ-2026-000027', 8,1,1,'HIGH','COMPLETED','Blood pressure medication needed.','Chengamanad','Ernakulam',10.1800000,76.3700000,1,'+91 98470 33567','WEB', @NOW - INTERVAL 1 DAY, @NOW - INTERVAL 1 DAY + INTERVAL 2 HOUR, NULL),
 -- CANCELLED
 (19,'REQ-2026-000015', 3,1,1,'HIGH','CANCELLED','Duplicate of an earlier request.','Desom, Aluva','Ernakulam',10.1120000,76.3550000,1,'+91 98470 11234','WEB', @NOW - INTERVAL 8 DAY, NULL, @NOW - INTERVAL 8 DAY + INTERVAL 40 MINUTE),
 (20,'REQ-2026-000016', 9,1,4,'LOW','CANCELLED','Found shelter with relatives.','Edathala','Ernakulam',10.0700000,76.3400000,3,'+91 98470 44678','WEB', @NOW - INTERVAL 7 DAY, NULL, @NOW - INTERVAL 7 DAY + INTERVAL 90 MINUTE);

-- -------------------------------------------------------- assignments ----
--  Volunteer 2 (Arun)  : completed 11,12,13  + active 7  (ASSIGNED),  9 (IN_PROGRESS)
--  Volunteer 5 (Sneha) : completed 14,15,16  + active 8  (ASSIGNED)
--  Volunteer 6 (Rahul) : completed 17,18     + active 10 (IN_PROGRESS)
INSERT INTO assignments (request_id, volunteer_id, assigned_by, status, progress_pct, hours_logged, completion_notes, claimed_at, started_at, completed_at) VALUES
 (11,2,NULL,'COMPLETED',100,2.50,'Delivered 20 litres of water and a ration kit.', @NOW - INTERVAL 6 DAY + INTERVAL 20 MINUTE, @NOW - INTERVAL 6 DAY + INTERVAL 40 MINUTE, @NOW - INTERVAL 6 DAY + INTERVAL 3 HOUR),
 (12,2,NULL,'COMPLETED',100,1.50,'Insulin collected from the district hospital and delivered.', @NOW - INTERVAL 6 DAY + INTERVAL 15 MINUTE, @NOW - INTERVAL 6 DAY + INTERVAL 30 MINUTE, @NOW - INTERVAL 6 DAY + INTERVAL 2 HOUR),
 (13,2,NULL,'COMPLETED',100,3.50,'Five people moved to Govt. HSS Aluva by boat.', @NOW - INTERVAL 5 DAY + INTERVAL 25 MINUTE, @NOW - INTERVAL 5 DAY + INTERVAL 45 MINUTE, @NOW - INTERVAL 5 DAY + INTERVAL 4 HOUR),
 (14,5,NULL,'COMPLETED',100,4.00,'Placed at Community Hall Edathala.', @NOW - INTERVAL 5 DAY + INTERVAL 30 MINUTE, @NOW - INTERVAL 5 DAY + INTERVAL 1 HOUR, @NOW - INTERVAL 5 DAY + INTERVAL 5 HOUR),
 (15,5,NULL,'COMPLETED',100,2.00,'Ration kit delivered.', @NOW - INTERVAL 4 DAY + INTERVAL 1 HOUR, @NOW - INTERVAL 4 DAY + INTERVAL 2 HOUR, @NOW - INTERVAL 4 DAY + INTERVAL 6 HOUR),
 (16,5,NULL,'COMPLETED',100,1.50,'Doorway cleared, access restored.', @NOW - INTERVAL 3 DAY + INTERVAL 20 MINUTE, @NOW - INTERVAL 3 DAY + INTERVAL 30 MINUTE, @NOW - INTERVAL 3 DAY + INTERVAL 2 HOUR),
 (17,6,NULL,'COMPLETED',100,2.00,'Rations and candles delivered.', @NOW - INTERVAL 2 DAY + INTERVAL 30 MINUTE, @NOW - INTERVAL 2 DAY + INTERVAL 1 HOUR, @NOW - INTERVAL 2 DAY + INTERVAL 3 HOUR),
 (18,6,NULL,'COMPLETED',100,1.00,'Medication delivered from the pharmacy at Aluva.', @NOW - INTERVAL 1 DAY + INTERVAL 20 MINUTE, @NOW - INTERVAL 1 DAY + INTERVAL 40 MINUTE, @NOW - INTERVAL 1 DAY + INTERVAL 2 HOUR),
 -- active
 ( 7,2,NULL,'ASSIGNED',     0,NULL,NULL, @NOW - INTERVAL 20 HOUR, NULL, NULL),
 ( 8,5,1,   'ASSIGNED',     0,NULL,NULL, @NOW - INTERVAL 19 HOUR, NULL, NULL),
 ( 9,2,NULL,'IN_PROGRESS', 50,NULL,NULL, @NOW - INTERVAL 40 HOUR, @NOW - INTERVAL 36 HOUR, NULL),
 (10,6,NULL,'IN_PROGRESS', 30,NULL,NULL, @NOW - INTERVAL 40 HOUR, @NOW - INTERVAL 35 HOUR, NULL);

-- ------------------------------------------- request_status_events -------
-- One row per transition. SUBMITTED for every request, then its later moves.
INSERT INTO request_status_events (request_id, from_status, to_status, actor_id, actor_role, occurred_at)
SELECT id, NULL, 'SUBMITTED', user_id, 'VICTIM', submitted_at FROM requests;

INSERT INTO request_status_events (request_id, from_status, to_status, actor_id, actor_role, occurred_at) VALUES
 -- completed chains
 (11,'SUBMITTED','ASSIGNED',2,'VOLUNTEER',@NOW - INTERVAL 6 DAY + INTERVAL 20 MINUTE),
 (11,'ASSIGNED','IN_PROGRESS',2,'VOLUNTEER',@NOW - INTERVAL 6 DAY + INTERVAL 40 MINUTE),
 (11,'IN_PROGRESS','COMPLETED',2,'VOLUNTEER',@NOW - INTERVAL 6 DAY + INTERVAL 3 HOUR),
 (12,'SUBMITTED','ASSIGNED',2,'VOLUNTEER',@NOW - INTERVAL 6 DAY + INTERVAL 15 MINUTE),
 (12,'ASSIGNED','IN_PROGRESS',2,'VOLUNTEER',@NOW - INTERVAL 6 DAY + INTERVAL 30 MINUTE),
 (12,'IN_PROGRESS','COMPLETED',2,'VOLUNTEER',@NOW - INTERVAL 6 DAY + INTERVAL 2 HOUR),
 (13,'SUBMITTED','ASSIGNED',2,'VOLUNTEER',@NOW - INTERVAL 5 DAY + INTERVAL 25 MINUTE),
 (13,'ASSIGNED','IN_PROGRESS',2,'VOLUNTEER',@NOW - INTERVAL 5 DAY + INTERVAL 45 MINUTE),
 (13,'IN_PROGRESS','COMPLETED',2,'VOLUNTEER',@NOW - INTERVAL 5 DAY + INTERVAL 4 HOUR),
 (14,'SUBMITTED','ASSIGNED',5,'VOLUNTEER',@NOW - INTERVAL 5 DAY + INTERVAL 30 MINUTE),
 (14,'ASSIGNED','IN_PROGRESS',5,'VOLUNTEER',@NOW - INTERVAL 5 DAY + INTERVAL 1 HOUR),
 (14,'IN_PROGRESS','COMPLETED',5,'VOLUNTEER',@NOW - INTERVAL 5 DAY + INTERVAL 5 HOUR),
 (15,'SUBMITTED','ASSIGNED',5,'VOLUNTEER',@NOW - INTERVAL 4 DAY + INTERVAL 1 HOUR),
 (15,'ASSIGNED','IN_PROGRESS',5,'VOLUNTEER',@NOW - INTERVAL 4 DAY + INTERVAL 2 HOUR),
 (15,'IN_PROGRESS','COMPLETED',5,'VOLUNTEER',@NOW - INTERVAL 4 DAY + INTERVAL 6 HOUR),
 (16,'SUBMITTED','ASSIGNED',5,'VOLUNTEER',@NOW - INTERVAL 3 DAY + INTERVAL 20 MINUTE),
 (16,'ASSIGNED','IN_PROGRESS',5,'VOLUNTEER',@NOW - INTERVAL 3 DAY + INTERVAL 30 MINUTE),
 (16,'IN_PROGRESS','COMPLETED',5,'VOLUNTEER',@NOW - INTERVAL 3 DAY + INTERVAL 2 HOUR),
 (17,'SUBMITTED','ASSIGNED',6,'VOLUNTEER',@NOW - INTERVAL 2 DAY + INTERVAL 30 MINUTE),
 (17,'ASSIGNED','IN_PROGRESS',6,'VOLUNTEER',@NOW - INTERVAL 2 DAY + INTERVAL 1 HOUR),
 (17,'IN_PROGRESS','COMPLETED',6,'VOLUNTEER',@NOW - INTERVAL 2 DAY + INTERVAL 3 HOUR),
 (18,'SUBMITTED','ASSIGNED',6,'VOLUNTEER',@NOW - INTERVAL 1 DAY + INTERVAL 20 MINUTE),
 (18,'ASSIGNED','IN_PROGRESS',6,'VOLUNTEER',@NOW - INTERVAL 1 DAY + INTERVAL 40 MINUTE),
 (18,'IN_PROGRESS','COMPLETED',6,'VOLUNTEER',@NOW - INTERVAL 1 DAY + INTERVAL 2 HOUR),
 -- active chains
 ( 7,'SUBMITTED','ASSIGNED',2,'VOLUNTEER',@NOW - INTERVAL 20 HOUR),
 ( 8,'SUBMITTED','ASSIGNED',1,'ADMIN',    @NOW - INTERVAL 19 HOUR),
 ( 9,'SUBMITTED','ASSIGNED',2,'VOLUNTEER',@NOW - INTERVAL 40 HOUR),
 ( 9,'ASSIGNED','IN_PROGRESS',2,'VOLUNTEER',@NOW - INTERVAL 36 HOUR),
 (10,'SUBMITTED','ASSIGNED',6,'VOLUNTEER',@NOW - INTERVAL 40 HOUR),
 (10,'ASSIGNED','IN_PROGRESS',6,'VOLUNTEER',@NOW - INTERVAL 35 HOUR),
 -- cancellations
 (19,'SUBMITTED','CANCELLED',3,'VICTIM',@NOW - INTERVAL 8 DAY + INTERVAL 40 MINUTE),
 (20,'SUBMITTED','CANCELLED',9,'VICTIM',@NOW - INTERVAL 7 DAY + INTERVAL 90 MINUTE);

-- ----------------------------------------------------------- feedback ----
-- 6 of the 8 completed requests are rated (2 left unrated so the demo can
-- submit one live and then hit the 409 on a second attempt).
INSERT INTO feedback (request_id, user_id, volunteer_id, rating, comments, submitted_at) VALUES
 (11,3,2,5,'Arrived quickly and was very kind. Thank you.',            @NOW - INTERVAL 6 DAY + INTERVAL 5 HOUR),
 (12,7,2,5,'Saved my father. No words.',                                @NOW - INTERVAL 6 DAY + INTERVAL 4 HOUR),
 (13,8,2,4,'Good help, slightly delayed because of the water levels.',  @NOW - INTERVAL 5 DAY + INTERVAL 6 HOUR),
 (14,9,5,5,'Very helpful and patient with my parents.',                 @NOW - INTERVAL 5 DAY + INTERVAL 7 HOUR),
 (15,10,5,4,'Rations arrived as promised.',                             @NOW - INTERVAL 4 DAY + INTERVAL 8 HOUR),
 (17,7,6,5,'Prompt and polite.',                                        @NOW - INTERVAL 2 DAY + INTERVAL 5 HOUR);

-- ------------------------------------------------------ notifications ----
INSERT INTO notifications (recipient_id, type, title, body, target_url, read_at, created_at) VALUES
 (3,'REQUEST_ASSIGNED','Volunteer assigned','Arun Kumar has accepted REQ-2026-000035.','/victim/my-requests', @NOW - INTERVAL 19 HOUR, @NOW - INTERVAL 20 HOUR),
 (3,'REQUEST_COMPLETED','Request completed','REQ-2026-000025 was completed. You can now leave feedback.','/victim/my-requests', NULL, @NOW - INTERVAL 3 DAY + INTERVAL 2 HOUR),
 (8,'REQUEST_ASSIGNED','Volunteer assigned','Sneha Raj has accepted REQ-2026-000036.','/victim/my-requests', NULL, @NOW - INTERVAL 19 HOUR),
 (9,'REQUEST_COMPLETED','Request completed','REQ-2026-000023 was completed.','/victim/my-requests', @NOW - INTERVAL 4 DAY, @NOW - INTERVAL 5 DAY + INTERVAL 5 HOUR),
 (2,'VOLUNTEER_APPROVED','Application approved','Your volunteer application has been approved. You can now accept requests.','/volunteer/dashboard', @NOW - INTERVAL 43 DAY, @NOW - INTERVAL 44 DAY),
 (7,'REQUEST_COMPLETED','Request completed','REQ-2026-000026 was completed. You can now leave feedback.','/victim/my-requests', NULL, @NOW - INTERVAL 2 DAY + INTERVAL 3 HOUR);

-- ------------------------------------------------------- audit_logs -----
INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, pii_revealed, detail, occurred_at) VALUES
 (1,'volunteer.approve','user',      2,FALSE,'Approved volunteer Arun Kumar',        @NOW - INTERVAL 44 DAY),
 (1,'volunteer.approve','user',      5,FALSE,'Approved volunteer Sneha Raj',         @NOW - INTERVAL 39 DAY),
 (1,'volunteer.approve','user',      6,FALSE,'Approved volunteer Rahul Varghese',    @NOW - INTERVAL 37 DAY),
 (2,'request.claim',    'request',  11,TRUE, 'Contact details released on claim',    @NOW - INTERVAL 6 DAY + INTERVAL 20 MINUTE),
 (2,'request.claim',    'request',   7,TRUE, 'Contact details released on claim',    @NOW - INTERVAL 20 HOUR),
 (1,'request.assign',   'request',   8,TRUE, 'Admin assigned Sneha Raj',             @NOW - INTERVAL 19 HOUR),
 (1,'disaster.create',  'disaster',  1,FALSE,'Created Kerala Floods 2026',           @NOW - INTERVAL 36 DAY);

-- ======================================================================
--  Reconcile volunteer aggregates FROM the rows just inserted, so the
--  numbers on screen can never disagree with the data behind them.
-- ======================================================================
UPDATE volunteer_profiles vp
LEFT JOIN (
  SELECT volunteer_id,
         COUNT(*)                   AS n_done,
         COALESCE(SUM(hours_logged),0) AS h
  FROM assignments WHERE status = 'COMPLETED' GROUP BY volunteer_id
) a ON a.volunteer_id = vp.user_id
LEFT JOIN (
  SELECT volunteer_id,
         COUNT(*)    AS n_rate,
         AVG(rating) AS avg_rate
  FROM feedback WHERE volunteer_id IS NOT NULL GROUP BY volunteer_id
) f ON f.volunteer_id = vp.user_id
SET vp.completed_count = COALESCE(a.n_done, 0),
    vp.hours_logged    = COALESCE(a.h, 0),
    vp.rating_count    = COALESCE(f.n_rate, 0),
    vp.rating_avg      = f.avg_rate;
