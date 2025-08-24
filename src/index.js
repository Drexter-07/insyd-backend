// src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
// --- CHANGE #1: Import the built-in 'http' module ---
const http = require('http');
// --- CHANGE #2: Import our new socket manager ---
const { initializeSocket } = require('./socketManager');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const apiRoutes = require('./api/routes');
app.use('/api', apiRoutes);

// --- CHANGE #3: Create an HTTP server from our Express app ---
const httpServer = http.createServer(app);

// --- CHANGE #4: Initialize the Socket.IO server ---
initializeSocket(httpServer);

// --- CHANGE #5: Start the HTTP server instead of the Express app ---
httpServer.listen(port, () => {
    console.log(`Server (HTTP & WebSocket) listening on http://localhost:${port}`);
});
