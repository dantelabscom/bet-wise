import { OddsCalculator } from '@/lib/models/odds-calculator';

// WebSocket connection state
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// Events that we can subscribe to
type EventType = 'score_update' | 'market_update' | 'odds_change' | 'game_status';

// Event subscription callback
type EventCallback = (data: any) => void;

/**
 * LiveDataService handles real-time sports data using WebSockets
 * 
 * This service connects to a WebSocket server for real-time updates
 * and provides methods to subscribe to different event types.
 */
export class LiveDataService {
  private static instance: LiveDataService;
  private socket: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private subscriptions: Map<EventType, EventCallback[]> = new Map();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 3000; // 3 seconds
  private apiKey: string;
  private lastKnownScores: Map<string, { homeScore: number; awayScore: number }> = new Map();
  
  // Private constructor for singleton pattern
  private constructor() {
    // Read API key from environment variables - using NEXT_PUBLIC_ for client-side
    this.apiKey = process.env.NEXT_PUBLIC_SPORTS_DATA_WS_API_KEY || '';
    if (!this.apiKey) {
      console.error('NEXT_PUBLIC_SPORTS_DATA_WS_API_KEY is not set in environment variables');
    }
    
    this.subscriptions.set('score_update', []);
    this.subscriptions.set('market_update', []);
    this.subscriptions.set('odds_change', []);
    this.subscriptions.set('game_status', []);
  }
  
  /**
   * Get the singleton instance of LiveDataService
   */
  public static getInstance(): LiveDataService {
    if (!LiveDataService.instance) {
      LiveDataService.instance = new LiveDataService();
    }
    return LiveDataService.instance;
  }
  
  /**
   * Connect to the WebSocket server
   * @returns Promise that resolves when connected
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && (this.state === 'connected' || this.state === 'connecting')) {
        resolve();
        return;
      }
      
      this.state = 'connecting';
      
      try {
        // Production WebSocket endpoint with API key
        this.socket = new WebSocket(`wss://api.sportsdata.io/v4/odds/websocket?api_key=${this.apiKey}`);
        
        this.socket.onopen = () => {
          this.state = 'connected';
          this.reconnectAttempts = 0;
          console.log('Connected to sports data WebSocket');
          
          // Send subscription messages for all active subscriptions
          this.subscriptions.forEach((callbacks, eventType) => {
            if (callbacks.length > 0) {
              this.sendSubscription(eventType);
            }
          });
          
          resolve();
        };
        
        this.socket.onclose = (event) => {
          this.state = 'disconnected';
          console.log(`Disconnected from sports data WebSocket: Code: ${event.code}, Reason: ${event.reason}`);
          this.attemptReconnect();
        };
        
        this.socket.onerror = (error) => {
          this.state = 'error';
          console.error('WebSocket error:', error);
          reject(error);
        };
        
        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.state = 'error';
        console.error('Error creating WebSocket connection:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Close the WebSocket connection
   */
  public disconnect(): void {
    if (this.socket) {
      // Send unsubscribe messages for all active subscriptions
      this.subscriptions.forEach((callbacks, eventType) => {
        if (callbacks.length > 0) {
          this.sendUnsubscription(eventType);
        }
      });
      
      // Close the connection
      this.socket.close(1000, 'Client disconnected');
      this.socket = null;
      this.state = 'disconnected';
    }
  }
  
  /**
   * Check if the service is connected
   */
  public isConnected(): boolean {
    return this.state === 'connected';
  }
  
  /**
   * Get the current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.state;
  }
  
  /**
   * Subscribe to a specific event type
   * @param eventType The type of event to subscribe to
   * @param callback The callback function to execute when the event occurs
   */
  public subscribe(eventType: EventType, callback: EventCallback): void {
    const callbacks = this.subscriptions.get(eventType) || [];
    callbacks.push(callback);
    this.subscriptions.set(eventType, callbacks);
    
    // If we're already connected, send a subscription message
    if (this.state === 'connected' && this.socket) {
      this.sendSubscription(eventType);
    }
  }
  
  /**
   * Unsubscribe from a specific event type
   * @param eventType The type of event to unsubscribe from
   * @param callback The callback function to remove
   */
  public unsubscribe(eventType: EventType, callback: EventCallback): void {
    const callbacks = this.subscriptions.get(eventType) || [];
    const filteredCallbacks = callbacks.filter(cb => cb !== callback);
    this.subscriptions.set(eventType, filteredCallbacks);
    
    // If there are no more callbacks for this event type, send an unsubscribe message
    if (filteredCallbacks.length === 0 && this.state === 'connected' && this.socket) {
      this.sendUnsubscription(eventType);
    }
  }
  
