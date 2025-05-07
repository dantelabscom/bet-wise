// CommonJS wrapper for the WebSocket service
// This file is used by server.js to avoid TypeScript module issues

// Import the TypeScript file using ts-node
const socketServiceModule = require('./socket-service.ts');

// Export the singleton instance
module.exports = {
  webSocketService: socketServiceModule.webSocketService
}; 