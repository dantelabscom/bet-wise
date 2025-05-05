import Decimal from 'decimal.js';
import { MarketOption } from './market';

// Odds format types
export type OddsFormat = 'decimal' | 'american' | 'fractional' | 'implied';

// Market weight information for fair value calculations
export interface MarketWeights {
  liquidityWeight: number;  // Weight based on liquidity (0-1)
  recentVolumeWeight: number; // Weight based on recent volume (0-1)
  publicSentimentWeight: number; // Public betting sentiment (0-1)
  sharpMoneyWeight: number; // Professional money influence (0-1)
}

// Book balancing parameters
export interface BookParams {
  targetOverround: number; // Target profit margin (e.g., 1.05 for 5% margin)
  adjustmentCap: number;   // Maximum adjustment percentage
  sensitivity: number;     // How sensitive prices are to imbalance (0-1)
}

/**
 * Fair Odds Calculator - Determines true probability using statistical models
 * 
 * This class applies various statistical models and adjustments to calculate
 * "true odds" based on market data, order flow, and historical performance.
 */
export class OddsCalculator {
  // Market parameters
  private readonly defaultOverround = 1.05; // 5% margin
  private readonly defaultAdjustmentCap = 0.15; // 15% max adjustment
  private readonly defaultSensitivity = 0.7; // 70% sensitivity
  
  /**
   * Convert between different odds formats
   */
  static convertOdds(value: number | string, fromFormat: OddsFormat, toFormat: OddsFormat): number | string {
    const decimalValue = OddsCalculator.toDecimalOdds(value, fromFormat);
    
    if (toFormat === 'decimal') {
      return decimalValue;
    } else if (toFormat === 'american') {
      return OddsCalculator.decimalToAmerican(decimalValue);
    } else if (toFormat === 'fractional') {
      return OddsCalculator.decimalToFractional(decimalValue);
    } else if (toFormat === 'implied') {
      return OddsCalculator.decimalToImplied(decimalValue);
    }
    
    return decimalValue;
  }
  
  /**
   * Convert any format to decimal odds
   */
  static toDecimalOdds(value: number | string, fromFormat: OddsFormat): number {
    if (fromFormat === 'decimal') {
      return typeof value === 'string' ? parseFloat(value) : value;
    } else if (fromFormat === 'american') {
      return OddsCalculator.americanToDecimal(typeof value === 'string' ? parseInt(value) : value);
    } else if (fromFormat === 'fractional') {
      return OddsCalculator.fractionalToDecimal(value.toString());
    } else if (fromFormat === 'implied') {
      return OddsCalculator.impliedToDecimal(typeof value === 'string' ? parseFloat(value) : value);
    }
    
    return typeof value === 'string' ? parseFloat(value) : value;
  }
  
  /**
   * Convert decimal odds to American format
   */
  static decimalToAmerican(decimal: number): number {
    if (decimal >= 2.0) {
      // Underdog: (decimal - 1) * 100
      return Math.round((decimal - 1) * 100);
    } else {
      // Favorite: -100 / (decimal - 1)
      return Math.round(-100 / (decimal - 1));
    }
  }
  
  /**
   * Convert American odds to decimal format
   */
  static americanToDecimal(american: number): number {
    if (american > 0) {
      // Underdog: (american / 100) + 1
      return parseFloat((american / 100 + 1).toFixed(3));
    } else {
      // Favorite: (100 / -american) + 1
      return parseFloat((100 / -american + 1).toFixed(3));
    }
  }
  
  /**
   * Convert decimal odds to fractional format
   */
  static decimalToFractional(decimal: number): string {
    const decValue = new Decimal(decimal).minus(1);
    
    if (decValue.equals(0)) {
      return "0/1";
    }
    
    // Find the best fractional approximation
    const tolerance = new Decimal(0.0001);
    let numerator = 1;
    let denominator = Math.round(1 / decValue.toNumber());
    
    if (Math.abs(decValue.toNumber() - numerator / denominator) <= tolerance.toNumber()) {
      return `${numerator}/${denominator}`;
    }
    
    // Using continued fraction expansion for more complex fractions
    const maxIterations = 10;
    for (let i = 2; i <= 100; i++) {
      for (let j = 1; j < i; j++) {
        const fraction = new Decimal(j).div(i);
        if (decValue.minus(fraction).abs().lessThanOrEqualTo(tolerance)) {
          return `${j}/${i}`;
        }
      }
    }
    
    // For more complex fractions, use a simple ratio reducer
    let num = Math.round(decValue.toNumber() * 100);
    let den = 100;
    const gcd = OddsCalculator.greatestCommonDivisor(num, den);
    
    return `${num / gcd}/${den / gcd}`;
  }
  