  /**
   * Send a subscription message
   * @param eventType The event type to subscribe to
   */
  private sendSubscription(eventType: EventType): void {
    if (this.state === 'connected' && this.socket) {
      try {
        this.socket.send(JSON.stringify({
          type: 'subscribe',
          event: eventType,
          apiKey: this.apiKey
        }));
      } catch (error) {
        console.error(`Error sending subscription for ${eventType}:`, error);
      }
    }
  }
  
  /**
   * Send an unsubscription message
   * @param eventType The event type to unsubscribe from
   */
  private sendUnsubscription(eventType: EventType): void {
    if (this.state === 'connected' && this.socket) {
      try {
        this.socket.send(JSON.stringify({
          type: 'unsubscribe',
          event: eventType,
          apiKey: this.apiKey
        }));
      } catch (error) {
        console.error(`Error sending unsubscription for ${eventType}:`, error);
      }
    }
  }
  
  /**
   * Handle incoming WebSocket messages
   * @param data The message data
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // Handle different message types
      switch (message.type) {
        case 'score_update':
          this.processScoreUpdate(message.data);
          break;
          
        case 'market_update':
          this.notifySubscribers('market_update', message.data);
          break;
          
        case 'odds_change':
          this.notifySubscribers('odds_change', message.data);
          break;
          
        case 'game_status':
          this.notifySubscribers('game_status', message.data);
          break;
          
        case 'heartbeat':
          // Heartbeat messages to keep the connection alive
          this.handleHeartbeat(message);
          break;
          
        case 'error':
          console.error('Error message from WebSocket server:', message.error);
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }
  
  /**
   * Process score updates and detect changes
   * @param data Score update data
   */
  private processScoreUpdate(data: any): void {
    // Notify subscribers of the score update
    this.notifySubscribers('score_update', data);
    
    const { gameId, homeScore, awayScore } = data;
    
    // Check if we have previous scores for this game
    const previousScores = this.lastKnownScores.get(gameId);
    
    // Determine if there was a score change
    if (previousScores) {
      const homeScoreChanged = homeScore !== previousScores.homeScore;
      const awayScoreChanged = awayScore !== previousScores.awayScore;
      
      if (homeScoreChanged || awayScoreChanged) {
        // Update odds based on score change
        this.updateOddsForScoreChange(data, {
          homeScoreChanged,
          awayScoreChanged,
          previousHomeScore: previousScores.homeScore,
          previousAwayScore: previousScores.awayScore
        });
      }
    }
    
    // Update the last known scores
    this.lastKnownScores.set(gameId, { homeScore, awayScore });
  }
  
