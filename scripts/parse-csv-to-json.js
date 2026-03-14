const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CSV_DIR = path.join(__dirname, '../db_appwrite');
const OUT_DIR = path.join(__dirname, '../data_import_ready');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const FILE_MAP = {
    'Organizations_': 'organizations',
    'Profiles_': 'profiles',
    'Org Members_': 'org_members',
    'Categories_': 'categories',
    'Accounts_': 'accounts',
    'Transactions_': 'transactions',
    'Budgets_': 'budgets',
    'Budget Items_': 'budget_items',
    'Points Rules_': 'points_rules',
    'Points Events_': 'points_events',
    'Points Totals_': 'points_totals',
    'Lessons_': 'lessons',
    'User Lesson Progress_': 'user_lesson_progress',
    'Physical Assets_': 'physical_assets',
    'Pilot Daily Recommendations_': 'pilot_daily_recommendations',
    'Org Subscriptions_': 'org_subscriptions',
};

const ID_MAP = {}; // ID -> UUID
const USER_ORG_MAP = {}; // Appwrite User ID -> Org UUID
const ORG_ID_MAP = {}; // Appwrite Org ID -> UUID

const INT_ID_MAP = {
    lessons: {}
};
let lessonCounter = 1;

function genUUID() { return crypto.randomUUID(); }

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const rows = [];
    let currentRow = [];
    let currentVal = '';
    let inQuotes = false;

    // Helper to push row
    const pushRow = () => {
        currentRow.push(currentVal);
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
    };

    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const next = content[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                currentVal += '"'; // unescape ""
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                currentVal += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                currentRow.push(currentVal);
                currentVal = '';
            } else if (char === '\n' || (char === '\r' && next === '\n')) {
                if (char === '\r') i++;
                pushRow();
            } else if (char === '\r') {
                pushRow();
            } else {
                currentVal += char;
            }
        }
    }
    if (currentVal || currentRow.length > 0) pushRow();

    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));
    const data = [];

    for (let i = 1; i < rows.length; i++) {
        const vals = rows[i];
        if (vals.length < headers.length) continue;
        const row = {};
        headers.forEach((h, idx) => {
            let val = vals[idx];
            if (val) {
                val = val.trim();
                // Basic cleanup
                if (val === 'null') val = null;
                if (val === 'false') val = false;
                if (val === 'true') val = true;
            } else {
                val = null;
            }
            row[h] = val;
        });
        data.push(row);
    }
    return data;
}

