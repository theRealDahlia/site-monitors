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

Paid plans are bought through Stripe (set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER` and `STRIPE_PRICE_PRO` in `.env.local`, and point a Stripe webhook at `/api/billing/webhook`). Moving between paid plans is done by the app (`/api/billing/change`): it switches at once, charges the new plan in full, refunds the unused whole days of the old one to the card, and starts a new monthly period today. So turn **off** "Customers can switch plans" in the Stripe Customer portal settings, or people could change plan there with Stripe's own rules. The Stripe key also needs write access to Subscriptions and Refunds, and read access to Invoices, PaymentIntents, Charges and Prices.

To give an account a plan by hand, for example for free, run this on the server from `/opt/site-monitors`:

```sh
node scripts/set-plan.mjs someone@example.com starter   # 25 sites, 1-minute checks, Slack and Discord, status pages
node scripts/set-plan.mjs someone@example.com pro       # 100 sites, and everything in Starter
node scripts/set-plan.mjs someone@example.com free      # to put them back
```

It takes effect straight away. Pro also includes AI-visibility checks and white-label status pages (see below).
Downgrading never deletes anything: extra sites and extra alert addresses stay and keep working (but no
new ones can be added until the account is under the new limit), and Slack/Discord alerts and status
pages simply stop working until the account is on Starter or Pro again.

## Slack and Discord sign-in

Users connect Slack or Discord by signing in to it and picking a channel. That needs one Slack app and
one Discord app for the whole site, which you create once. Users never make their own.

**Slack** (api.slack.com/apps → Create New App → From scratch, name it "Site Monitors"):

When someone connects, the app creates a public `#site-monitors-alerts` channel in their workspace,
adds them to it, and posts alerts there. If that name is taken, a short ending is added.

1. **OAuth & Permissions** → Redirect URLs: add `https://site-monitors.net/api/oauth/slack/callback` and save.
2. Same page → Scopes → **Bot Token Scopes**: add exactly these three, and no user scopes:
   - `channels:manage` (create the alerts channel)
   - `channels:write.invites` (add the person who connected to it)
   - `chat:write` (post alerts)
3. **App Home** → make sure the bot's display name is "Site Monitors" (that's who alerts appear from).
4. **Basic Information** → Display Information: add an icon and short description (Slack shows these on the approval screen).
5. **Manage Distribution** → tick the checklist and **Activate Public Distribution**, so workspaces other than yours can connect.
6. **Basic Information** → App Credentials: copy the Client ID and Client Secret into `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET`.

Incoming Webhooks don't need to be turned on. Slack connections made before this change (where the
person picked a channel) keep working until they're disconnected.

**Discord** (discord.com/developers/applications → New Application, name it "Site Monitors"):

When someone connects, they add the Site Monitors bot to their server. The app then creates a
`#site-monitors-alerts` channel (a short ending is added if that name is already used), creates a
webhook in it, and posts alerts through that webhook. Disconnecting deletes the webhook and keeps the
channel. The bot's own token is only used at connection time and is never stored per person.

1. **Installation** → under Installation Contexts tick **Guild Install** and untick **User Install**. Set Install Link to **None** (Connect Discord on the Integrations page builds its own link).
2. **OAuth2** → Redirects: add `https://site-monitors.net/api/oauth/discord/callback` and click **Save Changes**.
3. **Bot** → turn **Public Bot** on (otherwise only you can add it). Don't turn on any privileged intents; the bot never connects to Discord's gateway or reads messages.
4. **Bot** → **Reset Token** and copy it into `DISCORD_BOT_TOKEN`. It's a secret like the client secret.
5. **OAuth2** → copy the Client ID into `DISCORD_CLIENT_ID`, and **Reset Secret** to copy the Client Secret into `DISCORD_CLIENT_SECRET`.

The sign-in link asks for the `bot` and `identify` scopes and three permissions: **Manage Channels** (create the alerts channel), **Manage Webhooks** (create the webhook) and **View Channel**. It doesn't ask for permission to send or read messages. The person connecting needs permission to add apps to their server, normally **Manage Server**.

Put the five values in `.env.local` on the server, then `sudo systemctl restart site-monitors`. The
redirect address is built from `APP_URL`, so it must match exactly what you registered.

For local development, also register the `http://localhost:3000/api/oauth/…/callback` addresses and use
a separate set of values in your Mac's `.env.local`. Discord accepts `http://localhost`. Slack only
accepts `https` redirect addresses, so test Slack on the live site (or through an HTTPS tunnel).

## Status pages on customers' own domains (Pro)

A Pro customer can show a site's public status page at their own address, like `status.theircompany.com`, with no Site
Monitors branding. They add two DNS records (shown in Manage sites): a TXT record that proves they own the domain, and a
CNAME that points it at `site-monitors.net`.

For this server to answer for those domains over HTTPS, Caddy needs the updated config in `deploy/Caddyfile`. It gets a
certificate for a customer's domain the first time someone visits it, but only after asking the app
(`/api/domains/allowed`), which says yes only for a verified domain whose owner is still on a plan that includes it.

```sh
cd /opt/site-monitors && git pull
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Needs: the app running (Caddy asks it), `APP_URL=https://site-monitors.net` in `.env.local` (that's the address customers
point at), and ports 80 and 443 open in the Lightsail firewall (they already are). If a customer's page shows a certificate
error, look at `journalctl -u caddy -n 50 --no-pager` for the domain. The usual causes are DNS that doesn't point here yet
(Caddy can only get a certificate once it does) or a customer using a CDN proxy in front of the domain.

Ownership is re-checked daily. If a customer's TXT record has been missing for three daily checks in a row, the domain is
released, so a domain that lapses and is bought by someone else can't keep serving the old owner's page.

Heartbeat monitors are pinged at `https://site-monitors.net/api/ping/<token>`, so `APP_URL` must be right for the
addresses shown in the dashboard to work.

## There is no admin in production

The site has a development-only admin that can switch its own account between plans, to test the site at
every price point. It works only in development mode (`next dev`) and nothing turns it on in production:
no setting, no environment variable, no command. A production server has no admin accounts, can't create
one, and ignores the admin flag even if a copied database contains it.

## Notes

- Run **one** copy only. The monitor checker, rate limits and SQLite database all assume a single server.
- The database lives at `DATABASE_PATH` in `.env.local` (`/var/lib/site-monitors/app.db`), outside the code folder. Back it up with Lightsail snapshots.
- Login cookies are marked `Secure` in production, so the site must be reached over HTTPS.
