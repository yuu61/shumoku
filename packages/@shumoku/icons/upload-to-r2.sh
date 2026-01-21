#!/bin/bash
# Upload icons to Cloudflare R2 bucket

BUCKET="shumoku-icons"
SRC_DIR="$(dirname "$0")/src"

# Normalize Aruba filename to match model name format
# Device - AP500 Series.svg -> ap500-series.svg
normalize_aruba() {
  local filename="$1"
  local normalized

  # Remove extension
  normalized="${filename%.svg}"

  # Remove common prefixes
  normalized=$(echo "$normalized" | sed -E 's/^(Device|Client|Generic|Function) - //')

  # Lowercase and replace spaces with hyphens
  normalized=$(echo "$normalized" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

  echo "${normalized}.svg"
}

# Normalize AWS filename to match service/resource key format
# Res_Amazon-EC2_Instance_48.svg -> ec2-instance.svg
normalize_aws() {
  local filename="$1"
  local normalized service resource

  # Remove extension and _48 suffix
  normalized="${filename%.svg}"
  normalized="${normalized%_48}"

  # Remove Res_ prefix
  normalized="${normalized#Res_}"

  # Extract service and resource using sed
  if echo "$normalized" | grep -qE '^Amazon-[^_]+_.+$'; then
    # Amazon-EC2_Instance -> service=EC2, resource=Instance
    service=$(echo "$normalized" | sed -E 's/^Amazon-([^_]+)_.+$/\1/')
    resource=$(echo "$normalized" | sed -E 's/^Amazon-[^_]+_(.+)$/\1/')
  elif echo "$normalized" | grep -qE '^AWS-[^_]+_.+$'; then
    # AWS-Lambda_Function -> service=Lambda, resource=Function
    service=$(echo "$normalized" | sed -E 's/^AWS-([^_]+)_.+$/\1/')
    resource=$(echo "$normalized" | sed -E 's/^AWS-[^_]+_(.+)$/\1/')
  else
    # Fallback: general/resource
    service="general"
    resource="$normalized"
  fi

  # Normalize service: lowercase, remove hyphens
  service=$(echo "$service" | tr '[:upper:]' '[:lower:]' | tr -d '-')

  # Normalize resource: lowercase, replace underscores with hyphens
  resource=$(echo "$resource" | tr '[:upper:]' '[:lower:]' | tr '_' '-')

  echo "${service}-${resource}.svg"
}

upload_aruba() {
  echo "Uploading aruba (svg files)..."
  for file in "$SRC_DIR/aruba"/*.svg; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      normalized=$(normalize_aruba "$filename")
      key="v1/aruba/$normalized"
      echo "  $key"
      npx wrangler r2 object put "$BUCKET/$key" --file "$file" --content-type "image/svg+xml" --remote 2>/dev/null
    fi
  done
}

upload_aws() {
  echo "Uploading aws (svg files)..."
  for file in "$SRC_DIR/aws"/*.svg; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")

      # Skip Dark variants (use Light as default)
      if echo "$filename" | grep -q "_Dark"; then
        continue
      fi

      # Remove _Light suffix if present (treat as default)
      filename=$(echo "$filename" | sed 's/_Light//')

      normalized=$(normalize_aws "$filename")
      key="v1/aws/$normalized"
      echo "  $key"
      npx wrangler r2 object put "$BUCKET/$key" --file "$file" --content-type "image/svg+xml" --remote 2>/dev/null
    fi
  done
}

upload_simple() {
  local vendor="$1"
  local ext="$2"
  local content_type="$3"

  echo "Uploading $vendor ($ext files)..."
  for file in "$SRC_DIR/$vendor"/*."$ext"; do
    if [ -f "$file" ]; then
      filename=$(basename "$file")
      # Just lowercase for simple filenames
      normalized=$(echo "$filename" | tr '[:upper:]' '[:lower:]')
      key="v1/$vendor/$normalized"
      echo "  $key"
      npx wrangler r2 object put "$BUCKET/$key" --file "$file" --content-type "$content_type" --remote 2>/dev/null
    fi
  done
}

# Upload all vendors
upload_aruba
upload_aws
upload_simple "juniper" "png" "image/png"
upload_simple "yamaha" "png" "image/png"

echo "Done!"
