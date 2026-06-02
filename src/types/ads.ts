// Types para Ads Manager

export type Platform = 'meta' | 'google';
export type CampaignStatus = 'active' | 'paused' | 'archived' | 'draft';
export type InsightType = 'performance' | 'optimization' | 'alert' | 'recommendation';

export interface Integration {
  id: string;
  user_id: string;
  platform: Platform;
  platform_account_id: string;
  platform_account_name: string;
  status: 'active' | 'expired' | 'revoked';
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  integration_id: string;
  platform: Platform;
  campaign_id: string;
  campaign_name: string;
  status: CampaignStatus;
  objective?: string;
  daily_budget?: number;
  currency?: string;
  start_date?: string;
  end_date?: string;
  metadata?: Record<string, any>;
  synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyMetrics {
  id: string;
  campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr?: number; // Click-through rate
  cpc?: number; // Cost per click
  cpa?: number; // Cost per acquisition
  roas?: number; // Return on ad spend
  frequency?: number;
  reach?: number;
  custom_metrics?: Record<string, any>;
  created_at: string;
}

export interface CampaignInsight {
  id: string;
  campaign_id: string;
  insight_type: InsightType;
  title: string;
  description: string;
  confidence: number; // 0-1.0
  recommended_action?: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
}

export interface MetricsPerformance {
  campaign_id: string;
  campaign_name: string;
  period: 'week' | 'month' | 'all_time';
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_spend: number;
  avg_ctr: number;
  avg_cpc: number;
  avg_roas: number;
  trend: number; // % change from previous period
  daily_data: DailyMetrics[];
}

export interface APIResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface SyncJob {
  id: string;
  integration_id: string;
  job_type: 'metrics_sync' | 'campaign_sync';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}
