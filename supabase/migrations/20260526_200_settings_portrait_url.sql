-- Add portrait_url to agent_settings_images so we can filter by which avatar generated each image
ALTER TABLE agent_settings_images
  ADD COLUMN IF NOT EXISTS portrait_url text;
