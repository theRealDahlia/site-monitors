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

## Setting an account's plan

There's no billing yet. To give an account the Starter plan (25 sites, 1-minute checks, Slack and Discord
alerts, public status pages), run this on the server from `/opt/site-monitors`:

```sh
node scripts/set-plan.mjs someone@example.com starter
node scripts/set-plan.mjs someone@example.com free     # to put them back
```

It takes effect straight away. Downgrading never deletes anything: extra sites stay (but no new ones can be
added), and Slack/Discord alerts and status pages simply stop working until the account is on Starter again.

## There is no admin in production

The site has a development-only admin that can switch its own account between plans, to test the site at
every price point. It works only in development mode (`next dev`) and nothing turns it on in production:
no setting, no environment variable, no command. A production server has no admin accounts, can't create
one, and ignores the admin flag even if a copied database contains it.

## Notes

- Run **one** copy only. The monitor checker, rate limits and SQLite database all assume a single server.
- The database lives at `DATABASE_PATH` in `.env.local` (`/var/lib/site-monitors/app.db`), outside the code folder. Back it up with Lightsail snapshots.
- Login cookies are marked `Secure` in production, so the site must be reached over HTTPS.