  /**
   * Convert fractional odds to decimal format
   */
  static fractionalToDecimal(fractional: string): number {
    const parts = fractional.split('/');
    if (parts.length !== 2) {
      throw new Error('Invalid fractional odds format');
    }
    
    const numerator = parseInt(parts[0], 10);
    const denominator = parseInt(parts[1], 10);
    
    return parseFloat((numerator / denominator + 1).toFixed(3));
  }
  
  /**
   * Convert decimal odds to implied probability
   */
  static decimalToImplied(decimal: number): number {
    return parseFloat((100 / decimal).toFixed(2));
  }
  
  /**
   * Convert implied probability to decimal odds
   */
  static impliedToDecimal(implied: number): number {
    return parseFloat((100 / implied).toFixed(3));
  }
  
  /**
   * Find the greatest common divisor of two numbers (for fraction simplification)
   */
  private static greatestCommonDivisor(a: number, b: number): number {
    return b === 0 ? a : OddsCalculator.greatestCommonDivisor(b, a % b);
  }
  
  /**
   * Calculate fair market odds using advanced models
   * 
   * @param marketOptions Array of current market options with prices
   * @param orderFlowDeltas Changes in order flow (positive = more buys, negative = more sells)
   * @param marketWeights Importance weights for different market factors
   * @param bookParams Parameters for book balancing
   * @returns Array of adjusted market options with fair values
   */
  calculateFairOdds(
    marketOptions: MarketOption[], 
    orderFlowDeltas: number[], 
    marketWeights?: Partial<MarketWeights>,
    bookParams?: Partial<BookParams>
  ): MarketOption[] {
    if (marketOptions.length === 0) return [];
    if (orderFlowDeltas.length !== marketOptions.length) {
      throw new Error('Order flow deltas must match the number of market options');
    }
    
    // Default weights if not provided
    const weights: MarketWeights = {
      liquidityWeight: marketWeights?.liquidityWeight ?? 0.4,
      recentVolumeWeight: marketWeights?.recentVolumeWeight ?? 0.3,
      publicSentimentWeight: marketWeights?.publicSentimentWeight ?? 0.2,
      sharpMoneyWeight: marketWeights?.sharpMoneyWeight ?? 0.1,
    };
    
    // Book balancing parameters
    const params: BookParams = {
      targetOverround: bookParams?.targetOverround ?? this.defaultOverround,
      adjustmentCap: bookParams?.adjustmentCap ?? this.defaultAdjustmentCap,
      sensitivity: bookParams?.sensitivity ?? this.defaultSensitivity,
    };
    
    // Step 1: Convert all prices to implied probabilities
    const currentProbabilities = marketOptions.map(option => 
      OddsCalculator.decimalToImplied(parseFloat(option.currentPrice)) / 100
    );
    
    // Step 2: Apply order flow adjustments
    const flowAdjustedProbabilities = this.applyOrderFlowAdjustments(
      currentProbabilities, 
      orderFlowDeltas,
      params.sensitivity
    );
    
    // Step 3: Apply Kelly Criterion for sharp money influence
    const kellyAdjustedProbabilities = this.applyKellyCriterionAdjustments(
      flowAdjustedProbabilities,
      weights.sharpMoneyWeight
    );
    
    // Step 4: Balance the book to ensure proper margin
    const balancedProbabilities = this.balanceBook(
      kellyAdjustedProbabilities,
      params.targetOverround
    );
    
    // Step 5: Cap adjustments to prevent extreme movements
    const cappedProbabilities = this.capAdjustments(
      currentProbabilities,
      balancedProbabilities,
      params.adjustmentCap
    );
    
    // Step 6: Convert back to decimal odds and create new market options
    return marketOptions.map((option, index) => {
      const decimalOdds = OddsCalculator.impliedToDecimal(cappedProbabilities[index] * 100);
      return {
        ...option,
        currentPrice: decimalOdds.toFixed(2),
        fairValue: decimalOdds.toFixed(2),
      };
    });
  }
  
  /**
   * Apply adjustments based on order flow imbalances
   */
  private applyOrderFlowAdjustments(
    probabilities: number[],
    deltas: number[],
    sensitivity: number
  ): number[] {
    // Normalize deltas to prevent extreme adjustments
    const normalizedDeltas = this.normalizeDeltas(deltas);
    
    // Apply sensitivity factor and adjust probabilities
    return probabilities.map((prob, i) => {
      // More buys → probability increases, more sells → probability decreases
      const adjustment = normalizedDeltas[i] * sensitivity * 0.05; // 5% max adjustment per step
      return Math.max(0.001, Math.min(0.999, prob + adjustment));
    });
  }
  
