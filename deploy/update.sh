#!/bin/sh
# Pull the latest code, rebuild it, and restart the app. Run on the server: sh /opt/site-monitors/deploy/update.sh
set -e
cd /opt/site-monitors
git pull
npm ci
# This server has little memory: stop the app while building so the build gets all of it, and let Node use swap.
# The app is started again even if the build fails, so a bad build doesn't leave the site down.
trap 'sudo systemctl start site-monitors' EXIT
sudo systemctl stop site-monitors
NODE_OPTIONS=--max-old-space-size=2048 npm run build
echo "Updated and restarted."
