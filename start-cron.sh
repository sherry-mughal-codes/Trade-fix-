#!/bin/sh
set -eu

: "${AUTO_INVOICE_CRON_SECRET:?AUTO_INVOICE_CRON_SECRET is required}"

CRON_SCHEDULE="${AUTO_INVOICE_CRON_SCHEDULE:-1 0 * * *}"
CRON_TIME_ZONE="${AUTO_INVOICE_CRON_TIME_ZONE:-Asia/Karachi}"
AUTO_INVOICE_INTERNAL_URL="${AUTO_INVOICE_INTERNAL_URL:-http://app:3000/api/internal/auto-invoices}"

printf '%s' "$AUTO_INVOICE_CRON_SECRET" > /etc/auto-invoice-cron.secret
printf '%s' "$AUTO_INVOICE_INTERNAL_URL" > /etc/auto-invoice-internal-url

cat > /etc/cron.d/auto-invoices <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
CRON_TZ=$CRON_TIME_ZONE
$CRON_SCHEDULE root /app/scripts/run-auto-invoices-cron.sh >> /proc/1/fd/1 2>> /proc/1/fd/2
EOF

chmod 600 /etc/auto-invoice-cron.secret /etc/auto-invoice-internal-url
chmod 0644 /etc/cron.d/auto-invoices

exec cron -f
