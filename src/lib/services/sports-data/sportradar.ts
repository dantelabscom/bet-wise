import axios from 'axios';

/**
 * Different types of sports data that can be fetched from SportRadar
 */
export type SportDataType = 
  | 'upcoming_games' 
  | 'live_game_data' 
  | 'historical_data' 
  | 'player_stats' 
  | 'team_rankings';

/**
 * Response structure for sports data
 */
export interface SportDataResponse {
  success: boolean;
  data: any;
  error?: string;
}

/**
 * Game status types
 */
export type GameStatus = 'scheduled' | 'in_progress' | 'halftime' | 'complete' | 'cancelled';

/**
 * Game data structure
 */
export interface GameData {
  gameId: string;
  leagueId: string;
  sport: string;
  homeTeam: TeamData;
  awayTeam: TeamData;
  startTime: string;
  status: GameStatus;
  venue: string;
  weather?: WeatherData;
  scores?: {
    homeScore: number;
    awayScore: number;
    period: number;
    timeRemaining?: string;
  };
}

/**
 * Team data structure
 */
export interface TeamData {
  teamId: string;
  name: string;
  abbreviation: string;
  ranking?: number;
  recentForm?: string[];
}

/**
 * Weather data structure
 */
export interface WeatherData {
  condition: string;
  temperature: number;
  windSpeed: number;
  precipitation: number;
}

/**
 * Player statistics
 */
export interface PlayerStats {
  playerId: string;
  name: string;
  teamId: string;
  position: string;
  stats: Record<string, number>;
}

/**
 * Service for fetching sports data from SportRadar API
 */
