// src/socketManager.js
const { Server } = require("socket.io");

let io;
const userSocketMap = new Map(); // Stores { userId -> socket.id }

function initializeSocket(httpServer) {
    io = new Server(httpServer, {
        // Configure CORS to allow your frontend to connect
        cors: {
            origin: "http://localhost:3000", // Your Next.js frontend URL
            methods: ["GET", "POST"]
        }
    });

    console.log("Socket.IO server initialized.");

    // This runs whenever a new user connects
    io.on('connection', (socket) => {
        console.log(`A user connected: ${socket.id}`);

        // Listen for an event from the frontend to register the user
        socket.on('register', (userId) => {
            console.log(`Registering user ${userId} with socket ${socket.id}`);
            userSocketMap.set(userId.toString(), socket.id);
        });

        // This runs when a user disconnects
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
            // Find and remove the user from our map upon disconnection
            for (let [userId, socketId] of userSocketMap.entries()) {
                if (socketId === socket.id) {
                    userSocketMap.delete(userId);
                    break;
                }
            }
        });
    });
}

/**
 * Emits an event to a specific user if they are connected.
 * @param {string|number} userId - The ID of the user to send the event to.
 * @param {string} eventName - The name of the event (e.g., 'new_notification').
 * @param {object} data - The data payload to send with the event.
 */
function emitToUser(userId, eventName, data) {
    const socketId = userSocketMap.get(userId.toString());
    if (socketId) {
        console.log(`Emitting event '${eventName}' to user ${userId} on socket ${socketId}`);
        io.to(socketId).emit(eventName, data);
    } else {
        console.log(`User ${userId} is not connected. Cannot emit event.`);
    }
}

module.exports = {
    initializeSocket,
    emitToUser,
};
