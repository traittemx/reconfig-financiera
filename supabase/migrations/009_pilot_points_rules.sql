-- Piloto gamification: points rules (only positive, no subtraction)
INSERT INTO points_rules (key, points, is_active) VALUES
('RECOMMENDATION_FOLLOWED', 25, true),
('CRITICAL_DAY_LOGGED', 15, true),
('RESCUE', 10, true)
ON CONFLICT (key) DO UPDATE SET points = EXCLUDED.points, is_active = EXCLUDED.is_active;
