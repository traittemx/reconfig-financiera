/**
 * Lee transactions_import_batches.txt, aplica mapeo org_id/user_id a IDs reales de InsForge,
 * corrige ",," -> ",NULL,", y escribe SQL listo para ejecutar por lotes.
 * Los lotes hay que ejecutarlos vía MCP run-raw-sql (este script solo prepara el archivo).
 *
 * Mapeos (id_map -> IDs reales en DB):
 * Orgs: empresa-demo, notaria-2, traitte
 * Users: por full_name (profiles.json -> DB)
 */

const fs = require('fs');
const path = require('path');

const BATCHES_PATH = path.join(__dirname, '../data_import_ready/transactions_import_batches.txt');
const OUT_PATH = path.join(__dirname, '../data_import_ready/transactions_import_batches_fixed.txt');

const ORG_ID_MAP = {
  'ac771ead-9257-420f-ac77-2a536ca1fa1c': '56081a62-a2ca-4e3a-98a0-9d46b3f31a48', // empresa-demo
  'c0145c29-c470-4808-8ab2-79dc205bdb49': 'aea04c03-c0ef-454d-8e40-3244ecccae76', // notaria-2
  '7d8b7c64-f085-4465-9395-f638cf23c402': 'ef00e3d9-f04b-4b52-b227-ec40501e2dea', // traitte
};

const USER_ID_MAP = {
  'cf9c7934-3250-4872-b9b0-45dcde81068f': 'cea18be7-7ff7-4f17-b521-e75b7c0e3ebf', // Usuario Demo
  '623c41f6-d551-4827-8926-8b891ca27d88': '93ba976c-246f-4134-a669-1cbffa18cc2a', // Super Admin
  '9a859aff-89e0-4e51-b8de-af1910615247': 'ebc555f0-861a-42c2-a5f0-e040734272e1', // Miguel
  '89025497-0a0d-43ff-a52a-b051d3740f83': '75061774-ac00-46f3-b75e-600f2afb0d27', // Antonio Mendoza
  'c8235dce-1f70-4d95-aa6e-943d9005b0d3': 'e9d2e222-0fa5-4ded-ab5d-cf29b1a38e4d', // Hilda
  '206c4c7f-a673-4fe0-967e-ecce0f0124ec': '4f47598b-ca54-462e-a7b5-563f4860fc36', // María José
  '900cfc54-2551-4271-b849-190402082b62': '0dda8d95-cf73-4844-9288-452da50ca167', // césar
  '905a1bd1-5baf-4e52-8255-e0e0041cc632': '1d8cc04a-9daa-4613-8b9b-5d7e03b84a52', // Perla Noemi
  '6f27d2f7-7bed-42ed-882a-82f85b7690b5': 'a69ab7b1-83d2-4996-b012-cb7267b018b8', // Edgar
  '1fc7ff42-c4d4-460a-a2ba-fa38ad56cf07': 'b1899601-91ac-4406-8540-55b429b6fd9f', // Monse Miranda
};

let content = fs.readFileSync(BATCHES_PATH, 'utf8');

// Fix empty numeric fields: ",," -> ",NULL,"
while (content.includes(',,')) {
  content = content.replace(/,,/g, ',NULL,');
}

// Replace org IDs (only in org_id position: second column in VALUES tuple)
for (const [from, to] of Object.entries(ORG_ID_MAP)) {
  content = content.split(from).join(to);
}

// Replace user IDs
for (const [from, to] of Object.entries(USER_ID_MAP)) {
  content = content.split(from).join(to);
}

fs.writeFileSync(OUT_PATH, content, 'utf8');
console.log('Written to', OUT_PATH);
console.log('Split by "---BATCH---" and run each INSERT via MCP run-raw-sql.');
