
INSERT INTO auth.users (
    id,
    email,
    password,
    email_verified,
    metadata,
    created_at,
    updated_at,
    is_project_admin,
    is_anonymous
) VALUES
(
    'cf9c7934-3250-4872-b9b0-45dcde81068f', -- id
    'demo@demo.com', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Usuario Demo", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    '623c41f6-d551-4827-8926-8b891ca27d88', -- id
    'joel@traitte.mx', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Joel", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    '9a859aff-89e0-4e51-b8de-af1910615247', -- id
    'miguel@traitte.mx', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Miguel", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    'bcdee46d-e0f7-4b1e-9d78-9ecf7988a5e4', -- id
    'jimscin2@gmail.com', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Cinthya", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    '89025497-0a0d-43ff-a52a-b051d3740f83', -- id
    'antmend2012@gmail.com', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Antonio Mendoza", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    'c8235dce-1f70-4d95-aa6e-943d9005b0d3', -- id
    '87hilda@gmail.com', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Hilda Márquez Flores", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    '206c4c7f-a673-4fe0-967e-ecce0f0124ec', -- id
    'mariajoseherrerar@gmail.com', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "María José Herrera Reyna", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    '905a1bd1-5baf-4e52-8255-e0e0041cc632', -- id
    'arperlanoemi@gmail.com', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Perla Noemi", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    '6f27d2f7-7bed-42ed-882a-82f85b7690b5', -- id
    'edgar_mt92@hotmail.com', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Edgar", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    '1fc7ff42-c4d4-460a-a2ba-fa38ad56cf07', -- id
    '1904miranda@gmail.com', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Monse Miranda", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    'c70cf53f-d566-40fa-b9f9-9579e45626fa', -- id
    'sati_narayani@hotmail.es', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Betsabe Ibarra", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    '57ed4c2d-d38c-410c-b4ff-e6860977263b', -- id
    'rfacundo@notaria2chapala.com', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Ricardo facundo", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    '900cfc54-2551-4271-b849-190402082b62', -- id
    'cr5273706@gmail.com', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "césar antonio alonso ramirez bobadilla", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    ),
(
    '560f55b4-4ff1-42bf-8ccd-d5adbeec894e', -- id
    'ferchorapmx@gmail.com', -- email
    '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S', -- password
    true, -- email_verified
    '{"name": "Fernando Ivan Martinez Alonso", "provider": "email"}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    )
ON CONFLICT (id) DO NOTHING;