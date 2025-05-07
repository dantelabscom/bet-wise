import axios from 'axios';

// SportMonks API configuration
const SPORTMONKS_API_URL = 'https://cricket.sportmonks.com/api/v2.0';
// Hardcoded API token
const API_TOKEN = 'yGDNxh5OIrBGjZDHyXzcthLleAtAc8wePujoqnosACmhNiFBcKrwEBxnnoVD';

// Define types for SportMonks API responses
export interface Team {
  id: number;
  name: string;
  code: string | null;
  image_path: string;
  country_id: number;
  national_team: boolean;
  position?: number | null;
  points?: number | null;
  matches_played?: number | null;
  matches_won?: number | null;
  matches_lost?: number | null;
  matches_drawn?: number | null;
  net_run_rate?: number | null;
  recent_form?: string[] | null;
}

export interface Season {
  id: number;
  name: string;
  league_id: number;
  is_current: boolean;
  standings?: Standing[];
}

export interface Stage {
  id: number;
  name: string;
  season_id: number;
  standings?: Standing[];
}

export interface League {
  id: number;
  name: string;
  code: string | null;
  image_path: string;
  type: string;
  country_id: number;
}

export interface Standing {
  position: number;
  team: Team;
  points: number;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  matches_drawn: number;
  net_run_rate: number | null;
  recent_form: string[] | null;
}

export interface StandingsResponse {
  data: {
    id: number;
    name: string;
    type: string;
    standings: Standing[];
    league?: League;
    season?: Season;
    stage?: Stage;
  }[];
}

// SportMonks API service
class SportMonksService {
  private static instance: SportMonksService;
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  // Get singleton instance
  public static getInstance(): SportMonksService {
    if (!SportMonksService.instance) {
      SportMonksService.instance = new SportMonksService();
    }
    return SportMonksService.instance;
  }
  
  // Get standings by season ID
  public async getStandingsBySeason(
    seasonId: number,
    includes: string[] = []
  ): Promise<StandingsResponse> {
    try {
      if (!API_TOKEN) {
        throw new Error('SportMonks API token not configured');
      }
      
      const includeParam = includes.length > 0 ? `&include=${includes.join(',')}` : '';
      
      const response = await axios.get(
        `${SPORTMONKS_API_URL}/standings/season/${seasonId}?api_token=${API_TOKEN}${includeParam}`
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching standings by season:', error);
      throw error;
    }
  }
  
  // Get standings by stage ID
  public async getStandingsByStage(
    stageId: number,
    includes: string[] = []
  ): Promise<StandingsResponse> {
    try {
      if (!API_TOKEN) {
        throw new Error('SportMonks API token not configured');
      }
      
      const includeParam = includes.length > 0 ? `&include=${includes.join(',')}` : '';
      
      const response = await axios.get(
        `${SPORTMONKS_API_URL}/standings/stage/${stageId}?api_token=${API_TOKEN}${includeParam}`
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching standings by stage:', error);
      throw error;
    }
  }
  
  // Get leagues
  public async getLeagues(
    includes: string[] = []
  ): Promise<any> {
    try {
      if (!API_TOKEN) {
        throw new Error('SportMonks API token not configured');
      }
      
      const includeParam = includes.length > 0 ? `&include=${includes.join(',')}` : '';
      
      const response = await axios.get(
        `${SPORTMONKS_API_URL}/leagues?api_token=${API_TOKEN}${includeParam}`
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching leagues:', error);
      throw error;
    }
  }
  
  // Get seasons
  public async getSeasons(
    includes: string[] = []
  ): Promise<any> {
    try {
      if (!API_TOKEN) {
        throw new Error('SportMonks API token not configured');
      }
      
      const includeParam = includes.length > 0 ? `&include=${includes.join(',')}` : '';
      
      const response = await axios.get(
        `${SPORTMONKS_API_URL}/seasons?api_token=${API_TOKEN}${includeParam}`
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching seasons:', error);
      throw error;
    }
  }
  
  // Get fixtures by season ID
  public async getFixturesBySeason(
    seasonId: number,
    includes: string[] = []
  ): Promise<any> {
    try {
      if (!API_TOKEN) {
        throw new Error('SportMonks API token not configured');
      }
      
      const includeParam = includes.length > 0 ? `&include=${includes.join(',')}` : '';
      
      const response = await axios.get(
        `${SPORTMONKS_API_URL}/fixtures/season/${seasonId}?api_token=${API_TOKEN}${includeParam}`
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching fixtures by season:', error);
      throw error;
    }
  }
  
  // Get current seasons
  public async getCurrentSeasons(
    includes: string[] = []
  ): Promise<any> {
    try {
      const includeParam = includes.length > 0 ? `&include=${includes.join(',')}` : '';
      
      console.log(`Making request to: ${SPORTMONKS_API_URL}/seasons?filter[is_current]=true&api_token=${API_TOKEN.substring(0, 4)}...${includeParam}`);
      
      const response = await axios.get(
        `${SPORTMONKS_API_URL}/seasons?filter[is_current]=true&api_token=${API_TOKEN}${includeParam}`
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Error fetching current seasons:', error);
      
      // Add detailed error information
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('API Error Response:', {
          data: error.response.data,
          status: error.response.status,
          headers: error.response.headers
        });
      }
      
      throw error;
    }
  }
}

// Export singleton instance
export const sportMonksService = SportMonksService.getInstance(); 