# Deploying to a Lightsail (Ubuntu) server

These files run the app at `/opt/site-monitors`, behind Caddy for HTTPS.

| File | Goes to | What it does |
|---|---|---|
| `site-monitors.service` | `/etc/systemd/system/` | Keeps the app running, starts it at boot, restarts it if it crashes |
| `Caddyfile` | `/etc/caddy/Caddyfile` | HTTPS for `site-monitors.net` (certificate is automatic) and `www` redirect |
| `update.sh` | stays in place | Pulls, rebuilds and restarts |

## First-time setup (after the code is cloned, built, and `.env.local` is in place)

```sh
cd /opt/site-monitors && git pull
sudo cp deploy/site-monitors.service /etc/systemd/system/site-monitors.service
sudo systemctl daemon-reload
sudo systemctl enable --now site-monitors
journalctl -u site-monitors -n 20 --no-pager     # look for: [monitors] scheduler started
```

Then, with Caddy installed:

```sh
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Updating later

```sh
sh /opt/site-monitors/deploy/update.sh
```

## Notes

- Run **one** copy only. The monitor checker, rate limits and SQLite database all assume a single server.
- The database lives at `DATABASE_PATH` in `.env.local` (`/var/lib/site-monitors/app.db`), outside the code folder. Back it up with Lightsail snapshots.
- Login cookies are marked `Secure` in production, so the site must be reached over HTTPS.
