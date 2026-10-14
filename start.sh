#!/bin/sh
set -e

# Align a fresh TradeFix database to the current Prisma schema.
npx prisma db push --skip-generate

# Bootstrap baseline settings and master data.
node scripts/bootstrap-taxfix.js

# Start the application.
node server.js
