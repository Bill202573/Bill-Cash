import { Campaign, DailyMetrics, APIResponse } from '@/types/ads';

const GOOGLE_ADS_API_VERSION = 'v15';
const GOOGLE_ADS_BASE_URL = 'https://googleads.googleapis.com';

export class GoogleAdsService {
  private accessToken: string;
  private customerId: string;

  constructor(accessToken: string, customerId: string) {
    this.accessToken = accessToken;
    this.customerId = customerId;
  }

  /**
   * Get campaigns for a customer
   */
  async getCampaigns(): Promise<APIResponse<Campaign[]>> {
    try {
      const response = await fetch(
        `${GOOGLE_ADS_BASE_URL}/${GOOGLE_ADS_API_VERSION}/customers/${this.customerId}/campaigns`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': process.env.REACT_APP_GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message };
      }

      return { success: true, data: data.results };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get campaign metrics using Google Ads Query Language (GAQL)
   */
  async getCampaignMetrics(
    campaignId: string,
    dateStart: string,
    dateEnd: string
  ): Promise<APIResponse<DailyMetrics[]>> {
    try {
      const gaqlQuery = `
        SELECT
          campaign.id,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions,
          metrics.cost_micros,
          metrics.click_through_rate,
          metrics.cost_per_click,
          metrics.cost_per_conversion
        FROM campaign_daily_stats
        WHERE campaign.id = '${campaignId}'
        AND segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        ORDER BY segments.date DESC
      `;

      const response = await fetch(
        `${GOOGLE_ADS_BASE_URL}/${GOOGLE_ADS_API_VERSION}/customers/${this.customerId}:searchStream`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': process.env.REACT_APP_GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
          body: JSON.stringify({
            query: gaqlQuery,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error?.message };
      }

      // Transform Google Ads API response to DailyMetrics
      const metrics = data.results?.map((item: any) => ({
        date: item.segments.date,
        impressions: parseInt(item.metrics.impressions) || 0,
        clicks: parseInt(item.metrics.clicks) || 0,
        conversions: parseInt(item.metrics.conversions) || 0,
        spend: (item.metrics.cost_micros || 0) / 1000000,
        ctr: item.metrics.click_through_rate || 0,
        cpc: item.metrics.cost_per_click || 0,
        cpa: item.metrics.cost_per_conversion || 0,
      })) || [];

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
        `${GOOGLE_ADS_BASE_URL}/${GOOGLE_ADS_API_VERSION}/customers:searchStream`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': process.env.REACT_APP_GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
          body: JSON.stringify({
            query: 'SELECT customer.descriptive_name LIMIT 1',
          }),
        }
      );

      if (!response.ok) {
        return { success: false, error: 'Invalid token' };
      }

      return { success: true, data: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
