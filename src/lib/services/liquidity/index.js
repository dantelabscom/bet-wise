// CommonJS wrapper for the liquidity services
// This file is used by server.js to avoid TypeScript module issues

// Import the TypeScript files using ts-node
const botServiceModule = require('./bot-service');
const sentimentServiceModule = require('./sentiment-service');

// Try to import the WebSocket service
let webSocketService;
try {
  const wsModule = require('../websocket/socket-service');
  webSocketService = wsModule.webSocketService;
} catch (error) {
  console.warn('WebSocket service not available during liquidity service initialization');
}

// Get the bot service instance
const botService = botServiceModule.botService || botServiceModule.BotService.getInstance();

// Connect the WebSocket service to the bot service if available
if (webSocketService && botService && typeof botService.setWebSocketService === 'function') {
  botService.setWebSocketService(webSocketService);
  console.log('WebSocket service connected to bot service during initialization');
}

// Export the singleton instances
module.exports = {
  botService,
  sentimentService: sentimentServiceModule.sentimentService || sentimentServiceModule.SentimentService.getInstance()
}; 