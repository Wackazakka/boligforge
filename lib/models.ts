// Central model registry — update here when Anthropic retires a model.
// Use bare IDs (no date suffix): they track the latest patch and retire later.
export const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5',
} as const
