#!/bin/bash
set -e

PROJECT_ID="kinetic-object-322814"
REGION="us-central1"
FUNCTION_NAME="sheetsApi"
SERVICE_ACCOUNT="sheets-db-api@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Building TypeScript..."
npm run build

echo "Deploying Cloud Function..."
gcloud functions deploy "$FUNCTION_NAME" \
  --gen2 \
  --runtime=nodejs20 \
  --region="$REGION" \
  --source=. \
  --entry-point="$FUNCTION_NAME" \
  --trigger-http \
  --allow-unauthenticated \
  --service-account="$SERVICE_ACCOUNT"

echo ""
echo "Deployment complete!"
echo "URL: https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME}"
