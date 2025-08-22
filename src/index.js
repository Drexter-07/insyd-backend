require('dotenv').config();
const express = require('express');
const { connectDb } = require('./config/db');

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

const apiRoutes = require('./api/routes');
app.use('/api', apiRoutes);

async function startServer() {
  try {
    await connectDb();
    app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}

startServer();