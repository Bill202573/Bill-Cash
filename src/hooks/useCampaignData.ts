import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SupabaseService } from '@/services/supabase-service';
import { ClaudeInsightsService } from '@/services/claude-insights-service';
import { Campaign, DailyMetrics, CampaignInsight } from '@/types/ads';

/**
 * Hook to fetch user campaigns
 */
export function useCampaigns(platform?: string) {
  return useQuery({
    queryKey: ['campaigns', platform],
    queryFn: async () => {
      try {
        return await SupabaseService.getCampaigns(platform);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch campaign metrics
 */
export function useCampaignMetrics(campaignId: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['campaign-metrics', campaignId, startDate, endDate],
    queryFn: async () => {
      try {
        return await SupabaseService.getCampaignMetrics(campaignId, startDate, endDate);
      } catch (error) {
        console.error('Error fetching metrics:', error);
        return [];
      }
    },
    enabled: !!campaignId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch campaign insights
 */
export function useCampaignInsights(campaignId: string, unreadOnly: boolean = false) {
  return useQuery({
    queryKey: ['campaign-insights', campaignId, unreadOnly],
    queryFn: async () => {
      try {
        return await SupabaseService.getInsights(campaignId, unreadOnly);
      } catch (error) {
        console.error('Error fetching insights:', error);
        return [];
      }
    },
    enabled: !!campaignId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to analyze campaign with Claude
 */
export function useAnalyzeCampaign() {
  const queryClient = useQueryClient();
  const claudeService = new ClaudeInsightsService();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const campaigns = await SupabaseService.getCampaigns();
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) throw new Error('Campaign not found');

      const metrics = await SupabaseService.getCampaignMetrics(campaignId);
      if (metrics.length === 0) throw new Error('No metrics available');

      return claudeService.analyzePerformance({
        campaign_name: campaign.campaign_name,
        platform: campaign.platform,
        metrics,
      });
    },
    onSuccess: (insights, campaignId) => {
      // Save insights to database
      insights.forEach(async insight => {
        await SupabaseService.saveInsight(campaignId, insight);
      });

      // Invalidate insights query
      queryClient.invalidateQueries({
        queryKey: ['campaign-insights', campaignId],
      });
    },
    onError: error => {
      console.error('Error analyzing campaign:', error);
    },
  });
}

/**
 * Hook to save metrics
 */
export function useSaveMetrics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { campaignId: string; metrics: Partial<DailyMetrics>[] }) => {
      return SupabaseService.saveMetrics(params.campaignId, params.metrics);
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({
        queryKey: ['campaign-metrics', params.campaignId],
      });
    },
  });
}

/**
 * Hook to sync campaign data from platform
 */
export function useSyncCampaigns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (integrationId: string) => {
      // This will be implemented with background job
      // For now, just invalidate queries
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

/**
 * Hook to mark insight as read
 */
export function useMarkInsightAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (insightId: string) => SupabaseService.markInsightAsRead(insightId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-insights'] });
    },
  });
}
