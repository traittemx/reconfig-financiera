const fs = require('fs');
const crypto = require('crypto');

const FILES = [
    'organizations.json', 'accounts.json', 'transactions.json',
    'categories.json', 'budgets.json', 'budget_items.json',
    'org_members.json', // ensure this exists or skip
    'user_lesson_progress.json'
];

function genUUID() { return crypto.randomUUID(); }

function main() {
    const userMap = {};
    const profiles = [];
    const orgs = [];

    // 1. Read Organizations to identify valid Org IDs (sanity check)
    if (fs.existsSync('organizations.json')) {
        const orgData = JSON.parse(fs.readFileSync('organizations.json'));
        orgData.forEach(o => orgs.push(o));
    }

    // 2. Scan all files for user_id and fix them
    FILES.forEach(file => {
        if (!fs.existsSync(file)) return;

        const data = JSON.parse(fs.readFileSync(file));
        let modified = false;

        data.forEach(row => {
            // Fix User ID
            if (row.user_id && row.user_id.length === 20) { // Appwrite ID detected
                if (!userMap[row.user_id]) {
                    userMap[row.user_id] = genUUID();
                    // Create Profile
                    // We don't have name/email easily unless we fetch from Appwrite Users API (which we skipped).
                    // We'll create a placeholder profile.
                    profiles.push({
                        id: userMap[row.user_id],
                        full_name: `Migrated User ${row.user_id}`,
                        org_id: row.org_id || (orgs[0] ? orgs[0].id : null), // Fallback to first org
                        role: 'MEMBER', // Default
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                }
                if (userMap[row.user_id]) {
                    row.user_id = userMap[row.user_id];
                    modified = true;
                }
            }

            // Fix Empty Org ID
            if (row.org_id === '' || row.org_id === null) {
                if (orgs.length > 0) {
                    row.org_id = orgs[0].id;
                    modified = true;
                }
            }
        });

        if (modified) {
            fs.writeFileSync(file, JSON.stringify(data, null, 2));
            console.log(`Updated ${file} with valid UUIDs.`);
        }
    });

    // 3. Save Profiles
    if (profiles.length > 0) {
        fs.writeFileSync('profiles.json', JSON.stringify(profiles, null, 2));
        console.log(`Created profiles.json with ${profiles.length} profiles.`);
    }
}

main();
