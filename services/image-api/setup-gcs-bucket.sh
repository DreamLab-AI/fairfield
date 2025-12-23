#!/bin/bash
# Setup GCS bucket for user image storage
# Run this once to create and configure the bucket

set -e

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-cumbriadreamlab}"
BUCKET_NAME="${GCS_BUCKET:-minimoonoir-images}"
REGION="us-central1"

echo "Setting up GCS bucket for image storage..."
echo "Project: $PROJECT_ID"
echo "Bucket: $BUCKET_NAME"
echo "Region: $REGION"

# Create bucket if it doesn't exist
if ! gsutil ls -b "gs://${BUCKET_NAME}" &>/dev/null; then
  echo "Creating bucket..."
  gsutil mb -p "$PROJECT_ID" -l "$REGION" -b on "gs://${BUCKET_NAME}"
else
  echo "Bucket already exists"
fi

# Set uniform bucket-level access
echo "Configuring bucket access..."
gsutil uniformbucketlevelaccess set on "gs://${BUCKET_NAME}"

# Make bucket publicly readable (for serving images)
echo "Setting public read access..."
gsutil iam ch allUsers:objectViewer "gs://${BUCKET_NAME}"

# Set lifecycle rule to delete old images (optional - 1 year retention)
cat > /tmp/lifecycle.json << EOF
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 365, "matchesPrefix": ["message/"]}
    }
  ]
}
EOF
gsutil lifecycle set /tmp/lifecycle.json "gs://${BUCKET_NAME}"
rm /tmp/lifecycle.json

# Set CORS configuration for browser uploads
cat > /tmp/cors.json << EOF
[
  {
    "origin": ["https://jjohare.github.io", "http://localhost:5173", "http://localhost:3000"],
    "method": ["GET", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Content-Length", "Cache-Control"],
    "maxAgeSeconds": 3600
  }
]
EOF
gsutil cors set /tmp/cors.json "gs://${BUCKET_NAME}"
rm /tmp/cors.json

# Create folder structure
echo "Creating folder structure..."
echo "" | gsutil cp - "gs://${BUCKET_NAME}/avatar/.keep"
echo "" | gsutil cp - "gs://${BUCKET_NAME}/message/.keep"
echo "" | gsutil cp - "gs://${BUCKET_NAME}/channel/.keep"

echo ""
echo "✓ GCS bucket setup complete!"
echo ""
echo "Bucket URL: https://storage.googleapis.com/${BUCKET_NAME}/"
echo ""
echo "Next steps:"
echo "1. Deploy the image-api service to Cloud Run"
echo "2. Update VITE_IMAGE_API_URL in .env"
echo "3. Grant the Cloud Run service account storage.objectAdmin role"
