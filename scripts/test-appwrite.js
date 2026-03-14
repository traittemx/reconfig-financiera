const { Client, Databases } = require('node-appwrite');
require('dotenv').config();

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const db = new Databases(client);

async function test() {
    try {
        console.log('Testing Appwrite connection...');
        console.log('Endpoint:', process.env.APPWRITE_ENDPOINT);
        console.log('Project:', process.env.APPWRITE_PROJECT_ID);
        const res = await db.listDocuments('finaria', 'organizations', []);
        console.log('Success! Found', res.total, 'organizations.');
        if (res.documents.length > 0) {
            console.log('Sample Organization:', JSON.stringify(res.documents[0], null, 2));
        }
    } catch (error) {
        console.error('Appwrite connection failed:', error.message);
    }
}

test();
