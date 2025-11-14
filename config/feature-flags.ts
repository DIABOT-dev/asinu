/**
 * DIABOT V4 - Unified Feature Flags System
 * 
 * Single source of truth for all feature flags
 * Supports both client-side (NEXT_PUBLIC_) and server-side flags
 */

// All possible feature flag keys
export type FlagKey =
  // Core features
  | 'AI_AGENT_MODE'           // 'demo' | 'openai' | 'off'
  | 'REWARDS_ENABLED'         // boolean
  | 'CHARTS_ENABLED'          // boolean
  | 'BACKGROUND_SYNC'         // boolean
  | 'REALTIME_ENABLED'        // boolean
  | 'DEBUG_MODE'              // boolean

  // AI specific flags
  | 'AI_CACHE_ENABLED'        // boolean
  | 'AI_BUDGET_ENABLED'       // boolean
  | 'AI_BUDGET_DROP_ON_EXCEEDED' // boolean
  | 'AI_DISABLE_RETRY'        // boolean
  | 'AI_RULES_FALLBACK_ENABLED' // boolean

  // Chart & Data flags
  | 'CHART_USE_DEMO_DATA'     // boolean
  | 'CHART_FALLBACK'          // boolean

  // Mock modes
  | 'MEAL_MOCK_MODE'          // boolean
  | 'REMINDER_MOCK_MODE'      // boolean

  // Safety & Control
  | 'KILL_SWITCH_ENABLED'     // boolean
  | 'AUTH_DEV_MODE'           // boolean

  // Feature Modules (QA Freeze 0.9.0 - Default OFF)
  | 'RELATIVE_ENABLED'        // boolean - FamilyLink module
  | 'NUDGE_ENABLED'           // boolean - Proactive Nudge system
  | 'SAFETY_RULES_ENABLED'    // boolean - Enhanced safety validation
  | 'FEATURE_MISSION'         // boolean - Mission Lite module
  | 'TREE_ENABLED'            // boolean - Life Tree module
  | 'DONATION_ENABLED'        // boolean - Donate API

  // Advanced AI features
  | 'AI_GATEWAY_ENABLED'
  | 'AI_COACH_ENABLED'
  | 'AI_MEAL_ENABLED'
  | 'AI_VOICE_ENABLED'
  | 'AI_FAMILY_ENABLED'
  | 'AI_REWARD_ENABLED'
  | 'AI_PERSONALIZATION_DEEP'
  | 'AI_MARKETPLACE'
  | 'AI_FEDERATED_LEARNING'
  | 'AI_GAMIFICATION_DEEP';

export type FeatureFlags = Record<FlagKey, boolean | string>;

// Cache for server-side flags (1 minute TTL)
let _cache: { data: FeatureFlags; expires: number } | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Safe boolean reader from environment variables
 */
function readEnvBool(key: string, defaultValue = false): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return /^(1|true|yes|on)$/i.test(value);
}

/**
 * Safe string reader from environment variables
 */
function readEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Get all feature flags with caching for server-side performance
 */
