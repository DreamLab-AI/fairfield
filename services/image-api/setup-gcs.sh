#!/bin/bash
# Setup GCS bucket for Image API
# Run this once to create and configure the bucket

set -e

PROJECT_ID="${GCP_PROJECT_ID:-cumbriadreamlab}"
BUCKET_NAME="${GCS_BUCKET:-minimoonoir-images}"
REGION="us-central1"

echo "Setting up GCS bucket: $BUCKET_NAME"

# Create bucket if it doesn't exist
if ! gsutil ls -b "gs://$BUCKET_NAME" &>/dev/null; then
    echo "Creating bucket..."
    gsutil mb -p "$PROJECT_ID" -c STANDARD -l "$REGION" "gs://$BUCKET_NAME"
else
    echo "Bucket already exists"
fi

# Set CORS configuration
echo "Setting CORS configuration..."
gsutil cors set cors-config.json "gs://$BUCKET_NAME"

# Make bucket objects publicly readable (for serving images)
echo "Setting public access..."
gsutil iam ch allUsers:objectViewer "gs://$BUCKET_NAME"

# Set lifecycle policy (optional: delete old images after 365 days)
cat > /tmp/lifecycle.json << 'EOF'
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 365}
    }
  ]
}
EOF
gsutil lifecycle set /tmp/lifecycle.json "gs://$BUCKET_NAME"

echo "GCS bucket setup complete!"
echo "Bucket URL: https://storage.googleapis.com/$BUCKET_NAME/"

# Verify CORS
echo ""
echo "CORS configuration:"
gsutil cors get "gs://$BUCKET_NAME"
