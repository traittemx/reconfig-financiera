const fs = require('fs');

const CSV_DATA = `697d1466001d26b71d4e,"[""read(\""user:697d1466001d26b71d4e\"")"",""update(\""user:697d1466001d26b71d4e\"")"",""delete(\""user:697d1466001d26b71d4e\"")""]",2026-01-30T21:33:08.912+00:00,2026-01-31T15:25:39.929+00:00,Usuario Demo,697d14670000c97d9933,ORG_ADMIN,2026-01-31,null,2026-01-30T21:33:08.792+00:00,2026-01-31T15:25:39.691+00:00
69853900001b5bfd41b3,,2026-02-06T00:46:05.551+00:00,2026-02-06T02:45:57.997+00:00,Super Admin,null,SUPER_ADMIN,2026-02-06,null,2026-02-06T00:46:05.165+00:00,2026-02-06T02:45:57.404+00:00
69859ad5002c0c84408d,"[""read(\""user:69859ad5002c0c84408d\"")"",""update(\""user:69859ad5002c0c84408d\"")"",""delete(\""user:69859ad5002c0c84408d\"")""]",2026-02-06T07:40:06.780+00:00,2026-02-06T08:08:22.449+00:00,Miguel,69858ad4001df83d4aee,EMPLOYEE,2026-02-06,null,2026-02-06T07:40:06.491+00:00,2026-02-06T08:08:22.254+00:00
698609ff001c8a2ec362,"[""read(\""user:698609ff001c8a2ec362\"")"",""update(\""user:698609ff001c8a2ec362\"")"",""delete(\""user:698609ff001c8a2ec362\"")""]",2026-02-06T15:34:24.664+00:00,2026-02-06T15:34:31.077+00:00,Cinthya,69858ad4001df83d4aee,EMPLOYEE,null,null,2026-02-06T15:34:24.908+00:00,2026-02-06T15:34:31.014+00:00
6986628c0038f1ae4224,"[""read(\""user:6986628c0038f1ae4224\"")"",""update(\""user:6986628c0038f1ae4224\"")"",""delete(\""user:6986628c0038f1ae4224\"")""]",2026-02-06T21:52:14.854+00:00,2026-02-06T22:31:56.953+00:00,Antonio+Mendoza,69856d49001238acbf3e,EMPLOYEE,2026-02-06,null,2026-02-06T21:52:14.505+00:00,2026-02-06T22:31:56.397+00:00
69866490001ebcf9b432,"[""read(\""user:69866490001ebcf9b432\"")"",""update(\""user:69866490001ebcf9b432\"")"",""delete(\""user:69866490001ebcf9b432\"")""]",2026-02-06T22:00:50.557+00:00,2026-02-06T22:01:15.647+00:00,Hilda+M%C3%A1rquez+Flores,69856d49001238acbf3e,EMPLOYEE,2026-02-06,null,2026-02-06T22:00:50.096+00:00,2026-02-06T22:01:15.155+00:00
698664a30026681c2b05,"[""read(\""user:698664a30026681c2b05\"")"",""update(\""user:698664a30026681c2b05\"")"",""delete(\""user:698664a30026681c2b05\"")""]",2026-02-06T22:01:09.076+00:00,2026-02-06T22:31:35.823+00:00,Mar%C3%ADa+Jos%C3%A9+Herrera+Reyna,69856d49001238acbf3e,EMPLOYEE,2026-02-06,null,2026-02-06T22:01:08.731+00:00,2026-02-06T22:31:35.486+00:00
698664a80001ecb7e01b,"[""read(\""user:698664a80001ecb7e01b\"")"",""update(\""user:698664a80001ecb7e01b\"")"",""delete(\""user:698664a80001ecb7e01b\"")""]",2026-02-06T22:01:13.251+00:00,2026-02-06T22:02:38.668+00:00,Perla+Noemi,69856d49001238acbf3e,EMPLOYEE,2026-02-06,null,2026-02-06T22:01:12.943+00:00,2026-02-06T22:02:38.362+00:00
698664a8000e309b357f,"[""read(\""user:698664a8000e309b357f\"")"",""update(\""user:698664a8000e309b357f\"")"",""delete(\""user:698664a8000e309b357f\"")""]",2026-02-06T22:01:13.681+00:00,2026-02-06T22:31:45.610+00:00,Edgar,69856d49001238acbf3e,EMPLOYEE,2026-02-06,null,2026-02-06T22:01:13.352+00:00,2026-02-06T22:31:45.076+00:00
698665b000366a87a2f0,"[""read(\""user:698665b000366a87a2f0\"")"",""update(\""user:698665b000366a87a2f0\"")"",""delete(\""user:698665b000366a87a2f0\"")""]",2026-02-06T22:05:38.167+00:00,2026-02-06T22:31:57.715+00:00,Monse+Miranda,69856d49001238acbf3e,EMPLOYEE,2026-02-06,null,2026-02-06T22:05:37.817+00:00,2026-02-06T22:31:57.118+00:00
6986666f003860cab686,"[""read(\""user:6986666f003860cab686\"")"",""update(\""user:6986666f003860cab686\"")"",""delete(\""user:6986666f003860cab686\"")""]",2026-02-06T22:08:49.749+00:00,2026-02-06T22:32:17.171+00:00,Betsabe+Ibarra,69856d49001238acbf3e,EMPLOYEE,2026-02-06,null,2026-02-06T22:08:49.427+00:00,2026-02-06T22:32:16.820+00:00
69867155001df82b6736,"[""read(\""user:69867155001df82b6736\"")"",""update(\""user:69867155001df82b6736\"")"",""delete(\""user:69867155001df82b6736\"")""]",2026-02-06T22:55:19.285+00:00,2026-02-06T22:55:34.303+00:00,Ricardo+facundo,69856d49001238acbf3e,EMPLOYEE,2026-02-06,null,2026-02-06T22:55:18.258+00:00,2026-02-06T22:55:33.364+00:00
698915af003163bed625,"[""read(\""user:698915af003163bed625\"")"",""update(\""user:698915af003163bed625\"")"",""delete(\""user:698915af003163bed625\"")""]",2026-02-08T23:01:05.413+00:00,2026-02-08T23:02:22.183+00:00,c%C3%A9sar+antonio+alonso+ramirez+bobadilla,69858ad4001df83d4aee,EMPLOYEE,2026-02-08,null,2026-02-08T23:01:04.978+00:00,2026-02-08T23:02:21.708+00:00
698a288a00010b5d1ff8,"[""read(\""user:698a288a00010b5d1ff8\"")"",""update(\""user:698a288a00010b5d1ff8\"")"",""delete(\""user:698a288a00010b5d1ff8\"")""]",2026-02-09T18:34:56.255+00:00,2026-02-09T18:35:01.488+00:00,Fernando+Ivan+Martinez+Alonso,69858ad4001df83d4aee,EMPLOYEE,null,null,2026-02-09T18:33:47.152+00:00,2026-02-09T18:35:01.446+00:00`;

