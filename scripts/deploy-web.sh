#!/usr/bin/env bash
# Deploy web assets to S3 and invalidate CloudFront.
# Requires the SAM stack to be deployed first (creates S3 bucket + CloudFront).
#
# Reads the target stack from apps/api/samconfig.toml.
# Override with env vars:
#   CONFIG_ENV=prod   (which samconfig env block to read; default: prod)
#   STACK_NAME=...    (explicit stack name, overrides samconfig)
#   AWS_REGION=...    (explicit region, overrides samconfig)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SAMCONFIG="$REPO_ROOT/apps/api/samconfig.toml"
DIST_DIR="$REPO_ROOT/apps/web/dist"
CONFIG_ENV="${CONFIG_ENV:-prod}"

if [ ! -f "$SAMCONFIG" ]; then
  echo "Error: samconfig.toml not found at $SAMCONFIG" >&2
  exit 1
fi

if [ ! -d "$DIST_DIR" ]; then
  echo "Error: web build not found at $DIST_DIR" >&2
  echo "Run 'pnpm --filter @app/web build' first." >&2
  exit 1
fi

# Extract a value from a specific [CONFIG_ENV.deploy.parameters] block.
# Avoids the ambiguity of grepping all sections (which broke when a
# non-prod block was added).
extract_from_samconfig() {
  local key="$1"
  awk -v env="$CONFIG_ENV" -v key="$key" '
    $0 ~ "^\\["env"\\.deploy\\.parameters\\]" { in_block=1; next }
    in_block && /^\[/ { in_block=0 }
    in_block && $1 == key {
      # Match:  key = "value"
      gsub(/.*= *"/, "")
      gsub(/".*/, "")
      print
      exit
    }
  ' "$SAMCONFIG"
}

STACK_NAME="${STACK_NAME:-$(extract_from_samconfig stack_name)}"
REGION_VALUE="${AWS_REGION:-$(extract_from_samconfig region)}"

if [ -z "$STACK_NAME" ]; then
  echo "Error: Could not determine stack_name (env=$CONFIG_ENV). Set STACK_NAME explicitly." >&2
  exit 1
fi

REGION_ARG=()
if [ -n "$REGION_VALUE" ]; then
  REGION_ARG=("--region" "$REGION_VALUE")
fi

echo "==> Reading stack outputs from $STACK_NAME (env=$CONFIG_ENV, region=${REGION_VALUE:-default})"

BUCKET=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  "${REGION_ARG[@]}" \
  --query "Stacks[0].Outputs[?OutputKey=='WebSiteBucketName'].OutputValue" \
  --output text)

DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  "${REGION_ARG[@]}" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

if [ -z "$BUCKET" ] || [ "$BUCKET" = "None" ]; then
  echo "Error: WebSiteBucketName output missing. Deploy the SAM stack first." >&2
  exit 1
fi

if [ -z "$DIST_ID" ] || [ "$DIST_ID" = "None" ]; then
  echo "Error: CloudFrontDistributionId output missing." >&2
  exit 1
fi

echo "  Stack:         $STACK_NAME"
echo "  S3 bucket:     $BUCKET"
echo "  CloudFront:    $DIST_ID"

# Hashed assets: aggressive cache (Vite emits hashed filenames)
echo "==> Syncing hashed assets to s3://$BUCKET/"
aws s3 sync "$DIST_DIR" "s3://$BUCKET/" \
  --delete \
  --exclude "index.html" \
  --cache-control "public, max-age=31536000, immutable"

# index.html: no cache (SPA entry point should always be fresh)
echo "==> Uploading index.html with no-cache"
aws s3 cp "$DIST_DIR/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html; charset=utf-8"

# Invalidate the SPA entry point
echo "==> Invalidating CloudFront $DIST_ID"
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/index.html" "/" \
  --output text \
  --query "Invalidation.Id"

echo "==> Done."