  /**
   * Handle heartbeat messages from the server
   * @param message The heartbeat message
   */
  private handleHeartbeat(message: any): void {
    // Respond to heartbeat if required
    if (message.requireResponse && this.socket && this.state === 'connected') {
      try {
        this.socket.send(JSON.stringify({
          type: 'heartbeat_response',
          id: message.id,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error sending heartbeat response:', error);
      }
    }
  }
  
  /**
   * Notify all subscribers of an event
   * @param eventType The type of event
   * @param data The event data
   */
  private notifySubscribers(eventType: EventType, data: any): void {
    const callbacks = this.subscriptions.get(eventType) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${eventType} callback:`, error);
      }
    });
  }
  
  /**
   * Update odds based on score changes using our odds calculator
   * @param data Score update data
   * @param scoreChangeInfo Information about the score change
   */
  private updateOddsForScoreChange(data: any, scoreChangeInfo: {
    homeScoreChanged: boolean,
    awayScoreChanged: boolean,
    previousHomeScore: number,
    previousAwayScore: number
  }): void {
    try {
      // Extract game information
      const { gameId, homeScore, awayScore, timeElapsed, momentum, sport } = data;
      
      // Determine score change direction (-1, 0, 1) for odds adjustment
      // Positive means home team scored, negative means away team scored
      const scoreChange = this.determineScoreChangeDirection(
        data,
        scoreChangeInfo.homeScoreChanged,
        scoreChangeInfo.awayScoreChanged,
        scoreChangeInfo.previousHomeScore,
        scoreChangeInfo.previousAwayScore
      );
      
      // Calculate normalized time elapsed (0-1)
      // Different sports have different total times
      const maxTimeSeconds = this.getMaxTimeForSport(sport);
      const normalizedTimeElapsed = Math.min(timeElapsed / maxTimeSeconds, 1);
      
      // Fetch current market odds for this game from our platform
      // In a production implementation, this would come from your database
      this.fetchCurrentMarketOdds(gameId).then(currentOdds => {
        if (!currentOdds) return;
        
        // Use our OddsCalculator to adjust odds based on in-play factors
        const adjustedOdds = OddsCalculator.calculateInPlayAdjustment(
          currentOdds,
          scoreChange,
          normalizedTimeElapsed,
          momentum
        );
        
        // Create market update data
        const marketUpdateData = {
          gameId,
          sport,
          homeScore,
          awayScore,
          timeElapsed,
          scoreChange,
          currentOdds,
          adjustedOdds,
          timestamp: Date.now()
        };
        
        // Notify market update subscribers
        this.notifySubscribers('market_update', marketUpdateData);
      });
    } catch (error) {
      console.error('Error updating odds for score change:', error);
    }
  }
  
  /**
   * Fetch current market odds for a game
   * @param gameId Game ID
   * @returns Promise that resolves with current odds
   */
  private async fetchCurrentMarketOdds(gameId: string): Promise<number[] | null> {
    try {
      // In a production implementation, this would fetch from your database
      // or another API endpoint within your platform
      const response = await fetch(`/api/markets/${gameId}/odds`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch current odds');
      }
      
      const data = await response.json();
      return data.odds;
    } catch (error) {
      console.error('Error fetching current market odds:', error);
      
      // Fallback to default odds
      return [1.8, 2.2]; // Example odds [home, away]
    }
  }
  
  /**
   * Determine the direction of score change for odds adjustment
   * @param data Score update data
   * @param homeScoreChanged Whether home team score changed
   * @param awayScoreChanged Whether away team score changed
   * @param previousHomeScore Previous home team score
   * @param previousAwayScore Previous away team score
   * @returns Score change direction (-1, 0, 1)
   */
  private determineScoreChangeDirection(
    data: any,
    homeScoreChanged: boolean,
    awayScoreChanged: boolean,
    previousHomeScore: number,
    previousAwayScore: number
  ): number {
    // If only one team scored, this is straightforward
    if (homeScoreChanged && !awayScoreChanged) {
      const scoreValue = data.homeScore - previousHomeScore;
      return scoreValue > 0 ? 1 : 0; // Home team scored
    }
    
    if (!homeScoreChanged && awayScoreChanged) {
      const scoreValue = data.awayScore - previousAwayScore;
      return scoreValue > 0 ? -1 : 0; // Away team scored
    }
    
    // If both teams scored in the same update (rare but possible),
    // we need to determine which change is more significant
    if (homeScoreChanged && awayScoreChanged) {
      const homeScoreDiff = data.homeScore - previousHomeScore;
      const awayScoreDiff = data.awayScore - previousAwayScore;
      
      if (homeScoreDiff > awayScoreDiff) {
        return 0.5; // Home team scored more
      } else if (awayScoreDiff > homeScoreDiff) {
        return -0.5; // Away team scored more
      } else {
        return 0; // Equal scoring, no momentum shift
      }
    }
    
    // If no score changes detected (might be another update like time elapsed)
    return 0;
  }
  
  /**
   * Get the maximum game time in seconds for a sport
   * @param sport The sport
   * @returns Maximum game time in seconds
   */
  private getMaxTimeForSport(sport: string): number {
    switch (sport?.toLowerCase()) {
      case 'nba':
        return 48 * 60; // 48 minutes in seconds
      case 'nfl':
        return 60 * 60; // 60 minutes in seconds
      case 'soccer':
        return 90 * 60; // 90 minutes in seconds
      case 'mlb':
        return 9 * 3 * 5 * 60; // 9 innings, ~15 min per inning
      case 'cricket':
        // For T20 cricket
        return 20 * 6 * 30; // 20 overs per innings, 6 balls per over, ~30 sec per ball
      default:
        return 2700; // Default 45 minutes in seconds
    }
  }
  
  /**
   * Attempt to reconnect to the WebSocket server
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    
    // Exponential backoff for reconnect attempts
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect in ${delay/1000} seconds (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnect attempt failed:', error);
      });
    }, delay);
  }
} 