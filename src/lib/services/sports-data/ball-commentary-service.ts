import { sportMonksCricket } from './sportmonks-cricket';
import { webSocketService } from '../websocket/socket-service';
import { EventEmitter } from 'events';

/**
 * Ball event interface representing a single ball in cricket
 */
export interface BallEvent {
  id: number;
  matchId: string;
  over: number;
  ball: number;
  bowler: string;
  batsman: string;
  runs: number;
  extras: number;
  isWicket: boolean;
  wicketType?: string;
  commentary: string;
  timestamp: number;
  isBoundary: boolean;
  isSix: boolean;
}

/**
 * Service for fetching and broadcasting ball-by-ball updates
 */
export class BallCommentaryService extends EventEmitter {
  private static instance: BallCommentaryService;
  private pollingInterval: NodeJS.Timeout | null = null;
  private matchPollingMap: Map<string, { 
    interval: NodeJS.Timeout, 
    lastBallId: number,
    lastTimestamp: number
  }> = new Map();
  
  // Cache for ball data to avoid duplicate processing
  private ballCache: Map<number, BallEvent> = new Map();
  
  // Private constructor for singleton pattern
  private constructor() {
    super();
  }
  
  // Get singleton instance
  public static getInstance(): BallCommentaryService {
    if (!BallCommentaryService.instance) {
      BallCommentaryService.instance = new BallCommentaryService();
    }
    return BallCommentaryService.instance;
  }
  
  /**
   * Start polling for a specific match
   * @param matchId Match ID
   * @param intervalMs Polling interval in milliseconds (default: 10 seconds)
   */
  public startPolling(matchId: string, intervalMs: number = 10000): void {
    // Stop existing polling if any
    this.stopPolling(matchId);
    
    console.log(`Starting ball-by-ball polling for match ${matchId}`);
    
    // Create new polling interval
    const interval = setInterval(async () => {
      await this.fetchAndProcessBallUpdates(matchId);
    }, intervalMs);
    
    // Store in map
    this.matchPollingMap.set(matchId, { 
      interval, 
      lastBallId: 0,
      lastTimestamp: Date.now() 
    });
  }
  
  /**
   * Stop polling for a specific match
   * @param matchId Match ID
   */
  public stopPolling(matchId: string): void {
    const polling = this.matchPollingMap.get(matchId);
    if (polling) {
      clearInterval(polling.interval);
      this.matchPollingMap.delete(matchId);
      console.log(`Stopped ball-by-ball polling for match ${matchId}`);
    }
  }
  
  /**
   * Check if polling is active for a specific match
   * @param matchId Match ID
   */
  public isPolling(matchId: string): boolean {
    return this.matchPollingMap.has(matchId);
  }
  
  /**
   * Fetch and process ball updates for a match
   * @param matchId Match ID
   */
  private async fetchAndProcessBallUpdates(matchId: string): Promise<void> {
    try {
      // Get the polling data
      const pollingData = this.matchPollingMap.get(matchId);
      if (!pollingData) return;
      
      // Fetch ball data from SportMonks
      const response = await sportMonksCricket.getFixtureWithBalls(matchId);
      
      if (!response.data || !response.data.balls || !Array.isArray(response.data.balls.data)) {
        console.log(`No ball data available for match ${matchId}`);
        return;
      }
      
      // Get balls data from response
      const balls = response.data.balls.data;
      
      // Sort balls by score.id (which should represent the sequence)
      balls.sort((a: any, b: any) => a.id - b.id);
      
      // Process new balls (those with id greater than lastBallId)
      const newBalls = balls.filter((ball: any) => ball.id > pollingData.lastBallId);
      
      if (newBalls.length === 0) {
        console.log(`No new balls for match ${matchId}`);
        return;
      }
      
      console.log(`Processing ${newBalls.length} new balls for match ${matchId}`);
      
      // Process each new ball
      for (const ball of newBalls) {
        // Skip if we've already processed this ball
        if (this.ballCache.has(ball.id)) continue;
        
        // Convert SportMonks ball to our BallEvent format
        const ballEvent = this.convertSportMonksBallToBallEvent(ball, matchId);
        
        // Cache the ball
        this.ballCache.set(ball.id, ballEvent);
        
        // Update lastBallId
        if (ball.id > pollingData.lastBallId) {
          pollingData.lastBallId = ball.id;
          pollingData.lastTimestamp = ballEvent.timestamp;
        }
        
        // Emit ball event
        this.emit('ball', ballEvent);
        
        // Send through WebSocket
        webSocketService.sendBallUpdate(matchId, ballEvent);
        
        console.log(`Processed ball update for match ${matchId}: over ${ballEvent.over}.${ballEvent.ball}`);
      }
    } catch (error) {
      console.error(`Error fetching ball updates for match ${matchId}:`, error);
    }
  }
  
