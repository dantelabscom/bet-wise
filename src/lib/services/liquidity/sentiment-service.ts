import { botService, OrderType, OrderSide } from './bot-service';

// Sentiment levels
export enum SentimentLevel {
  STRONGLY_NEGATIVE = -2,  // Very unlikely to happen
  NEGATIVE = -1,           // Unlikely to happen
  NEUTRAL = 0,             // 50/50 chance
  POSITIVE = 1,            // Likely to happen
  STRONGLY_POSITIVE = 2    // Very likely to happen
}

// Market sentiment configuration
interface MarketSentiment {
  marketId: string;
  initialSentiment: SentimentLevel;
  currentSentiment: SentimentLevel;
  volatility: number;      // How much the price can swing (0.0-1.0)
  sentimentHistory: Array<{
    timestamp: number;
    sentiment: SentimentLevel;
    price: number;
  }>;
  lastUpdateTimestamp: number;
}

// News/event that can affect market sentiment
export interface MarketEvent {
  id: string;
  marketId: string;
  title: string;
  description: string;
  sentimentImpact: number; // -1.0 to 1.0 impact on sentiment
  timestamp: number;
}

// Singleton class for sentiment service
export class SentimentService {
  private static instance: SentimentService;
  private marketSentiments: Map<string, MarketSentiment> = new Map();
  private marketEvents: Map<string, MarketEvent[]> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): SentimentService {
    if (!SentimentService.instance) {
      SentimentService.instance = new SentimentService();
    }
    return SentimentService.instance;
  }
  
  // Initialize market with sentiment
  public initializeMarket(
    marketId: string, 
    name: string, 
    description: string, 
    initialSentiment: SentimentLevel = SentimentLevel.NEUTRAL,
    volatility: number = 0.2
  ): void {
    // Calculate initial price based on sentiment
    const initialPrice = this.calculatePriceFromSentiment(initialSentiment);
    
    // Initialize market sentiment
    this.marketSentiments.set(marketId, {
      marketId,
      initialSentiment,
      currentSentiment: initialSentiment,
      volatility: Math.max(0, Math.min(1, volatility)), // Clamp between 0 and 1
      sentimentHistory: [{
        timestamp: Date.now(),
        sentiment: initialSentiment,
        price: initialPrice
      }],
      lastUpdateTimestamp: Date.now()
    });
    
    // Initialize market events array
    this.marketEvents.set(marketId, []);
    
    // Initialize market with bot liquidity at the calculated price
    botService.initializeMarket(marketId, name, description, initialPrice);
    
    console.log(`Market ${marketId} initialized with sentiment ${initialSentiment} and price ${initialPrice}`);
    
    // Start sentiment evolution
    this.startSentimentEvolution(marketId);
  }
  
  // Calculate price from sentiment level (0.0-1.0)
  private calculatePriceFromSentiment(sentiment: SentimentLevel): number {
    // Map sentiment from -2 to 2 range to 0.1 to 0.9 price range
    // Neutral (0) sentiment = 0.5 price
    const normalizedSentiment = (sentiment + 2) / 4; // Maps -2 to 2 -> 0 to 1
    const price = 0.1 + (normalizedSentiment * 0.8); // Maps 0 to 1 -> 0.1 to 0.9
    
    // Round to 2 decimal places
    return Math.round(price * 100) / 100;
  }
  
  // Start sentiment evolution for a market
  private startSentimentEvolution(marketId: string): void {
    if (this.updateIntervals.has(marketId)) {
      console.log(`Sentiment evolution already running for market ${marketId}`);
      return;
    }
    
    // Update sentiment every 30-60 seconds
    const interval = setInterval(() => {
      this.evolveSentiment(marketId);
    }, 30000 + Math.random() * 30000);
    
    this.updateIntervals.set(marketId, interval);
    console.log(`Started sentiment evolution for market ${marketId}`);
  }
  
  // Stop sentiment evolution for a market
  public stopSentimentEvolution(marketId: string): void {
    const interval = this.updateIntervals.get(marketId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(marketId);
      console.log(`Stopped sentiment evolution for market ${marketId}`);
    }
  }
  
  // Evolve sentiment over time
  private evolveSentiment(marketId: string): void {
    const sentiment = this.marketSentiments.get(marketId);
    if (!sentiment) return;
    
    // Get recent events that might affect sentiment
    const events = this.marketEvents.get(marketId) || [];
    const recentEvents = events.filter(e => e.timestamp > sentiment.lastUpdateTimestamp);
    
    // Calculate sentiment change from events
    let sentimentChange = 0;
    recentEvents.forEach(event => {
      sentimentChange += event.sentimentImpact;
    });
    
    // Add random drift based on volatility
    const randomDrift = (Math.random() - 0.5) * sentiment.volatility;
    sentimentChange += randomDrift;
    
    // Update current sentiment (clamped between -2 and 2)
    const newSentimentValue = Math.max(-2, Math.min(2, 
      sentiment.currentSentiment + sentimentChange
    ));
    
    // Round to nearest sentiment level
    const newSentiment = Math.round(newSentimentValue) as SentimentLevel;
    
    // Only update if sentiment changed
    if (newSentiment !== sentiment.currentSentiment) {
      sentiment.currentSentiment = newSentiment;
      
      // Calculate new price
      const newPrice = this.calculatePriceFromSentiment(newSentiment);
      
      // Record in history
      sentiment.sentimentHistory.push({
        timestamp: Date.now(),
        sentiment: newSentiment,
        price: newPrice
      });
      
      // Update last update timestamp
      sentiment.lastUpdateTimestamp = Date.now();
      
      console.log(`Market ${marketId} sentiment evolved to ${newSentiment} with price ${newPrice}`);
      
      // Update market price in bot service
      this.updateMarketPrice(marketId, newPrice);
    }
  }
  
  // Update market price based on new sentiment
  private updateMarketPrice(marketId: string, newPrice: number): void {
    // Create a "news" event that will affect the market
    const marketData = botService.getMarketData(marketId);
    if (!marketData) return;
    
    // Generate more bot activity to move the price
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        // Process a fake order to move the price
        const order = {
          id: `sentiment-${Date.now()}-${i}`,
          userId: `sentiment-bot`,
          marketId,
          type: newPrice > marketData.currentPrice ? OrderType.BUY : OrderType.SELL,
          side: OrderSide.YES,
          price: newPrice,
          quantity: 50 + Math.floor(Math.random() * 150),
          timestamp: Date.now(),
          isBot: true
        };
        
        botService.processUserOrder(order);
      }, i * 1000); // Stagger orders over 5 seconds
    }
  }
  
  // Add a market event that affects sentiment
  public addMarketEvent(event: MarketEvent): void {
    const events = this.marketEvents.get(event.marketId) || [];
    events.push(event);
    this.marketEvents.set(event.marketId, events);
    
    console.log(`Added event to market ${event.marketId}: ${event.title}`);
    
    // Immediately evolve sentiment based on this event
    this.evolveSentiment(event.marketId);
  }
  
  // Get market sentiment
  public getMarketSentiment(marketId: string): any {
    const sentiment = this.marketSentiments.get(marketId);
    if (!sentiment) return null;
    
    return {
      marketId: sentiment.marketId,
      currentSentiment: sentiment.currentSentiment,
      initialSentiment: sentiment.initialSentiment,
      volatility: sentiment.volatility,
      history: sentiment.sentimentHistory,
      events: this.marketEvents.get(marketId) || []
    };
  }
  
  // Get market sentiment history for charting
  public getSentimentHistory(marketId: string): any[] {
    const sentiment = this.marketSentiments.get(marketId);
    if (!sentiment) return [];
    
    return sentiment.sentimentHistory.map(h => ({
      timestamp: h.timestamp,
      price: h.price
    }));
  }
  
  // Create a predefined market with realistic sentiment
  public createPredefinedMarket(type: 'cricket' | 'politics' | 'entertainment' | 'custom', customData?: any): string {
    const marketId = `market-${Date.now()}`;
    
    switch (type) {
      case 'cricket':
        // Cricket match example
        const homeTeam = customData?.homeTeam || 'India';
        const awayTeam = customData?.awayTeam || 'Australia';
        const homeAdvantage = customData?.homeAdvantage || true;
        
        // Home team has slight advantage
        const initialSentiment = homeAdvantage ? 
          SentimentLevel.POSITIVE : SentimentLevel.NEUTRAL;
        
        this.initializeMarket(
          marketId,
          `${homeTeam} vs ${awayTeam}`,
          `Will ${homeTeam} win against ${awayTeam}?`,
          initialSentiment,
          0.3 // Moderate volatility for sports
        );
        
        // Add some initial events
        if (homeAdvantage) {
          this.addMarketEvent({
            id: `event-${Date.now()}-1`,
            marketId,
            title: `${homeTeam} playing at home ground`,
            description: `${homeTeam} has home advantage with supportive crowd`,
            sentimentImpact: 0.2,
            timestamp: Date.now()
          });
        }
        
        break;
        
      case 'politics':
        // Election example
        const candidate1 = customData?.candidate1 || 'Candidate A';
        const candidate2 = customData?.candidate2 || 'Candidate B';
        const initialPolls = customData?.initialPolls || 'even';
        
        let politicsSentiment = SentimentLevel.NEUTRAL;
        if (initialPolls === 'favor1') politicsSentiment = SentimentLevel.POSITIVE;
        if (initialPolls === 'favor2') politicsSentiment = SentimentLevel.NEGATIVE;
        
        this.initializeMarket(
          marketId,
          `${candidate1} vs ${candidate2} Election`,
          `Will ${candidate1} win the election against ${candidate2}?`,
          politicsSentiment,
          0.15 // Lower volatility for politics
        );
        
        break;
        
      case 'entertainment':
        // Award show example
        const show = customData?.show || 'Oscar Awards';
        const nominee = customData?.nominee || 'Movie A';
        const category = customData?.category || 'Best Picture';
        const isFavorite = customData?.isFavorite || false;
        
        const awardSentiment = isFavorite ? 
          SentimentLevel.STRONGLY_POSITIVE : SentimentLevel.NEUTRAL;
        
        this.initializeMarket(
          marketId,
          `${show} - ${category}`,
          `Will ${nominee} win ${category} at the ${show}?`,
          awardSentiment,
          0.25 // Medium volatility for entertainment
        );
        
        break;
        
      case 'custom':
        if (!customData) {
          throw new Error('Custom data required for custom market');
        }
        
        this.initializeMarket(
          marketId,
          customData.name,
          customData.description,
          customData.sentiment || SentimentLevel.NEUTRAL,
          customData.volatility || 0.2
        );
        
        break;
    }
    
    return marketId;
  }
}

// Export singleton instance
export const sentimentService = SentimentService.getInstance(); 