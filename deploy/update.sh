#!/bin/sh
# Pull the latest code, rebuild it, and restart the app. Run on the server: sh /opt/site-monitors/deploy/update.sh
set -e
cd /opt/site-monitors
git pull
npm ci
npm run build
sudo systemctl restart site-monitors
echo "Updated and restarted."
