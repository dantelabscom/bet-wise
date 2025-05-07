// CommonJS wrapper for the liquidity services
// This file is used by server.js to avoid TypeScript module issues

// Import the TypeScript files using ts-node
const botServiceModule = require('./bot-service');
const sentimentServiceModule = require('./sentiment-service');

// Export the singleton instances
module.exports = {
  botService: botServiceModule.botService || botServiceModule.BotService.getInstance(),
  sentimentService: sentimentServiceModule.sentimentService || sentimentServiceModule.SentimentService.getInstance()
}; 