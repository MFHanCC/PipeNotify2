import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('oauth_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Query Keys
export const QueryKeys = {
  // Analytics
  ANALYTICS_METRICS: (params: any) => ['analytics', 'metrics', params],
  ANALYTICS_TIMESERIES: (params: any) => ['analytics', 'timeseries', params],
  ANALYTICS_RULES: (params: any) => ['analytics', 'rules', params],
  ANALYTICS_CHANNELS: (params: any) => ['analytics', 'channels', params],
  
  // Rules
  NOTIFICATION_RULES: 'notificationRules',
  RULE_DETAILS: (id: string) => ['rules', id],
  
  // Logs
  DELIVERY_LOGS: (page: number, limit: number) => ['logs', 'delivery', page, limit],
  
  // Webhooks
  WEBHOOKS: 'webhooks',
  
  // Reports
  SCHEDULED_REPORTS: 'scheduledReports',
  
  // Backups
  RULE_BACKUPS: 'ruleBackups',
  
  // Templates
  RULE_TEMPLATES: 'ruleTemplates',
  TEMPLATE_CATEGORIES: 'templateCategories',
  
  // System
  SYSTEM_STATUS: 'systemStatus',
  BACKEND_CONNECTION: 'backendConnection',
} as const;

// Analytics Queries
export const useAnalyticsMetrics = (params: { period?: string; start_date?: string; end_date?: string } = {}) => {
  const queryParams = new URLSearchParams();
  if (params.period) queryParams.append('period', params.period);
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);

  return useQuery({
    queryKey: QueryKeys.ANALYTICS_METRICS(params),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics/metrics?${queryParams}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch analytics metrics');
      const data = await response.json();
      return data.data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const useAnalyticsTimeSeries = (params: { period?: string; start_date?: string; end_date?: string } = {}) => {
  const queryParams = new URLSearchParams();
  if (params.period) queryParams.append('period', params.period);
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);

  return useQuery({
    queryKey: QueryKeys.ANALYTICS_TIMESERIES(params),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics/timeseries?${queryParams}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch analytics time series');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 30 * 1000,
  });
};

export const useAnalyticsRules = (params: { period?: string; start_date?: string; end_date?: string } = {}) => {
  const queryParams = new URLSearchParams();
  if (params.period) queryParams.append('period', params.period);
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);

  return useQuery({
    queryKey: QueryKeys.ANALYTICS_RULES(params),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics/rules?${queryParams}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch analytics rules');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 30 * 1000,
  });
};

export const useAnalyticsChannels = (params: { period?: string; start_date?: string; end_date?: string } = {}) => {
  const queryParams = new URLSearchParams();
  if (params.period) queryParams.append('period', params.period);
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);

  return useQuery({
    queryKey: QueryKeys.ANALYTICS_CHANNELS(params),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/analytics/channels?${queryParams}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch analytics channels');
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 30 * 1000,
  });
};

// Rules Queries
export const useNotificationRules = () => {
  return useQuery({
    queryKey: [QueryKeys.NOTIFICATION_RULES],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/rules`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch notification rules');
      const data = await response.json();
      return data.rules || [];
    },
    staleTime: 60 * 1000, // 1 minute
  });
};

// Logs Queries
export const useDeliveryLogs = (page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: QueryKeys.DELIVERY_LOGS(page, limit),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/logs/delivery?page=${page}&limit=${limit}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch delivery logs');
      const data = await response.json();
      return data;
    },
    staleTime: 30 * 1000,
  });
};

// Webhooks Queries
export const useWebhooks = () => {
  return useQuery({
    queryKey: [QueryKeys.WEBHOOKS],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/webhooks`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch webhooks');
      const data = await response.json();
      return data.webhooks || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Scheduled Reports Queries
export const useScheduledReports = () => {
  return useQuery({
    queryKey: [QueryKeys.SCHEDULED_REPORTS],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/reports/scheduled`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch scheduled reports');
      const data = await response.json();
      return data.reports || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Rule Backups Queries
export const useRuleBackups = () => {
  return useQuery({
    queryKey: [QueryKeys.RULE_BACKUPS],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/rules/backups`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch rule backups');
      const data = await response.json();
      return data.backups || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Rule Templates Queries
export const useRuleTemplates = () => {
  return useQuery({
    queryKey: [QueryKeys.RULE_TEMPLATES],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/templates/rules`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch rule templates');
      const data = await response.json();
      return data.templates || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useTemplateCategories = () => {
  return useQuery({
    queryKey: [QueryKeys.TEMPLATE_CATEGORIES],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/templates/categories`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch template categories');
      const data = await response.json();
      return data.categories || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// System Status Queries
export const useSystemStatus = () => {
  return useQuery({
    queryKey: [QueryKeys.SYSTEM_STATUS],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/system/status`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch system status');
      const data = await response.json();
      return data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000, // Check system status every 30 seconds
  });
};

// Mutations
export const useCreateNotificationRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newRule: any) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/rules`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newRule)
      });
      if (!response.ok) throw new Error('Failed to create notification rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.NOTIFICATION_RULES] });
    },
  });
};

export const useUpdateNotificationRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/rules/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update notification rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.NOTIFICATION_RULES] });
    },
  });
};

export const useDeleteNotificationRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/rules/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete notification rule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.NOTIFICATION_RULES] });
    },
  });
};

export const useCreateScheduledReport = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newReport: any) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/reports/scheduled`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newReport)
      });
      if (!response.ok) throw new Error('Failed to create scheduled report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.SCHEDULED_REPORTS] });
    },
  });
};

export const useUpdateScheduledReport = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/reports/scheduled/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update scheduled report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.SCHEDULED_REPORTS] });
    },
  });
};

export const useDeleteScheduledReport = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/reports/scheduled/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete scheduled report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.SCHEDULED_REPORTS] });
    },
  });
};

export const useCreateRuleBackup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (backupData: any) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/rules/backups`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(backupData)
      });
      if (!response.ok) throw new Error('Failed to create rule backup');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.RULE_BACKUPS] });
    },
  });
};

export const useRestoreRuleBackup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, options }: { id: string; options: any }) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/rules/backups/${id}/restore`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(options)
      });
      if (!response.ok) throw new Error('Failed to restore rule backup');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.RULE_BACKUPS] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.NOTIFICATION_RULES] });
    },
  });
};

export const useDeleteRuleBackup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/rules/backups/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to delete rule backup');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.RULE_BACKUPS] });
    },
  });
};

// Custom hook for invalidating all analytics queries
export const useInvalidateAnalytics = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  };
};