export function getFeatureFlags(): FeatureFlags {
  const now = Date.now();
  
  // Return cached data if still valid
  if (_cache && now < _cache.expires) {
    return _cache.data;
  }

  // Build fresh flag data
  const flags: FeatureFlags = {
    // Core features - client-side flags (require rebuild when changed)
    AI_AGENT_MODE: readEnvString('NEXT_PUBLIC_AI_AGENT', 'demo'),
    REWARDS_ENABLED: readEnvBool('REWARDS_ENABLED', false),
    CHARTS_ENABLED: true, // Always enabled (safe feature)
    BACKGROUND_SYNC: readEnvBool('NEXT_PUBLIC_BG_SYNC'),
    REALTIME_ENABLED: readEnvBool('NEXT_PUBLIC_REALTIME'),
    DEBUG_MODE: process.env.NODE_ENV === 'development',

    // Chart & Data flags - client-side
    CHART_USE_DEMO_DATA: readEnvBool('NEXT_PUBLIC_CHART_USE_DEMO'),
    CHART_FALLBACK: readEnvBool('NEXT_PUBLIC_CHART_FALLBACK'),

    // Safety & Control - mixed
    KILL_SWITCH_ENABLED: readEnvBool('NEXT_PUBLIC_KILL_SWITCH'),
    AUTH_DEV_MODE: readEnvBool('AUTH_DEV_MODE'),

    // Mock modes - server-side flags (no rebuild required)
    MEAL_MOCK_MODE: readEnvBool('MEAL_MOCK_MODE'),
    REMINDER_MOCK_MODE: readEnvBool('REMINDER_MOCK_MODE'),

    // Feature Modules - server-side (QA Freeze 0.9.0 - Default OFF)
    RELATIVE_ENABLED: readEnvBool('RELATIVE_ENABLED', false),
    NUDGE_ENABLED: readEnvBool('NUDGE_ENABLED', false),
    SAFETY_RULES_ENABLED: readEnvBool('SAFETY_RULES_ENABLED', false),
    FEATURE_MISSION: readEnvBool('FEATURE_MISSION', false),
    TREE_ENABLED: readEnvBool('TREE_ENABLED', false),
    DONATION_ENABLED: readEnvBool('DONATION_ENABLED', false),

    // AI specific flags - server-side
    AI_CACHE_ENABLED: readEnvBool('AI_CACHE_ENABLED', true), // Default enabled
    AI_BUDGET_ENABLED: readEnvBool('AI_BUDGET_ENABLED'),
    AI_BUDGET_DROP_ON_EXCEEDED: readEnvBool('AI_BUDGET_DROP_ON_EXCEEDED', true), // Default enabled
    AI_DISABLE_RETRY: readEnvBool('AI_DISABLE_RETRY'),
    AI_RULES_FALLBACK_ENABLED: readEnvBool('AI_RULES_FALLBACK_ENABLED', true), // Default enabled

    // Advanced AI features - server-side
    AI_GATEWAY_ENABLED: readEnvBool('AI_GATEWAY_ENABLED', true),
    AI_COACH_ENABLED: readEnvBool('AI_COACH_ENABLED', true),
    AI_MEAL_ENABLED: readEnvBool('AI_MEAL_ENABLED', true),
    AI_VOICE_ENABLED: readEnvBool('AI_VOICE_ENABLED', true),
    AI_FAMILY_ENABLED: readEnvBool('AI_FAMILY_ENABLED', true),
    AI_REWARD_ENABLED: readEnvBool('AI_REWARD_ENABLED', true),
    AI_PERSONALIZATION_DEEP: readEnvBool('AI_PERSONALIZATION_DEEP'),
    AI_MARKETPLACE: readEnvBool('AI_MARKETPLACE'),
    AI_FEDERATED_LEARNING: readEnvBool('AI_FEDERATED_LEARNING'),
    AI_GAMIFICATION_DEEP: readEnvBool('AI_GAMIFICATION_DEEP'),
  };

  // Cache the result
  _cache = {
    data: flags,
    expires: now + CACHE_TTL_MS
  };

  return flags;
}

/**
 * Get a specific feature flag value
 */
export function getFeatureFlag<T extends FlagKey>(key: T): FeatureFlags[T] {
  const flags = getFeatureFlags();
  return flags[key];
}

/**
 * Helper function to check if a boolean feature is enabled
 */
export function isFeatureEnabled(key: FlagKey): boolean {
  const value = getFeatureFlag(key);
  return Boolean(value);
}

/**
 * Helper function to check if AI agent is in a specific mode
 */
export function isAIAgentMode(mode: 'demo' | 'openai' | 'off'): boolean {
  return getFeatureFlag('AI_AGENT_MODE') === mode;
}

/**
 * Kill switch - disable all non-essential features
 */
export function isKillSwitchActive(): boolean {
  return isFeatureEnabled('KILL_SWITCH_ENABLED');
}

// Log kill switch activation
if (isKillSwitchActive()) {
  console.warn('🚨 KILL SWITCH ACTIVATED - All non-essential features disabled');
}

/**
 * Get feature flag status for debugging
 */
export function getFeatureFlagStatus(): {
  clientSide: Record<string, any>;
  serverSide: Record<string, any>;
  killSwitch: boolean;
} {
  const flags = getFeatureFlags();
  
  const clientSide: Record<string, any> = {};
  const serverSide: Record<string, any> = {};
  
  // Categorize flags
  const clientFlags = [
    'AI_AGENT_MODE', 'REWARDS_ENABLED', 'CHARTS_ENABLED', 
    'BACKGROUND_SYNC', 'REALTIME_ENABLED', 'CHART_USE_DEMO_DATA', 
    'CHART_FALLBACK_OLTP', 'KILL_SWITCH_ENABLED'
  ];
  
  Object.entries(flags).forEach(([key, value]) => {
    if (clientFlags.includes(key)) {
      clientSide[key] = value;
    } else {
      serverSide[key] = value;
    }
  });
  
  return {
    clientSide,
    serverSide,
    killSwitch: isKillSwitchActive()
  };
}

/**
 * Testing helper – clears the in-memory cache so subsequent reads
 * reflect the latest process.env values.
 */
export function resetFeatureFlagCache(): void {
  _cache = null;
}
