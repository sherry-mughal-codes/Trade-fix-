
#!/bin/bash

# Define the package name
PACKAGE_NAME="zoto-rehab-deploy.zip"

# Clean previous package
rm -f $PACKAGE_NAME

# Create a zip file excluding unnecessary directories
echo "Creating deployment package: $PACKAGE_NAME..."

zip -r $PACKAGE_NAME . \
    -x "node_modules/*" \
    -x ".next/*" \
    -x ".git/*" \
    -x ".idea/*" \
    -x ".vscode/*" \
    -x "keys/*" \
    -x "backups/*" \
    -x "debug_dbs/*" \
    -x "*.DS_Store" \
    -x ".env" \
    -x ".env.local" \
    -x "prisma/dev.db" \
    -x "prisma/dev.db-journal" \
    -x "prisma/*.db"

echo "Package created successfully!"
echo "Upload $PACKAGE_NAME to your VPS, unzip it, and run:"
echo "  docker compose up --build -d"
