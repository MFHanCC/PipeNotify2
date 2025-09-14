-- Migration 010: Add 'compact' template mode to rules table
-- This fixes the issue where rule creation fails when using 'compact' template mode

-- Drop the existing constraint
ALTER TABLE rules DROP CONSTRAINT IF EXISTS rules_template_mode_check;

-- Add the new constraint with 'compact' included
ALTER TABLE rules ADD CONSTRAINT rules_template_mode_check 
  CHECK (template_mode IN ('simple', 'compact', 'detailed', 'custom'));

-- Update any existing rules that might have invalid template modes
UPDATE rules SET template_mode = 'simple' WHERE template_mode NOT IN ('simple', 'compact', 'detailed', 'custom');