#!/usr/bin/env bash
# Push every DeepField environment variable to Vercel.
#
# Reads values from .env.local, no secrets are stored in this file, so it is
# safe to commit. Run from the repo root AFTER `vercel login` and `vercel link`.
#
#   ./scripts/vercel-env.sh
#
# Re-running is safe: each variable is removed before it is re-added, so this
# updates existing values rather than erroring on them.
set -uo pipefail
cd "$(dirname "$0")/.."

[ -f .env.local ] || { echo "no .env.local here"; exit 1; }

# The CLI is usually not on PATH; fall back to npx.
VERCEL=$(command -v vercel || echo "npx --yes vercel")

# Every key is optional; empty ones are skipped.
VARS=(
  GEMINI_API_KEY GROQ_API_KEY CEREBRAS_API_KEY OPENROUTER_API_KEY MISTRAL_API_KEY XAI_API_KEY
  AI_BACKGROUND_MODEL AI_DEFAULT_MODEL
  REDDIT_CLIENT_ID REDDIT_CLIENT_SECRET YOUTUBE_API_KEY
  NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
  CRON_SECRET
)

for name in "${VARS[@]}"; do
  # Last occurrence wins, matching how Next.js reads .env.local.
  value=$(grep "^${name}=" .env.local | tail -1 | cut -d= -f2-)
  if [ -z "$value" ] || [[ "$value" == PASTE_* ]]; then
    echo "  skip    $name (empty or still a placeholder)"
    continue
  fi
  for env in production preview development; do
    $VERCEL env rm "$name" "$env" --yes >/dev/null 2>&1 || true
    printf '%s' "$value" | $VERCEL env add "$name" "$env" >/dev/null 2>&1
  done
  echo "  set     $name  (production, preview, development)"
done

echo
echo "Done. Redeploy so the new values take effect:"
echo "  npx vercel --prod"
