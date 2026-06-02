import { Integration, Campaign, DailyMetrics, APIResponse } from '@/types/ads';

const META_GRAPH_API_VERSION = 'v19.0';
const META_BASE_URL = 'https://graph.instagram.com';

export class MetaAdsService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get user's ad accounts
   */
  async getAdAccounts(): Promise<APIResponse<any[]>> {
    try {
      const response = await fetch(
        `${META_BASE_URL}/${META_GRAPH_API_VERSION}/me/adaccounts?access_token=${this.accessToken}`
      );
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message };
      }

      return { success: true, data: data.data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get campaigns for an ad account
   */
  async getCampaigns(
    accountId: string,
    fields: string[] = [
      'id',
      'name',
      'status',
      'objective',
      'daily_budget',
      'lifetime_budget',
      'start_time',
      'stop_time',
    ]
  ): Promise<APIResponse<Campaign[]>> {
    try {
      const fieldString = fields.join(',');
      const response = await fetch(
        `${META_BASE_URL}/${META_GRAPH_API_VERSION}/${accountId}/campaigns?fields=${fieldString}&access_token=${this.accessToken}`
      );
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message };
      }

      return { success: true, data: data.data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get campaign insights (metrics)
   */
  async getCampaignInsights(
    campaignId: string,
    dateStart: string,
    dateEnd: string
  ): Promise<APIResponse<DailyMetrics[]>> {
    try {
      const fields = [
        'campaign_id',
        'campaign_name',
        'date_start',
        'date_stop',
        'impressions',
        'clicks',
        'spend',
        'actions',
        'action_values',
      ].join(',');

      const response = await fetch(
        `${META_BASE_URL}/${META_GRAPH_API_VERSION}/${campaignId}/insights?` +
          `fields=${fields}` +
          `&time_range={"since":"${dateStart}","until":"${dateEnd}"}` +
          `&time_increment=1` +
          `&access_token=${this.accessToken}`
      );
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message };
      }

      // Transform Meta API response to DailyMetrics
      const metrics = data.data.map((item: any) => ({
        date: item.date_start,
        impressions: parseInt(item.impressions) || 0,
        clicks: parseInt(item.clicks) || 0,
        conversions: item.actions?.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_purchase')
          ?.value || 0,
        spend: parseFloat(item.spend) || 0,
        ctr: item.clicks && item.impressions ? (parseInt(item.clicks) / parseInt(item.impressions)) * 100 : 0,
        cpc: item.clicks ? parseFloat(item.spend) / parseInt(item.clicks) : 0,
      }));

      return { success: true, data: metrics };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Validate access token
   */
  async validateToken(): Promise<APIResponse<boolean>> {
    try {
      const response = await fetch(
        `${META_BASE_URL}/${META_GRAPH_API_VERSION}/me?fields=id,name&access_token=${this.accessToken}`
      );
      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message };
      }

      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
