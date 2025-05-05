import axios from 'axios';

/**
 * Response structure for cricket API data
 */
export interface CricApiResponse {
  success: boolean;
  data: any;
  error?: string;
}

/**
 * Service for fetching cricket data from CricAPI
 */
export class CricApiService {
  private static instance: CricApiService;
  private apiKey: string;
  private baseUrl: string;
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // The API key is provided
    this.apiKey = '20c8e30e-98b5-4712-bca5-f611b1917e28';
    this.baseUrl = 'https://api.cricapi.com/v1';
  }
  
  /**
   * Get the singleton instance of CricApiService
   */
  public static getInstance(): CricApiService {
    if (!CricApiService.instance) {
      CricApiService.instance = new CricApiService();
    }
    return CricApiService.instance;
  }
  
  /**
   * Fetch current cricket matches
   * @param offset Optional offset for pagination
   */
  public async getCurrentMatches(offset: number = 0): Promise<CricApiResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/currentMatches`, {
        params: {
          apikey: this.apiKey,
          offset: offset
        }
      });
      
      return {
        success: response.data.status === 'success',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Error fetching current matches:', error.message);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }
  
  /**
   * Fetch real-time cricket scores
   */
  public async getRealTimeScores(): Promise<CricApiResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/cricScore`, {
        params: {
          apikey: this.apiKey
        }
      });
      
      return {
        success: response.data.status === 'success',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Error fetching real-time scores:', error.message);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }
  
  /**
   * Fetch match scorecard for a specific match
   * @param matchId The ID of the match
   */
  public async getMatchScorecard(matchId: string): Promise<CricApiResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/match_scorecard`, {
        params: {
          apikey: this.apiKey,
          id: matchId
        }
      });
      
      return {
        success: response.data.status === 'success',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Error fetching match scorecard:', error.message);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }
  
  /**
   * Fetch match information for a specific match
   * @param matchId The ID of the match
   */
  public async getMatchInfo(matchId: string): Promise<CricApiResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/match_info`, {
        params: {
          apikey: this.apiKey,
          id: matchId
        }
      });
      
      return {
        success: response.data.status === 'success',
        data: response.data.data
      };
    } catch (error: any) {
      console.error('Error fetching match info:', error.message);
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }
  
  /**
   * Transform cricket API data to our standard format
   * @param cricApiData Data from CricAPI
   */
  public transformToStandardFormat(cricApiData: any): any {
    if (!cricApiData) return null;
    
    // For match data
    if (cricApiData.id && cricApiData.teams) {
      const homeTeam = cricApiData.teams[0];
      const awayTeam = cricApiData.teams[1];
      
      return {
        gameId: cricApiData.id,
        sport: 'cricket',
        status: cricApiData.status,
        matchType: cricApiData.matchType,
        venue: cricApiData.venue,
        date: cricApiData.date,
        homeTeam: {
          teamId: homeTeam,
          name: homeTeam,
          abbreviation: homeTeam.substring(0, 3).toUpperCase(),
        },
        awayTeam: {
          teamId: awayTeam,
          name: awayTeam,
          abbreviation: awayTeam.substring(0, 3).toUpperCase(),
        },
        scores: cricApiData.score ? {
          homeScore: cricApiData.score[0]?.r || 0,
          awayScore: cricApiData.score[1]?.r || 0,
          homeWickets: cricApiData.score[0]?.w || 0,
          awayWickets: cricApiData.score[1]?.w || 0,
          homeOvers: cricApiData.score[0]?.o || 0,
          awayOvers: cricApiData.score[1]?.o || 0,
        } : undefined,
      };
    }
    
    // For scorecard data
    if (cricApiData.scorecard) {
      return cricApiData;
    }
    
    // For info data
    if (cricApiData.info) {
      return cricApiData;
    }
    
    return cricApiData;
  }
}

// Export singleton instance
export const cricApi = CricApiService.getInstance(); 