const ORG_MAP = {
    '697d14670000c97d9933': '4babe1ff-5c09-41ef-bffa-bf136ab0209c',
    '69856d49001238acbf3e': '23c2cfa1-2f26-4be5-a58b-246be3b1ec0f',
    '69858ad4001df83d4aee': '5fa89125-de60-4981-87bc-b93e380c1aae'
};

function main() {
    try {
        console.log('Deduping profiles...');
        const profiles = JSON.parse(fs.readFileSync('profiles.json', 'utf8'));
        const accounts = fs.existsSync('accounts.json') ? JSON.parse(fs.readFileSync('accounts.json', 'utf8')) : [];

        const usedUserIds = new Set(accounts.map(a => a.user_id));

        const dedupedProfiles = [];
        const seenNames = new Set();
        const profilesByName = {}; // Map Name -> Profile (Prefer usedId)

        // Pass 1: Collect unique profiles by Name, prioritizing used IDs
        profiles.forEach(p => {
            // Normalized name for dedup
            const name = p.full_name.trim();
            if (!profilesByName[name]) {
                profilesByName[name] = p;
            } else {
                // Conflict. Check priority.
                if (usedUserIds.has(p.id) && !usedUserIds.has(profilesByName[name].id)) {
                    profilesByName[name] = p; // Replace with used one
                }
            }
        });

        const finalProfiles = Object.values(profilesByName);
        fs.writeFileSync('profiles.json', JSON.stringify(finalProfiles, null, 2));
        console.log(`Profiles deduped: ${profiles.length} -> ${finalProfiles.length}`);

        // Build Name -> UUID Map
        const nameToUuid = {};
        finalProfiles.forEach(p => nameToUuid[p.full_name] = p.id);

        // Build Appwrite ID -> UUID Map via CSV Names
        const awIdToUuid = {};
        const lines = CSV_DATA.split('\n');

        lines.forEach(line => {
            if (!line.trim()) return;
            const parts = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { parts.push(current); current = ''; }
                else current += char;
            }
            parts.push(current);

            const awId = parts[0];
            let name = parts[4];
            try { name = decodeURIComponent(name.replace(/\+/g, ' ')); } catch (e) { }
            name = name.replace(/^"|"$/g, '');

            if (nameToUuid[name]) {
                awIdToUuid[awId] = nameToUuid[name];
            }
        });

        // Generate or Fix Org Members
        console.log('Generating/Fixing org_members.json...');
        let members = [];
        if (fs.existsSync('org_members.json')) {
            members = JSON.parse(fs.readFileSync('org_members.json', 'utf8'));
        } else {
            // Synthesize from Profiles
            console.log('Synthesizing members from profiles...');
            finalProfiles.forEach(p => {
                if (p.org_id) {
                    members.push({
                        id: require('crypto').randomUUID(),
                        user_id: p.id,
                        org_id: p.org_id,
                        role_in_org: p.role || 'MEMBER',
                        status: 'active',
                        created_at: p.created_at,
                        // We don't have Appwrite ID for this member record, but we have user_id/org_id resolved already if p is resolved.
                        // But wait, p.org_id is already UUID?
                        // In profiles.json, p.org_id WAS mapped to UUID in update-profiles script.
                    });
                }
            });
        }

        const validMembers = [];

        // If we synthesized, they are already valid UUIDs. 
        // If we read from file, they might be Appwrite IDs.

        members.forEach(m => {
            let changed = false;
            // Fix User ID (only if Appwrite ID)
            if (m.user_id.length === 20 && awIdToUuid[m.user_id]) {
                m.user_id = awIdToUuid[m.user_id];
                changed = true;
            }
            // Fix Org ID (only if Appwrite ID)
            if (m.org_id.length === 20 && ORG_MAP[m.org_id]) {
                m.org_id = ORG_MAP[m.org_id];
                changed = true;
            }

            if (m.user_id.length > 30 && m.org_id.length > 30) {
                validMembers.push(m);
            }
        });

        fs.writeFileSync('org_members.json', JSON.stringify(validMembers, null, 2));
        console.log(`Org Members Fixed/Generated: ${validMembers.length}`);

    } catch (e) {
        console.error(e);
    }
}

main();
