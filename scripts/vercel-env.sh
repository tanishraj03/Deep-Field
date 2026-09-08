#!/usr/bin/env bash
# Push every Deep Field environment variable to Vercel.
#
# Reads values from .env.local — no secrets are stored in this file, so it is
# safe to commit. Run from the repo root AFTER `vercel login` and `vercel link`.
#
#   ./scripts/vercel-env.sh
#
# Re-running is safe: each variable is removed before it is re-added, so this
# updates existing values rather than erroring on them.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.local ] || { echo "no .env.local here"; exit 1; }

# Supabase is deliberately excluded: it is optional and comes in Phase 5.
VARS=(
  GEMINI_API_KEY GEMINI_MODEL SLACK_WEBHOOK_URL CRON_SECRET
  NEXT_PUBLIC_APP_URL FREE_ONLY MOCK_DATA
  AI_MAX_REQUESTS_PER_DAY AI_MAX_REQUESTS_PER_MONTH AI_SAFETY_THRESHOLD
  SLACK_CHANNEL_LABEL BRIEF_HOUR_IST
)

for name in "${VARS[@]}"; do
  value=$(grep "^${name}=" .env.local | head -1 | cut -d= -f2-)
  if [ -z "$value" ] || [[ "$value" == PASTE_* ]]; then
    echo "  skip    $name (empty or still a placeholder)"
    continue
  fi
  for env in production preview development; do
    vercel env rm "$name" "$env" --yes >/dev/null 2>&1 || true
    printf '%s' "$value" | vercel env add "$name" "$env" >/dev/null 2>&1
  done
  echo "  set     $name  (production, preview, development)"
done

echo
echo "Done. Redeploy so the new values take effect:"
echo "  vercel --prod"