  /**
   * Apply Kelly Criterion adjustments for sharp money influence
   */
  private applyKellyCriterionAdjustments(
    probabilities: number[],
    sharpWeight: number
  ): number[] {
    // In a real implementation, this would use historical sharp money accuracy
    // For the demo, we'll just simulate a bias toward options with prob < 0.5
    return probabilities.map(prob => {
      const kellyAdj = prob < 0.5 ? 0.03 : -0.01; // Underdog bias
      return prob + (kellyAdj * sharpWeight);
    });
  }
  
  /**
   * Balance the book to ensure desired overround (profit margin)
   */
  private balanceBook(probabilities: number[], targetOverround: number): number[] {
    // Calculate the current book sum
    const bookSum = probabilities.reduce((sum, p) => sum + p, 0);
    
    // Calculate the scaling factor needed to reach target overround
    const scalingFactor = bookSum / targetOverround;
    
    // Apply scaling to each probability
    return probabilities.map(p => p / scalingFactor);
  }
  
  /**
   * Cap adjustments to prevent extreme price movements
   */
  private capAdjustments(
    originalProbs: number[],
    adjustedProbs: number[],
    cap: number
  ): number[] {
    return adjustedProbs.map((adj, i) => {
      const orig = originalProbs[i];
      const maxUp = orig * (1 + cap);
      const maxDown = orig * (1 - cap);
      return Math.max(maxDown, Math.min(maxUp, adj));
    });
  }
  
  /**
   * Normalize order flow deltas to be usable in calculations
   */
  private normalizeDeltas(deltas: number[]): number[] {
    const maxDelta = Math.max(...deltas.map(d => Math.abs(d)));
    if (maxDelta === 0) return deltas.map(() => 0);
    return deltas.map(d => d / maxDelta);
  }
  
  /**
   * Calculate odds based on historical performance data (e.g., sports teams)
   * 
   * This would be fed by actual sports data APIs in a production system
   */
  calculateHistoricalOdds(
    homeTeamStrength: number,
    awayTeamStrength: number,
    homeAdvantage: number = 1.1,
    recentFormFactor: number = 1.0
  ): number[] {
    // Simple model using team strength ratings
    const homeAdjustedStrength = homeTeamStrength * homeAdvantage * recentFormFactor;
    const totalStrength = homeAdjustedStrength + awayTeamStrength;
    
    // Calculate raw probabilities
    const homeProbability = homeAdjustedStrength / totalStrength;
    const awayProbability = awayTeamStrength / totalStrength;
    
    // Add slight margin (overround)
    const margin = 1.05; // 5% overround
    const adjustedHomeProbability = homeProbability * margin;
    const adjustedAwayProbability = awayProbability * margin;
    
    // Return as decimal odds
    return [
      OddsCalculator.impliedToDecimal(adjustedHomeProbability * 100),
      OddsCalculator.impliedToDecimal(adjustedAwayProbability * 100)
    ];
  }
  
  /**
   * Calculate in-play odds adjustments based on live event data
   * 
   * @param currentOdds Current decimal odds
   * @param scoreChange Change in score (positive = favorite scored, negative = underdog scored)
   * @param timeElapsed Percentage of time elapsed in the event (0-1)
   * @param momentum Momentum factor (-1 to 1, positive = favorite momentum)
   * @returns Adjusted decimal odds
   */
  calculateInPlayAdjustment(
    currentOdds: number[], 
    scoreChange: number,
    timeElapsed: number,
    momentum: number
  ): number[] {
    // Convert to probabilities
    const probabilities = currentOdds.map(odd => 
      OddsCalculator.decimalToImplied(odd) / 100
    );
    
    // Score impact decreases as the game progresses
    const timeRemainingFactor = 1 - timeElapsed;
    
    // Score change has more impact early, momentum has more impact late
    const scoreImpact = scoreChange * timeRemainingFactor * 0.1;
    const momentumImpact = momentum * timeElapsed * 0.05;
    
    // Apply adjustments
    const adjustedProbs = probabilities.map((prob, index) => {
      // For the favorite (index 0), positive scoreChange and momentum are good
      // For the underdog (index 1), negative scoreChange and momentum are good
      const adjustment = index === 0 
        ? scoreImpact + momentumImpact
        : -scoreImpact - momentumImpact;
        
      return Math.max(0.01, Math.min(0.99, prob + adjustment));
    });
    
    // Ensure probabilities sum to something with a margin
    const sum = adjustedProbs.reduce((a, b) => a + b, 0);
    const marginFactor = 1.05 / sum; // 5% margin
    
    // Apply margin and convert back to decimal odds
    return adjustedProbs.map(prob => 
      OddsCalculator.impliedToDecimal((prob * marginFactor) * 100)
    );
  }
} 