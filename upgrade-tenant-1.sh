#!/bin/bash

# Quick fix: Upgrade tenant 1 to team plan
curl -X POST https://pipenotify.up.railway.app/api/v1/admin/emergency-fix \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "run_sql",
    "sql": "INSERT INTO subscriptions (tenant_id, plan_tier, status, current_period_start, current_period_end, monthly_notification_count) VALUES (1, '"'"'team'"'"', '"'"'active'"'"', NOW(), NOW() + INTERVAL '"'"'1 year'"'"', 0) ON CONFLICT (tenant_id) DO UPDATE SET plan_tier = '"'"'team'"'"', status = '"'"'active'"'"', current_period_start = NOW(), current_period_end = NOW() + INTERVAL '"'"'1 year'"'"', monthly_notification_count = 0, updated_at = NOW()"
  }'