const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Azure Storage Connection
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = 'contacts';
const BLOB_NAME = 'contacts.json';

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

// Ensure the container exists
async function ensureContainer() {
    const exists = await containerClient.exists();
    if (!exists) {
        await containerClient.create();
    }
}

// Read existing contacts.json
async function readContacts() {
    try {
        const blobClient = containerClient.getBlockBlobClient(BLOB_NAME);
        const download = await blobClient.download(0);
        const downloaded = await streamToString(download.readableStreamBody);
        return JSON.parse(downloaded);
    } catch (err) {
        if (err.statusCode === 404) {
            return [];
        }
        throw err;
    }
}

// Write updated contacts.json
async function writeContacts(contacts) {
    const blobClient = containerClient.getBlockBlobClient(BLOB_NAME);
    await blobClient.upload(JSON.stringify(contacts, null, 2), Buffer.byteLength(JSON.stringify(contacts)));
}

// Convert stream to string helper
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => chunks.push(data.toString()));
        readableStream.on("end", () => resolve(chunks.join("")));
        readableStream.on("error", reject);
    });
}

app.post('/collect', async (req, res) => {
    try {
        await ensureContainer();
        const contacts = await readContacts();
        contacts.push({
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            timestamp: new Date().toISOString()
        });
        await writeContacts(contacts);
        res.json({ message: 'Contact saved successfully' });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
});
