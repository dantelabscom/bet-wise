import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { sentimentService, SentimentLevel } from '@/lib/services/liquidity/sentiment-service';
import { 
  League, 
  Season, 
  Standing, 
  Team 
} from '@/lib/services/api/sportmonks-service';

interface CricketDataState {
  leagues: League[];
  standings: Standing[];
  fixtures: any[];
  isLoading: boolean;
  error: string | null;
}

export function useCricketData() {
  const [state, setState] = useState<CricketDataState>({
    leagues: [],
    standings: [],
    fixtures: [],
    isLoading: false,
    error: null
  });

  // Fetch leagues
  const fetchLeagues = useCallback(async (includes: string[] = []) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await axios.get('/api/cricket/leagues', {
        params: {
          include: includes.join(',')
        }
      });
      
      if (response.data.success) {
        setState(prev => ({ 
          ...prev, 
          leagues: response.data.data.data || [],
          isLoading: false
        }));
        return response.data.data.data || [];
      }
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: 'Failed to fetch leagues'
      }));
      return [];
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: err.message || 'Failed to fetch leagues'
      }));
      console.error('Error fetching leagues:', err);
      return [];
    }
  }, []);

  // Fetch standings by season
  const fetchStandingsBySeason = useCallback(async (seasonId: number, includes: string[] = []) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await axios.get('/api/cricket/standings', {
        params: {
          seasonId,
          include: includes.join(',')
        }
      });
      
      if (response.data.success) {
        const standings = response.data.data.data?.[0]?.standings || [];
        
        setState(prev => ({ 
          ...prev, 
          standings,
          isLoading: false
        }));
        
        return standings;
      }
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: 'Failed to fetch standings'
      }));
      return [];
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: err.message || 'Failed to fetch standings'
      }));
      console.error('Error fetching standings:', err);
      return [];
    }
  }, []);

  // Fetch standings by stage
  const fetchStandingsByStage = useCallback(async (stageId: number, includes: string[] = []) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await axios.get('/api/cricket/standings', {
        params: {
          stageId,
          include: includes.join(',')
        }
      });
      
      if (response.data.success) {
        const standings = response.data.data.data?.[0]?.standings || [];
        
        setState(prev => ({ 
          ...prev, 
          standings,
          isLoading: false
        }));
        
        return standings;
      }
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: 'Failed to fetch standings'
      }));
      return [];
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: err.message || 'Failed to fetch standings'
      }));
      console.error('Error fetching standings:', err);
      return [];
    }
  }, []);

  // Fetch fixtures by season
  const fetchFixturesBySeason = useCallback(async (seasonId: number, includes: string[] = []) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await axios.get('/api/cricket/fixtures', {
        params: {
          seasonId,
          include: includes.join(',')
        }
      });
      
      if (response.data.success) {
        const fixtures = response.data.data.data || [];
        
        setState(prev => ({ 
          ...prev, 
          fixtures,
          isLoading: false
        }));
        
        return fixtures;
      }
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: 'Failed to fetch fixtures'
      }));
      return [];
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: err.message || 'Failed to fetch fixtures'
      }));
      console.error('Error fetching fixtures:', err);
      return [];
    }
  }, []);

  // Create a market based on cricket standings
  const createMarketFromStandings = useCallback(async (
    seasonId: number,
    teamId1: number,
    teamId2: number
  ) => {
    try {
      // Fetch standings to get team data
      const standings = await fetchStandingsBySeason(seasonId);
      
      if (!standings || standings.length === 0) {
        throw new Error('No standings data available');
      }
      
      // Find the teams
      const team1 = standings.find((s: { team: { id: number; }; }) => s.team.id === teamId1)?.team;
      const team2 = standings.find((s: { team: { id: number; }; }) => s.team.id === teamId2)?.team;
      
      if (!team1 || !team2) {
        throw new Error('Teams not found in standings');
      }
      
      // Calculate team strengths based on standings
      const team1Position = standings.find((s: { team: { id: number; }; }) => s.team.id === teamId1)?.position || 0;
      const team2Position = standings.find((s: { team: { id: number; }; }) => s.team.id === teamId2)?.position || 0;
      
      // Determine sentiment based on team positions
      // Lower position number = better team
      let initialSentiment: SentimentLevel;
      let homeTeam: Team;
      let awayTeam: Team;
      
      if (team1Position < team2Position) {
        // Team 1 is stronger
        initialSentiment = SentimentLevel.POSITIVE;
        homeTeam = team1;
        awayTeam = team2;
      } else if (team2Position < team1Position) {
        // Team 2 is stronger
        initialSentiment = SentimentLevel.NEGATIVE;
        homeTeam = team2;
        awayTeam = team1;
      } else {
        // Teams are equal
        initialSentiment = SentimentLevel.NEUTRAL;
        homeTeam = team1;
        awayTeam = team2;
      }
      
      // Create market using sentiment service
      const marketId = sentimentService.createPredefinedMarket('cricket', {
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeAdvantage: true
      });
      
      return {
        marketId,
        homeTeam,
        awayTeam,
        initialSentiment
      };
    } catch (err: any) {
      console.error('Error creating market from standings:', err);
      throw err;
    }
  }, [fetchStandingsBySeason]);

  // Initialize with leagues
  useEffect(() => {
    fetchLeagues();
  }, [fetchLeagues]);

  return {
    ...state,
    fetchLeagues,
    fetchStandingsBySeason,
    fetchStandingsByStage,
    fetchFixturesBySeason,
    createMarketFromStandings
  };
} 