import { createClient } from '@supabase/supabase-js';
import { Integration, Campaign, DailyMetrics, CampaignInsight } from '@/types/ads';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class SupabaseService {
  /**
   * Save or update integration
   */
  static async saveIntegration(
    platform: string,
    platformAccountId: string,
    platformAccountName: string,
    accessToken: string,
    refreshToken?: string
  ): Promise<Integration | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('integrations')
      .upsert({
        user_id: user.id,
        platform,
        platform_account_id: platformAccountId,
        platform_account_name: platformAccountName,
        access_token: accessToken,
        refresh_token: refreshToken,
        updated_at: new Date(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get user's integrations
   */
  static async getIntegrations(): Promise<Integration[]> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get single integration
   */
  static async getIntegration(integrationId: string): Promise<Integration | null> {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Save campaigns
   */
  static async saveCampaigns(
    integrationId: string,
    campaigns: Partial<Campaign>[]
  ): Promise<Campaign[]> {
    const { data, error } = await supabase
      .from('campaigns')
      .upsert(
        campaigns.map(c => ({
          ...c,
          integration_id: integrationId,
          updated_at: new Date(),
        }))
      )
      .select();

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's campaigns
   */
  static async getCampaigns(platform?: string): Promise<Campaign[]> {
    let query = supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Get campaign metrics
   */
  static async getCampaignMetrics(
    campaignId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DailyMetrics[]> {
    let query = supabase
      .from('campaign_metrics')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Save daily metrics
   */
  static async saveMetrics(
    campaignId: string,
    metrics: Partial<DailyMetrics>[]
  ): Promise<DailyMetrics[]> {
    const { data, error } = await supabase
      .from('campaign_metrics')
      .upsert(
        metrics.map(m => ({
          ...m,
          campaign_id: campaignId,
        }))
      )
      .select();

    if (error) throw error;
    return data || [];
  }

  /**
   * Save insights
   */
  static async saveInsight(
    campaignId: string,
    insight: Partial<CampaignInsight>
  ): Promise<CampaignInsight | null> {
    const { data, error } = await supabase
      .from('campaign_insights')
      .insert({
        ...insight,
        campaign_id: campaignId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get campaign insights
   */
  static async getInsights(
    campaignId: string,
    unreadOnly: boolean = false
  ): Promise<CampaignInsight[]> {
    let query = supabase
      .from('campaign_insights')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Mark insight as read
   */
  static async markInsightAsRead(insightId: string): Promise<void> {
    const { error } = await supabase
      .from('campaign_insights')
      .update({ read: true })
      .eq('id', insightId);

    if (error) throw error;
  }

  /**
   * Create audit log
   */
  static async createAuditLog(
    action: string,
    entityType: string,
    entityId: string,
    changes?: any
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        changes,
      });

    if (error) throw error;
  }
}
