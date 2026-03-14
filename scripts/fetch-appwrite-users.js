const sdk = require('node-appwrite');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new sdk.Client();
const users = new sdk.Users(client);

const ENDPOINT = process.env.APPWRITE_ENDPOINT || process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;

if (!API_KEY) {
    console.error('Error: APPWRITE_API_KEY is missing in .env');
    process.exit(1);
}

client
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

async function fetchAllUsers() {
    let allUsers = [];
    let offset = 0;
    const limit = 100;

    try {
        while (true) {
            const response = await users.list([
                sdk.Query.limit(limit),
                sdk.Query.offset(offset)
            ]);

            if (response.users.length === 0) break;

            allUsers = allUsers.concat(response.users);
            offset += limit;

            if (allUsers.length >= response.total) break;
        }

        console.log(`Fetched ${allUsers.length} users.`);

        const simplified = allUsers.map(u => ({
            id: u.$id,
            email: u.email,
            name: u.name,
            phone: u.phone
        }));

        fs.writeFileSync(path.join(__dirname, '../data_import_ready/appwrite_users.json'), JSON.stringify(simplified, null, 2));
        console.log('Saved to data_import_ready/appwrite_users.json');

    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

fetchAllUsers();
