import { DailyMetrics, CampaignInsight } from '@/types/ads';

interface ClaudeInsightRequest {
  campaign_name: string;
  platform: string;
  metrics: DailyMetrics[];
  previous_period_metrics?: DailyMetrics[];
}

export class ClaudeInsightsService {
  private apiKey: string;
  private model: string = 'claude-opus-4-8';

  constructor(apiKey: string = process.env.REACT_APP_CLAUDE_API_KEY || '') {
    this.apiKey = apiKey;
  }

  /**
   * Analyze campaign performance using Claude
   */
  async analyzePerformance(request: ClaudeInsightRequest): Promise<CampaignInsight[]> {
    const prompt = this.buildAnalysisPrompt(request);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.content[0].text;

      return this.parseInsights(content);
    } catch (error) {
      console.error('Error analyzing performance with Claude:', error);
      return [];
    }
  }

  /**
   * Build analysis prompt for Claude
   */
  private buildAnalysisPrompt(request: ClaudeInsightRequest): string {
    const metricsText = request.metrics
      .slice(0, 7)
      .map(m => `Date: ${m.date} | Impressions: ${m.impressions} | Clicks: ${m.clicks} | Spend: $${m.spend}`)
      .join('\n');

    return `Analyze the following ${request.platform} ad campaign performance and provide actionable insights.

Campaign: ${request.campaign_name}
Platform: ${request.platform}

Recent Daily Performance (last 7 days):
${metricsText}

Based on this data, please provide:
1. Performance Summary: Overall performance status
2. Key Insights: Up to 3 main observations about the campaign
3. Recommended Actions: Specific optimizations to improve performance
4. Risk Alerts: Any concerning trends or issues

Format your response as a JSON object with these keys:
- performance_summary (string)
- key_insights (array of strings)
- recommended_actions (array of objects with "action" and "impact" keys)
- risk_alerts (array of objects with "alert" and "severity" keys)

Example format:
{
  "performance_summary": "Campaign showing moderate performance...",
  "key_insights": ["High CTR indicates strong audience relevance", "..."],
  "recommended_actions": [{"action": "Increase daily budget", "impact": "Could improve reach by 20%"}, ...],
  "risk_alerts": [{"alert": "CPC trending upward", "severity": "medium"}, ...]
}`;
  }

  /**
   * Parse Claude response into insights
   */
  private parseInsights(content: string): CampaignInsight[] {
    const insights: CampaignInsight[] = [];

    try {
      // Extract JSON from Claude response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return insights;

      const parsed = JSON.parse(jsonMatch[0]);

      // Create insights from parsed data
      if (parsed.key_insights) {
        parsed.key_insights.forEach((insight: string, index: number) => {
          insights.push({
            id: `insight_${Date.now()}_${index}`,
            campaign_id: '',
            insight_type: 'performance',
            title: `Performance Insight #${index + 1}`,
            description: insight,
            confidence: 0.85,
            read: false,
            created_at: new Date().toISOString(),
          });
        });
      }

      if (parsed.recommended_actions) {
        parsed.recommended_actions.forEach((rec: any, index: number) => {
          insights.push({
            id: `recommendation_${Date.now()}_${index}`,
            campaign_id: '',
            insight_type: 'optimization',
            title: rec.action,
            description: rec.impact || rec.action,
            confidence: 0.8,
            recommended_action: rec.action,
            read: false,
            created_at: new Date().toISOString(),
          });
        });
      }

      if (parsed.risk_alerts) {
        parsed.risk_alerts.forEach((alert: any, index: number) => {
          insights.push({
            id: `alert_${Date.now()}_${index}`,
            campaign_id: '',
            insight_type: 'alert',
            title: alert.alert,
            description: `Severity: ${alert.severity}`,
            confidence: 0.75,
            read: false,
            created_at: new Date().toISOString(),
          });
        });
      }
    } catch (error) {
      console.error('Error parsing Claude response:', error);
    }

    return insights;
  }

  /**
   * Generate optimization recommendations
   */
  async generateOptimizations(request: ClaudeInsightRequest): Promise<string[]> {
    const insights = await this.analyzePerformance(request);
    return insights
      .filter(i => i.insight_type === 'optimization')
      .map(i => i.recommended_action || i.description);
  }
}