export class SportRadarService {
  private static instance: SportRadarService;
  private apiKey: string;
  private baseUrl: string;
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Read API key from environment variables
    this.apiKey = process.env.SPORTRADAR_API_KEY || '';
    if (!this.apiKey) {
      console.error('SPORTRADAR_API_KEY is not set in environment variables');
    }
    this.baseUrl = 'https://api.sportradar.com/v4';
  }
  
  /**
   * Get the singleton instance of SportRadarService
   */
  public static getInstance(): SportRadarService {
    if (!SportRadarService.instance) {
      SportRadarService.instance = new SportRadarService();
    }
    return SportRadarService.instance;
  }
  
  /**
   * Fetch upcoming games for a specific sport and league
   * @param sport The sport to fetch games for (e.g., 'nba', 'nfl', 'soccer', 'cricket')
   * @param leagueId Optional league ID to filter by
   * @param daysAhead Number of days ahead to fetch games for (default: 7)
   */
  public async getUpcomingGames(
    sport: string,
    leagueId?: string,
    daysAhead: number = 7
  ): Promise<SportDataResponse> {
    try {
      // Different sports have different endpoint structures
      const endpoint = this.getSportEndpoint(sport, 'schedule');
      const params = {
        api_key: this.apiKey,
        ...this.getSportSpecificParams(sport, 'schedule', { daysAhead, leagueId }),
      };
      
      const response = await axios.get(`${this.baseUrl}${endpoint}`, { params });
      
      // Transform the data to our standard format
      const games = this.transformGamesResponse(response.data, sport);
      
      return {
        success: true,
        data: games,
      };
    } catch (error: any) {
      console.error('Error fetching upcoming games:', error.message);
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  }
  
  /**
   * Fetch live game data for a specific game
   * @param gameId The ID of the game to fetch data for
   * @param sport The sport the game belongs to
   */
  public async getLiveGameData(gameId: string, sport: string): Promise<SportDataResponse> {
    try {
      const endpoint = this.getSportEndpoint(sport, 'game_summary', gameId);
      const params = {
        api_key: this.apiKey,
        ...this.getSportSpecificParams(sport, 'game_summary'),
      };
      
      const response = await axios.get(`${this.baseUrl}${endpoint}`, { params });
      
      // Transform the data to our standard format
      const gameData = this.transformLiveGameData(response.data, sport);
      
      return {
        success: true,
        data: gameData,
      };
    } catch (error: any) {
      console.error('Error fetching live game data:', error.message);
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  }
  
  /**
   * Fetch historical data for a specific game
   * @param gameId The ID of the game to fetch data for
   * @param sport The sport the game belongs to
   */
  public async getHistoricalGameData(gameId: string, sport: string): Promise<SportDataResponse> {
    try {
      const endpoint = this.getSportEndpoint(sport, 'game_summary', gameId);
      const params = {
        api_key: this.apiKey,
        ...this.getSportSpecificParams(sport, 'game_summary'),
      };
      
      const response = await axios.get(`${this.baseUrl}${endpoint}`, { params });
      
      // Transform the data to our standard format
      const gameData = this.transformGameData(response.data, sport);
      
      return {
        success: true,
        data: gameData,
      };
    } catch (error: any) {
      console.error('Error fetching historical game data:', error.message);
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  }
  
  /**
   * Fetch player statistics for a specific team or game
   * @param identifier Team ID or game ID to fetch player stats for
   * @param sport The sport
   * @param type Whether to fetch by team or game
   */
  public async getPlayerStats(
    identifier: string,
    sport: string,
    type: 'team' | 'game' = 'team'
  ): Promise<SportDataResponse> {
    try {
      const endpoint = this.getSportEndpoint(
        sport, 
        type === 'team' ? 'team_player_stats' : 'game_player_stats',
        identifier
      );
      
      const params = {
        api_key: this.apiKey,
        ...this.getSportSpecificParams(sport, type === 'team' ? 'team_player_stats' : 'game_player_stats'),
      };
      
      const response = await axios.get(`${this.baseUrl}${endpoint}`, { params });
      
      // Transform the data to our standard format
      const playerStats = this.transformPlayerStats(
        type === 'team' ? response.data.players : response.data.statistics.players,
        sport
      );
      
      return {
        success: true,
        data: playerStats,
      };
    } catch (error: any) {
      console.error('Error fetching player stats:', error.message);
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  }
  
  /**
   * Fetch team rankings for a specific sport and league
   * @param sport The sport
   * @param leagueId The league ID
   */
  public async getTeamRankings(
    sport: string,
    leagueId: string
  ): Promise<SportDataResponse> {
    try {
      const endpoint = this.getSportEndpoint(sport, 'standings', leagueId);
      const params = {
        api_key: this.apiKey,
        ...this.getSportSpecificParams(sport, 'standings'),
      };
      
      const response = await axios.get(`${this.baseUrl}${endpoint}`, { params });
      
      // Transform the data to our standard format
      const rankings = this.transformTeamRankings(
        sport === 'cricket' ? response.data.standings : response.data.standings,
        sport
      );
      
      return {
        success: true,
        data: rankings,
      };
    } catch (error: any) {
      console.error('Error fetching team rankings:', error.message);
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  }
  
  /**
   * Fetch real-time match statistics for a specific game
   * @param gameId The ID of the game
   * @param sport The sport
   */
  public async getMatchStats(gameId: string, sport: string): Promise<SportDataResponse> {
    try {
      const endpoint = this.getSportEndpoint(sport, 'game_statistics', gameId);
      const params = {
        api_key: this.apiKey,
        ...this.getSportSpecificParams(sport, 'game_statistics'),
      };
      
      const response = await axios.get(`${this.baseUrl}${endpoint}`, { params });
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('Error fetching match statistics:', error.message);
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  }
  
  /**
   * Fetch betting market information for a game
   * @param gameId The ID of the game
   * @param sport The sport
   */
  public async getBettingMarkets(gameId: string, sport: string): Promise<SportDataResponse> {
    try {
      const endpoint = this.getSportEndpoint(sport, 'betting_markets', gameId);
      const params = {
        api_key: this.apiKey,
        ...this.getSportSpecificParams(sport, 'betting_markets'),
      };
      
      const response = await axios.get(`${this.baseUrl}${endpoint}`, { params });
      
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      console.error('Error fetching betting markets:', error.message);
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }
  }
  
  /**
   * Get the appropriate endpoint for a sport and action
   * @param sport The sport
   * @param action The action to perform
   * @param id Optional ID for game or team specific endpoints
   */
  private getSportEndpoint(sport: string, action: string, id?: string): string {
    const sportPrefix = this.getSportPrefix(sport);
    
    switch (action) {
      case 'schedule':
        return `/${sportPrefix}/schedule`;
      case 'game_summary':
        return `/${sportPrefix}/games/${id}/summary`;
      case 'game_statistics':
        return `/${sportPrefix}/games/${id}/statistics`;
      case 'game_player_stats':
        return `/${sportPrefix}/games/${id}/boxscore`;
      case 'team_player_stats':
        return `/${sportPrefix}/teams/${id}/profile`;
      case 'standings':
        return `/${sportPrefix}/tournaments/${id}/standings`;
      case 'betting_markets':
        return `/${sportPrefix}/games/${id}/markets`;
      default:
        return `/${sportPrefix}/${action}`;
    }
  }
  
  /**
   * Get the API prefix for a sport
   * @param sport The sport
   */
  private getSportPrefix(sport: string): string {
    switch (sport.toLowerCase()) {
      case 'nba':
        return 'basketball/nba';
      case 'nfl':
        return 'football/nfl';
      case 'mlb':
        return 'baseball/mlb';
      case 'soccer':
        return 'soccer';
      case 'cricket':
        return 'cricket';
      default:
        return sport;
    }
  }
  
  /**
   * Get sport-specific parameters for API requests
   * @param sport The sport
   * @param action The action being performed
   * @param options Additional options
   */
  private getSportSpecificParams(sport: string, action: string, options: any = {}): Record<string, any> {
    const { daysAhead, leagueId } = options;
    const params: Record<string, any> = {};
    
    // Add sport-specific parameters
    switch (sport.toLowerCase()) {
      case 'cricket':
        if (action === 'schedule') {
          params.days = daysAhead;
          if (leagueId) params.tournament_id = leagueId;
        }
        break;
        
      default:
        if (action === 'schedule') {
          params.days_ahead = daysAhead;
          if (leagueId) params.league_id = leagueId;
        }
        break;
    }
    
    return params;
  }
  
  /**
   * Transform games response data based on sport
   * @param responseData API response data
   * @param sport The sport
   */
  private transformGamesResponse(responseData: any, sport: string): GameData[] {
    switch (sport.toLowerCase()) {
      case 'cricket':
        return this.transformCricketGames(responseData.sport_events);
        
      default:
        return responseData.games.map((game: any) => this.transformGameData(game, sport));
    }
  }
  
  /**
   * Transform cricket games data
   * @param games Cricket games data
   */
  private transformCricketGames(games: any[]): GameData[] {
    return games.map(game => ({
      gameId: game.id,
      leagueId: game.tournament.id,
      sport: 'cricket',
      homeTeam: {
        teamId: game.competitors[0].id,
        name: game.competitors[0].name,
        abbreviation: game.competitors[0].abbreviation || game.competitors[0].name.substring(0, 3).toUpperCase(),
      },
      awayTeam: {
        teamId: game.competitors[1].id,
        name: game.competitors[1].name,
        abbreviation: game.competitors[1].abbreviation || game.competitors[1].name.substring(0, 3).toUpperCase(),
      },
      startTime: game.scheduled,
      status: this.mapGameStatus(game.status),
      venue: game.venue?.name || 'TBA',
      scores: game.score ? {
        homeScore: game.score.home.runs || 0,
        awayScore: game.score.away.runs || 0,
        period: game.score.current_inning || 1,
        timeRemaining: game.clock || '',
      } : undefined,
    }));
  }
  
  /**
   * Transform raw game data to our standard format
   * @param rawData Raw game data from API
   * @param sport The sport
   */
  private transformGameData(rawData: any, sport: string): GameData {
    // Different sports have different data structures
    switch (sport.toLowerCase()) {
      case 'cricket':
        return {
          gameId: rawData.id,
          leagueId: rawData.tournament.id,
          sport: sport,
          homeTeam: {
            teamId: rawData.competitors[0].id,
            name: rawData.competitors[0].name,
            abbreviation: rawData.competitors[0].abbreviation || rawData.competitors[0].name.substring(0, 3).toUpperCase(),
          },
          awayTeam: {
            teamId: rawData.competitors[1].id,
            name: rawData.competitors[1].name,
            abbreviation: rawData.competitors[1].abbreviation || rawData.competitors[1].name.substring(0, 3).toUpperCase(),
          },
          startTime: rawData.scheduled,
          status: this.mapGameStatus(rawData.status),
          venue: rawData.venue?.name || 'TBA',
          scores: rawData.score ? {
            homeScore: rawData.score.home.runs || 0,
            awayScore: rawData.score.away.runs || 0,
            period: rawData.score.current_inning || 1,
            timeRemaining: rawData.clock || '',
          } : undefined,
        };
      
      default:
        return {
          gameId: rawData.id,
          leagueId: rawData.league_id,
          sport: sport,
          homeTeam: {
            teamId: rawData.home_team.id,
            name: rawData.home_team.name,
            abbreviation: rawData.home_team.abbreviation,
          },
          awayTeam: {
            teamId: rawData.away_team.id,
            name: rawData.away_team.name,
            abbreviation: rawData.away_team.abbreviation,
          },
          startTime: rawData.scheduled,
          status: this.mapGameStatus(rawData.status),
          venue: rawData.venue?.name || 'TBA',
          scores: rawData.home_points !== undefined ? {
            homeScore: rawData.home_points,
            awayScore: rawData.away_points,
            period: rawData.period,
            timeRemaining: rawData.time_remaining,
          } : undefined,
        };
    }
  }
  
  /**
   * Transform live game data to our standard format
   * @param rawData Raw live game data from API
   * @param sport The sport
   */
  private transformLiveGameData(rawData: any, sport: string): any {
    // Base game data
    const baseData = this.transformGameData(rawData, sport);
    
    // Add sport-specific live game data
    switch (sport.toLowerCase()) {
      case 'cricket':
        return {
          ...baseData,
          inning: rawData.score?.current_inning,
          balls: rawData.score?.balls,
          striker: rawData.situation?.striker?.name,
          nonStriker: rawData.situation?.non_striker?.name,
          bowler: rawData.situation?.bowler?.name,
          runRate: rawData.statistics?.run_rate,
          requiredRunRate: rawData.statistics?.required_run_rate,
          momentum: this.calculateCricketMomentum(rawData),
        };
        
      default:
        return {
          ...baseData,
          clock: rawData.clock,
          period: rawData.period,
          possession: rawData.possession,
          lastPlay: rawData.last_play,
          momentum: this.calculateMomentum(rawData),
          scoring: rawData.scoring,
          statistics: rawData.statistics,
        };
    }
  }
  
  /**
   * Transform player statistics to our standard format
   * @param rawData Raw player stats data from API
   * @param sport The sport
   */
  private transformPlayerStats(rawData: any[], sport: string): PlayerStats[] {
    if (!rawData || !Array.isArray(rawData)) {
      return [];
    }
    
    // Different sports have different player statistics structures
    switch (sport.toLowerCase()) {
      case 'cricket':
        return rawData.map(player => ({
          playerId: player.id,
          name: player.name,
          teamId: player.team_id,
          position: player.position || 'Unknown',
          stats: {
            runs: player.statistics?.batting?.runs || 0,
            balls_faced: player.statistics?.batting?.balls_faced || 0,
            strike_rate: player.statistics?.batting?.strike_rate || 0,
            wickets: player.statistics?.bowling?.wickets || 0,
            economy_rate: player.statistics?.bowling?.economy_rate || 0,
            maidens: player.statistics?.bowling?.maidens || 0,
          },
        }));
        
      default:
        return rawData.map(player => ({
          playerId: player.id,
          name: `${player.first_name} ${player.last_name}`,
          teamId: player.team_id,
          position: player.position,
          stats: this.mapPlayerStats(player.statistics, sport),
        }));
    }
  }
  
  /**
   * Transform team rankings to our standard format
   * @param rawData Raw team rankings data from API
   * @param sport The sport
   */
  private transformTeamRankings(rawData: any[], sport: string): any[] {
    if (!rawData || !Array.isArray(rawData)) {
      return [];
    }
    
    // Different sports have different ranking structures
    switch (sport.toLowerCase()) {
      case 'cricket':
        return rawData.map(team => ({
          teamId: team.team.id,
          name: team.team.name,
          abbreviation: team.team.abbreviation || team.team.name.substring(0, 3).toUpperCase(),
          rank: team.rank,
          points: team.points,
          matches_played: team.played,
          matches_won: team.won,
          matches_lost: team.lost,
          matches_drawn: team.drawn,
          net_run_rate: team.net_run_rate,
        }));
        
      default:
        return rawData.map(team => ({
          teamId: team.team.id,
          name: team.team.name,
          abbreviation: team.team.abbreviation,
          rank: team.rank,
          wins: team.wins,
          losses: team.losses,
          winPercentage: team.win_percentage,
          streak: team.streak,
          leagueId: team.division?.id || team.conference?.id,
          leagueName: team.division?.name || team.conference?.name,
        }));
    }
  }
  
  /**
   * Map game status from API format to our format
   * @param status API status
   */
  private mapGameStatus(status: string): GameStatus {
    if (!status) return 'scheduled';
    
    switch (status.toLowerCase()) {
      case 'scheduled': 
      case 'created':
      case 'not_started':
        return 'scheduled';
      
      case 'inprogress':
      case 'in progress':
      case 'live':
      case 'in_play':
      case 'playing':
        return 'in_progress';
      
      case 'halftime':
      case 'break':
      case 'lunch':
      case 'tea':
      case 'innings_break':
        return 'halftime';
      
      case 'complete':
      case 'closed':
      case 'finished':
      case 'ended':
        return 'complete';
      
      case 'cancelled':
      case 'postponed':
      case 'abandoned':
      case 'delayed':
      case 'suspended':
        return 'cancelled';
      
      default:
        return 'scheduled';
    }
  }
  
  /**
   * Map player statistics based on sport
   * @param stats Raw player statistics from API
   * @param sport The sport
   */
  private mapPlayerStats(stats: any, sport: string): Record<string, number> {
    if (!stats) return {};
    
    // Different sports have different statistics
    switch (sport.toLowerCase()) {
      case 'nba':
        return {
          points: stats.points || 0,
          rebounds: stats.rebounds || 0,
          assists: stats.assists || 0,
          steals: stats.steals || 0,
          blocks: stats.blocks || 0,
          turnovers: stats.turnovers || 0,
          minutesPlayed: stats.minutes_played || 0,
        };
      
      case 'nfl':
        return {
          passingYards: stats.passing?.yards || 0,
          passingTouchdowns: stats.passing?.touchdowns || 0,
          rushingYards: stats.rushing?.yards || 0,
          rushingTouchdowns: stats.rushing?.touchdowns || 0,
          receivingYards: stats.receiving?.yards || 0,
          receivingTouchdowns: stats.receiving?.touchdowns || 0,
        };
      
      case 'soccer':
        return {
          goals: stats.goals || 0,
          assists: stats.assists || 0,
          shotsOnTarget: stats.shots_on_target || 0,
          saves: stats.saves || 0,
          yellowCards: stats.yellow_cards || 0,
          redCards: stats.red_cards || 0,
        };
      
      case 'cricket':
        return {
          runs: stats.batting?.runs || 0,
          wickets: stats.bowling?.wickets || 0,
          catches: stats.fielding?.catches || 0,
          strikeRate: stats.batting?.strike_rate || 0,
          economy: stats.bowling?.economy_rate || 0,
        };
      
      default:
        return stats || {};
    }
  }
  
  /**
   * Calculate momentum value based on recent game events
   * @param gameData Game data from API
   */
  private calculateMomentum(gameData: any): number {
    if (!gameData.scoring || !Array.isArray(gameData.scoring) || gameData.scoring.length === 0) {
      return 0;
    }
    
    // Get last 3 scoring events
    const recentScoring = gameData.scoring.slice(-3);
    
    // Calculate momentum based on recent scoring
    let momentumValue = 0;
    
    recentScoring.forEach((event: any, index: number) => {
      // More recent events have higher weight
      const weight = 0.5 * (index + 1);
      
      if (event.team_id === gameData.home_team.id) {
        momentumValue += weight;
      } else {
        momentumValue -= weight;
      }
    });
    
    // Normalize to [-1, 1]
    return Math.max(-1, Math.min(1, momentumValue / 3));
  }
  
  /**
   * Calculate cricket momentum based on current match situation
   * @param gameData Cricket game data from API
   */
  private calculateCricketMomentum(gameData: any): number {
    if (!gameData || !gameData.score) {
      return 0;
    }
    
    let momentumValue = 0;
    
    // Factors that affect momentum in cricket:
    // 1. Recent wickets (negative for batting team)
    // 2. Recent boundaries (positive for batting team)
    // 3. Run rate vs required run rate (if chasing)
    // 4. Wickets in hand
    
    // Recent events (wickets/boundaries)
    if (gameData.recent_events && Array.isArray(gameData.recent_events)) {
      const recentEvents = gameData.recent_events.slice(-5);
      
      recentEvents.forEach((event: any, index: number) => {
        const weight = 0.1 * (index + 1);
        
        if (event.type === 'boundary' || event.type === 'six') {
          // Positive momentum for batting team
          momentumValue += weight * (event.type === 'six' ? 1.5 : 1.0);
        } else if (event.type === 'wicket') {
          // Negative momentum for batting team
          momentumValue -= weight * 2;
        }
      });
    }
    
    // Run rate vs required run rate (if chasing)
    if (gameData.statistics && gameData.statistics.run_rate && gameData.statistics.required_run_rate) {
      const runRateDiff = gameData.statistics.run_rate - gameData.statistics.required_run_rate;
      momentumValue += runRateDiff * 0.3; // Scale factor
    }
    
    // Wickets in hand
    if (gameData.score) {
      const battingTeamIndex = gameData.score.innings % 2;
      const wicketsLost = battingTeamIndex === 0 
        ? gameData.score.home.wickets 
        : gameData.score.away.wickets;
      
      // More wickets in hand = more positive momentum
      const wicketsInHand = 10 - wicketsLost;
      momentumValue += (wicketsInHand / 10) * 0.5; // Scale factor
    }
    
    // Normalize to [-1, 1]
    return Math.max(-1, Math.min(1, momentumValue));
  }
}

// Export singleton instance
export const sportRadar = SportRadarService.getInstance();