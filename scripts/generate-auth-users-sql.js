const fs = require('fs');
const path = require('path');

const usersFile = path.join(__dirname, '../data_import_ready/appwrite_users.json');
const mapFile = path.join(__dirname, '../data_import_ready/id_map.json');
const outFile = path.join(__dirname, '../auth_users_import.sql');

const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
const idMap = JSON.parse(fs.readFileSync(mapFile, 'utf8'));

console.log(`Loaded ${users.length} users and ${Object.keys(idMap).length} ID mappings.`);

// Dummy bcrypt hash for "password123" (or similar placeholder)
const DUMMY_HASH = '$2a$10$2l.X.N.7.u.x.y.z.A.B.C.D.E.F.G.H.I.J.K.L.M.N.O.P.Q.R.S';

let sql = `
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
`;

const values = [];

for (const user of users) {
    const appwriteId = user.id;
    const insforgeUuid = idMap[appwriteId];

    if (!insforgeUuid) {
        console.warn(`Warning: No UUID mapping found for Appwrite User ${appwriteId} (${user.email})`);
        continue;
    }

    const email = user.email.replace(/'/g, "''"); // escape single quotes
    const name = (user.name || '').replace(/'/g, "''");

    // Metadata
    const metadata = `{"name": "${name}", "provider": "email"}`;

    const row = `(
    '${insforgeUuid}', -- id
    '${email}', -- email
    '${DUMMY_HASH}', -- password
    true, -- email_verified
    '${metadata}', -- metadata
    NOW(), -- created_at
    NOW(), -- updated_at
    false, -- is_project_admin
    false -- is_anonymous
    )`;

    values.push(row);
}

if (values.length > 0) {
    sql += values.join(',\n');
    sql += '\nON CONFLICT (id) DO NOTHING;'; // Safety

    fs.writeFileSync(outFile, sql);
    console.log(`Generated SQL for ${values.length} users at ${outFile}`);
} else {
    console.log('No users to import.');
}
