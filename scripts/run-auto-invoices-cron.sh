#!/bin/sh
set -eu

AUTO_INVOICE_CRON_SECRET="$(cat /etc/auto-invoice-cron.secret)"
AUTO_INVOICE_INTERNAL_URL="$(cat /etc/auto-invoice-internal-url)"

curl -fsS -X POST \
  -H "x-cron-secret: $AUTO_INVOICE_CRON_SECRET" \
  "$AUTO_INVOICE_INTERNAL_URL"