function processFiles() {
    const files = fs.readdirSync(CSV_DIR);

    const tableFiles = {};
    for (const file of files) {
        for (const [key, table] of Object.entries(FILE_MAP)) {
            if (file.startsWith(key)) {
                tableFiles[table] = path.join(CSV_DIR, file);
                break;
            }
        }
    }

    // 1. Scan Orgs
    if (tableFiles['organizations']) {
        const rows = parseCSV(tableFiles['organizations']);
        rows.forEach(row => {
            const oldId = row['$id'];
            if (!ID_MAP[oldId]) {
                const newUuid = genUUID();
                ID_MAP[oldId] = newUuid;
                ORG_ID_MAP[oldId] = newUuid;
            }
        });
    }

    // 2. Scan Org Members
    if (tableFiles['org_members']) {
        console.log('Pre-scanning org_members for User->Org mapping...');
        const rows = parseCSV(tableFiles['org_members']);
        rows.forEach(row => {
            const awOrgId = row['teamId'] || row['org_id']; // Check CSV header for teamId/org_id
            const awUserId = row['userId'] || row['user_id'];

            if (awUserId && awOrgId) {
                if (!ID_MAP[awOrgId]) {
                    const newUuid = genUUID();
                    ID_MAP[awOrgId] = newUuid;
                    ORG_ID_MAP[awOrgId] = newUuid;
                }
                USER_ORG_MAP[awUserId] = ID_MAP[awOrgId];
            }
        });
    }

    const loadOrder = [
        'organizations',
        'profiles',
        'categories',
        'accounts',
        'budgets',
        'lessons',
        'points_rules'
    ];

    const dependentTables = [
        'org_members',
        'transactions',
        'budget_items',
        'points_events',
        'points_totals',
        'user_lesson_progress',
        'physical_assets',
        'pilot_daily_recommendations',
        'org_subscriptions'
    ];

    const allData = {};

    const EXPORTED_ORG_UUIDS = new Set();

    const processTable = (table) => {
        if (!tableFiles[table]) return;
        console.log(`Processing ${table}...`);
        const rows = parseCSV(tableFiles[table]);
        const cleanRows = [];

        rows.forEach(row => {
            const oldId = row['$id'];
            let newId = null;

            if (table === 'points_rules' || table === 'points_totals') {
                newId = undefined; // Use key or composite PK
            } else if (table === 'org_subscriptions') {
                newId = undefined; // Use org_id as PK
            } else if (table === 'lessons') {
                if (oldId && !INT_ID_MAP.lessons[oldId]) {
                    INT_ID_MAP.lessons[oldId] = lessonCounter++;
                }
                newId = INT_ID_MAP.lessons[oldId];
            } else {
                if (oldId) {
                    if (!ID_MAP[oldId]) ID_MAP[oldId] = genUUID();
                    newId = ID_MAP[oldId];
                } else {
                    newId = genUUID();
                }
            }

            const cleanRow = {};
            if (newId !== undefined) cleanRow.id = newId;

            // Track Exported Orgs
            if (table === 'organizations') {
                EXPORTED_ORG_UUIDS.add(cleanRow.id);
            }

            // COLUMN MAPPING
            for (const [key, val] of Object.entries(row)) {
                if (key.startsWith('$')) {
                    if (table === 'points_rules' && key === '$id') cleanRow['key'] = val;
                    if (table === 'org_subscriptions' && key === '$id') {
                        if (ID_MAP[val]) {
                            cleanRow['org_id'] = ID_MAP[val];
                        }
                    }
                    continue;
                }

                if (key === 'created_at') {
                    if (['lessons', 'points_rules', 'user_lesson_progress'].includes(table)) continue;
                }
                if (key === 'updated_at') {
                    if (table !== 'points_totals') continue;
                }

                let finalVal = val;

                if (key === 'lesson_id' || key === 'lessonId') {
                    // handled below
                } else if ((key.endsWith('_id') || key === 'parent_id') && typeof val === 'string') {
                    if (ID_MAP[val]) {
                        finalVal = ID_MAP[val];
                    }
                }

                if (key === 'amount' || key.includes('balance') || key.includes('limit') || key.includes('points') || key.includes('cost')) {
                    if (val !== null && val !== '') finalVal = parseFloat(val);
                }
                if (key === 'day' || key.includes('seats')) {
                    if (val !== null && val !== '') {
                        finalVal = parseInt(val, 10);
                    } else {
                        // DB defaults
                        if (key === 'seats_total') finalVal = 10;
                        if (key === 'seats_used') finalVal = 0;
                    }
                }

                cleanRow[key] = finalVal;
            }

            if (table === 'org_subscriptions') {
                if (!cleanRow['org_id']) {
                    const userId = row['user_id'] || row['userId'];
                    let foundUser = null;
                    if (row['$permissions']) {
                        const match = row['$permissions'].match(/user:([a-zA-Z0-9]+)/);
                        if (match) foundUser = match[1];
                    }

                    if (foundUser && USER_ORG_MAP[foundUser]) {
                        cleanRow['org_id'] = USER_ORG_MAP[foundUser];
                    } else {
                        // Fallback
                        const firstOrg = Object.values(ORG_ID_MAP)[0];
                        cleanRow['org_id'] = firstOrg || '5c9e6936-a2f0-42c9-aab1-078cc89fa8db';
                    }
                }
            }


            // POST-PROCESSING LOGIC (After loop to prevent overwrites)

            if (table === 'accounts') {
                const userId = row['user_id'] || row['userId'];
                if (!cleanRow['org_id']) {
                    if (userId && USER_ORG_MAP[userId]) {
                        cleanRow['org_id'] = USER_ORG_MAP[userId];
                    } else {
                        const firstOrg = Object.values(ORG_ID_MAP)[0];
                        cleanRow['org_id'] = firstOrg || '5c9e6936-a2f0-42c9-aab1-078cc89fa8db';
                    }
                }
            }

            if (table === 'lessons') {
                if (row.title) {
                    const match = row.title.match(/Día (\d+):/i);
                    if (match) {
                        cleanRow['day'] = parseInt(match[1]);
                    } else {
                        if (!cleanRow['day']) cleanRow['day'] = lessonCounter;
                    }
                }
            }

            if (table === 'user_lesson_progress') {
                if (row['day']) {
                    cleanRow['lesson_id'] = parseInt(row['day']);
                    cleanRow['day'] = parseInt(row['day']);
                }
                const userId = row['user_id'] || row['userId'];
                if (!cleanRow['org_id']) {
                    if (userId && USER_ORG_MAP[userId]) {
                        cleanRow['org_id'] = USER_ORG_MAP[userId];
                    } else {
                        const firstOrg = Object.values(ORG_ID_MAP)[0];
                        cleanRow['org_id'] = firstOrg || '5c9e6936-a2f0-42c9-aab1-078cc89fa8db';
                    }
                }
            }

            // Standard Timestamps
            if (row['$createdAt'] && !['lessons', 'points_rules', 'user_lesson_progress', 'org_subscriptions'].includes(table)) {
                cleanRow.created_at = row['$createdAt'];
            }
            if (row['$updatedAt'] && (table === 'points_totals' || table === 'org_subscriptions')) {
                cleanRow.updated_at = row['$updatedAt'];
            }

            // Final Fixes
            if (table === 'profiles') {
                if (row.full_name) {
                    try { cleanRow.full_name = decodeURIComponent(row.full_name.replace(/\+/g, ' ')); } catch (e) { }
                }
            }
            if (table === 'pilot_daily_recommendations') {
                if (!cleanRow['suggested_limit']) cleanRow['suggested_limit'] = "N/A";
            }

            cleanRows.push(cleanRow);
        });

        if (table === 'categories') {
            cleanRows.sort((a, b) => {
                if (a.parent_id === null && b.parent_id !== null) return -1;
                if (a.parent_id !== null && b.parent_id === null) return 1;
                return 0;
            });
        }

        // DEDUP ORG SUBSCRIPTIONS
        if (table === 'org_subscriptions') {
            const seenOrgs = new Set();
            const uniqueRows = [];
            cleanRows.forEach(r => {
                if (r.org_id && !seenOrgs.has(r.org_id)) {
                    seenOrgs.add(r.org_id);
                    uniqueRows.push(r);
                }
            });
            allData[table] = uniqueRows;
            return;
        }

        // FILTER POINTS TOTALS
        if (table === 'points_totals') {
            const validRows = cleanRows.filter(r => {
                const validOrgUUIDs = new Set(Object.values(ORG_ID_MAP));
                return validOrgUUIDs.has(r.org_id);
            });
            allData[table] = validRows;
            return;
        }

        allData[table] = cleanRows;
    };

    [...loadOrder, ...dependentTables].forEach(t => processTable(t));

    for (const [table, rows] of Object.entries(allData)) {
        if (rows.length > 0) {
            fs.writeFileSync(path.join(OUT_DIR, `${table}.json`), JSON.stringify(rows, null, 2));
            console.log(`Exported ${table}.json (${rows.length} records)`);
        }
    }

    // EXPORT ID MAPPINGS
    fs.writeFileSync(path.join(OUT_DIR, 'id_map.json'), JSON.stringify(ID_MAP, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'user_org_map.json'), JSON.stringify(USER_ORG_MAP, null, 2));
    console.log('Exported id_map.json and user_org_map.json');
}

processFiles();