  /**
   * Convert SportMonks ball data to our BallEvent format
   */
  private convertSportMonksBallToBallEvent(sportMonksBall: any, matchId: string): BallEvent {
    // Extract data from SportMonks ball object
    const runs = sportMonksBall.score || 0;
    const isWicket = sportMonksBall.is_wicket || false;
    const isBoundary = runs === 4;
    const isSix = runs === 6;
    const timestamp = new Date(sportMonksBall.updated_at || sportMonksBall.created_at).getTime();
    
    // Parse over and ball number
    let over = 0;
    let ballInOver = 0;
    
    if (sportMonksBall.ball && typeof sportMonksBall.ball === 'string') {
      const ballParts = sportMonksBall.ball.split('.');
      if (ballParts.length === 2) {
        over = parseInt(ballParts[0], 10);
        ballInOver = parseInt(ballParts[1], 10);
      }
    }
    
    // Generate commentary based on ball data
    let commentary = sportMonksBall.note || '';
    
    if (!commentary) {
      if (isWicket) {
        commentary = `WICKET! ${sportMonksBall.bowler?.name || 'Bowler'} gets ${sportMonksBall.batsman?.name || 'Batsman'} out!`;
      } else if (isSix) {
        commentary = `SIX! ${sportMonksBall.batsman?.name || 'Batsman'} hits a magnificent six!`;
      } else if (isBoundary) {
        commentary = `FOUR! Nice shot by ${sportMonksBall.batsman?.name || 'Batsman'}.`;
      } else if (runs > 0) {
        commentary = `${runs} run${runs > 1 ? 's' : ''} taken by ${sportMonksBall.batsman?.name || 'Batsman'}.`;
      } else {
        commentary = 'No run.';
      }
    }
    
    // Create ball event
    return {
      id: sportMonksBall.id,
      matchId,
      over,
      ball: ballInOver,
      bowler: sportMonksBall.bowler?.name || 'Unknown Bowler',
      batsman: sportMonksBall.batsman?.name || 'Unknown Batsman',
      runs,
      extras: sportMonksBall.extras || 0,
      isWicket,
      wicketType: isWicket ? (sportMonksBall.wicket_type || 'unknown') : undefined,
      commentary,
      timestamp,
      isBoundary,
      isSix
    };
  }
  
  /**
   * Get recent ball events for a match (from cache or API)
   * @param matchId Match ID
   * @param count Number of recent balls to fetch
   */
  public async getRecentBalls(matchId: string, count: number = 10): Promise<BallEvent[]> {
    try {
      // Try to get from API first
      const response = await sportMonksCricket.getFixtureWithBalls(matchId);
      
      if (response.data && response.data.balls && Array.isArray(response.data.balls.data)) {
        // Get balls data from response
        const balls = response.data.balls.data;
        
        // Sort balls by id (which should represent the sequence)
        balls.sort((a: any, b: any) => b.id - a.id); // Descending order for most recent first
        
        // Take the requested number of balls
        const recentBalls = balls.slice(0, count);
        
        // Convert to our format
        const ballEvents = recentBalls.map((ball: any) => {
          // Check if we already have this ball in cache
          if (this.ballCache.has(ball.id)) {
            return this.ballCache.get(ball.id)!;
          }
          
          // Otherwise convert and cache
          const ballEvent = this.convertSportMonksBallToBallEvent(ball, matchId);
          this.ballCache.set(ball.id, ballEvent);
          return ballEvent;
        });
        
        return ballEvents;
      }
      
      // If no data from API, return empty array
      return [];
    } catch (error) {
      console.error(`Error fetching recent balls for match ${matchId}:`, error);
      
      // Fall back to mock data if API fails
      if (this.matchPollingMap.has(matchId)) {
        return this.generateMockBalls(matchId, count);
      }
      
      return [];
    }
  }
  
  /**
   * Generate mock ball events (for development or when API fails)
   */
  private generateMockBalls(matchId: string, count: number): BallEvent[] {
    const mockBalls: BallEvent[] = [];
    const pollingData = this.matchPollingMap.get(matchId);
    const baseTimestamp = pollingData?.lastTimestamp || Date.now();
    
    for (let i = 0; i < count; i++) {
      // Random data
      const runs = Math.floor(Math.random() * 7); // 0-6 runs
      const isWicket = Math.random() < 0.05; // 5% chance of wicket
      const isBoundary = runs === 4;
      const isSix = runs === 6;
      const over = Math.floor(Math.random() * 20);
      const ball = 1 + Math.floor(Math.random() * 6);
      
      // Pick random commentary
      let commentary = '';
      if (isWicket) {
        const wicketTypes = ['caught', 'bowled', 'lbw', 'run out', 'stumped'];
        const wicketType = wicketTypes[Math.floor(Math.random() * wicketTypes.length)];
        commentary = `WICKET! ${wicketType}`;
      } else if (isSix) {
        commentary = "SIX! That's gone all the way over the boundary!";
      } else if (isBoundary) {
        commentary = 'FOUR! Nice shot through the covers.';
      } else if (runs > 0) {
        commentary = `${runs} run${runs > 1 ? 's' : ''} taken with good running.`;
      } else {
        commentary = 'No run. Good defensive shot.';
      }
      
      // Create ball event with mock ID
      mockBalls.push({
        id: -1000 - i, // Negative IDs to distinguish from real data
        matchId,
        over,
        ball,
        bowler: 'Bowler Name',
        batsman: 'Batsman Name',
        runs,
        extras: 0,
        isWicket,
        wicketType: isWicket ? 'caught' : undefined,
        commentary,
        timestamp: baseTimestamp - (i * 30000), // 30 seconds between balls
        isBoundary,
        isSix
      });
    }
    
    return mockBalls;
  }
}

// Export singleton instance
export const ballCommentaryService = BallCommentaryService.getInstance(); 