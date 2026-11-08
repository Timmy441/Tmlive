const mongoose = require('mongoose');

// Fail requests explicitly while MongoDB is unavailable instead of buffering them
// indefinitely. The shared promise is reused by warm serverless invocations.
mongoose.set('bufferCommands', false);

const connectionOptions = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  maxPoolSize: 10,
};

let connectionPromise;

function databaseStatus() {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGO_URI) {
    const error = new Error('MONGO_URI is not configured');
    error.code = 'MONGO_URI_MISSING';
    throw error;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGO_URI, connectionOptions)
      .then(() => mongoose.connection)
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }

  return connectionPromise;
}

module.exports = {
  connectDatabase,
  databaseStatus,
};
