# Social posts for site-monitors.net (posts 1 to 12)

These go with the images in `marketing-images/` (`facebook-post-1.png`, `-2.png`, `-3.png`, all 1200 x 630, which also fits LinkedIn and X). Each post below has the image, the caption, a first comment with the link, alt text, a few variations for other platforms, and what to do after it goes up.

All the links were checked and return 200: `/domain-checker`, `/ssl-checker`, `/guides/47-day-ssl-certificates`. Every fact used comes from the site itself. The 200 / 100 / 47 day schedule in post 3 matches the 47-day guide (200 days from 15 March 2026, 100 from 15 March 2027, 47 from 15 March 2029).

## How to use these

**Order and timing.** Post them in this order, about two days apart (for example Tuesday, Thursday, then the following Tuesday). Post 1 asks a question and starts conversation, post 2 gives people a free tool to try, and post 3 explains why the problem is getting bigger. Weekday mornings are a sensible first guess. After the first three posts, check Facebook Insights (or LinkedIn analytics) and move to whatever hours your own audience is active.

**Link in the first comment.** Many marketers believe Facebook and LinkedIn show posts with an outbound link to fewer people (neither platform confirms it, so test it yourself), and most groups remove posts that look like ads. So the caption has no link. Post the link as the first comment, straight after posting. In a group that bans links, leave the link out and reply with it only when someone asks.

**Links with tracking.** Each link is tagged so you can see which post brought the click. To use the same post on another platform, change only `utm_source` (for example `linkedin`, `x`, `reddit`).

| Post | Link for Facebook |
|---|---|
| 1 | `https://site-monitors.net/domain-checker?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts&utm_content=post-1-tracking` |
| 2 | `https://site-monitors.net/ssl-checker?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts&utm_content=post-2-ssl-check` |
| 3 | `https://site-monitors.net/guides/47-day-ssl-certificates?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts&utm_content=post-3-47-days` |

**Groups vs your own Page.** On your own Page you can post as written. In a group, read the rules first and spend a week or two answering other people's questions before you post. Use the "Facebook group" version of each caption, which is written as a question, not an announcement.

---

## Post 1: "How do you track SSL & domain renewals for your clients?"

**Image:** `marketing-images/facebook-post-1.png`

**What the image shows:** a renewal spreadsheet with five client rows where most SSL and domain dates are blank, guessed ("Mar?") or marked "???", and "+ 15 more...". The client names are made up. Don't swap in real client names.

**Alt text:** A spreadsheet tracking client SSL and domain renewals. Most dates are missing or marked with question marks, and 15 more rows are hidden below.

**Caption (your Page):**

> Be honest: how do you keep track of when your clients' SSL certificates and domains expire?
>
> A spreadsheet? Calendar reminders? Memory? "The client will tell me"?
>
> We've seen all four. They work until the week one of them doesn't, and then it's a Monday morning phone call about a "Not secure" warning.
>
> Tell us what you use. We're collecting the setups people swear by (and the ones that burned them).

**Caption (Facebook group version, conversational):**

> Quick question for anyone who looks after client sites: how do you keep track of SSL and domain renewals? Spreadsheet, calendar reminders, something else? I'm curious what actually works once you're past 10 or 20 sites.

**First comment (Page):**

> If you'd like a quick way to check a client's domain right now, this is free and needs no account: [Facebook link for post 1]

**Reply to comments with:**
- Someone shares a setup: ask one follow-up ("Has it ever missed one?"). Don't pitch yet.
- Someone mentions a missed renewal: thank them for sharing it, and only then mention the free plan: "That's why we built a free plan that emails you before things lapse. 5 sites, no card."
- Someone asks what you use: tell them plainly and give the link.

**For LinkedIn:** use the Page caption, drop the "four setups" line, and add `#agencylife #webdesign #wordpress`. Use two or three hashtags at most.

**For X:** *How do you track SSL and domain renewals for client sites? Spreadsheet, calendar, memory? Genuinely curious what works past 20 sites.* (attach the image, link in a reply)

**Track:** comments and shares, not clicks. This post is for conversation and for finding out what your audience says in their own words.

---

## Post 2: "Is your client's SSL cert about to expire?"

**Image:** `marketing-images/facebook-post-2.png`

**What the image shows:** the SSL checker with `example.com` entered, a green "Valid / Expires in 41 days / Issued by Let's Encrypt" result, "Hostname match: Yes", "Certificate chain: Complete", and the line "Free check. No signup. Takes about 10 seconds." It is marked "Illustration. Example result." in the image. Keep that label. It is an example, not a real customer's certificate.

**Alt text:** The free SSL checker showing a valid certificate for example.com that expires in 41 days, issued by Let's Encrypt, with a matching hostname and a complete certificate chain.

**Caption (your Page):**

> When did you last check how many days your clients' SSL certificates have left?
>
> One expired certificate and every visitor sees a full-page security warning instead of the website.
>
> Our free SSL checker shows the expiry date, who issued the certificate, and whether the hostname and chain are set up correctly. No signup, takes about 10 seconds.
>
> Try it on a client site today. Link in the comments.

**Caption (Facebook group version):**

> Something I found useful: a free SSL checker that shows the expiry date, the issuer, and whether the hostname and certificate chain are right. No account needed. Handy before a client call or when a site shows a browser warning. Happy to share the link if anyone wants it.

**First comment (Page):**

> Free, no signup: [Facebook link for post 2]
>
> And if you want an email before any of them expire, the free plan covers 5 sites.

**Reply to comments with:**
- "What do you check besides expiry?" Hostname match and the certificate chain (both are in the tool and the image).
- "Does it work for subdomains?" Test one yourself before you answer, so you reply from what you actually saw.
- Someone posts their result: congratulate them if it's healthy, and if it's close to expiring, point them to the SSL expired guide: `https://site-monitors.net/guides/ssl-certificate-expired`.

**For LinkedIn:** use the Page caption as is. Add `#webdevelopment #wordpress #cybersecurity`.

**For X:** *Free SSL checker: expiry date, issuer, hostname match, certificate chain. No signup, about 10 seconds.* with the link in the same post. X doesn't penalise links the way Facebook does.

**For Reddit** (r/webdev, r/Wordpress, r/sysadmin): don't post the image with this caption. Use the story version from `MARKETING.md` ("A client's SSL cert expired on a Friday and we found out from the client"), and post as a story, not an ad.

**Track:** link clicks and checker uses. This is your main traffic post. If your analytics records checker events, compare them against the day this post went up.

---

## Post 3: "47 days"

**Image:** `marketing-images/facebook-post-3.png`

**What the image shows:** a large "47" with "days maximum SSL lifetime by 2029", and three bars: Today 200 days, 2027 100, 2029 47. The caption on the image reads "More renewals. More chances one fails quietly."

**Alt text:** A large number 47 with the text "days maximum SSL lifetime by 2029". A bar chart shows the maximum certificate lifetime falling from 200 days today to 100 days in 2027 and 47 days in 2029.

**Caption (your Page):**

> SSL certificates are getting shorter lives. By 2029 the maximum is 47 days.
>
> Today it's 200 days. From March 2027 it's 100. That means a certificate that used to need renewing once a year will need renewing about eight times a year.
>
> If you look after client sites, that's a lot more chances for one renewal to fail quietly. The fix isn't working harder. It's getting an alert before the warning shows up.
>
> We wrote up the schedule and what to do about it. Link in the comments.

**Check before posting:** the "about eight times a year" line is 365 / 47, which is just under 8, and it assumes renewing at the maximum lifetime. In practice most people renew sooner (Let's Encrypt, for example, renews well before expiry), so you may prefer the softer wording "far more often than once a year". It's your call. I left the number in because it's easy to follow, but it is the one figure in these posts that is an estimate and not a stated rule.

**Caption (Facebook group version):**

> Heads-up for anyone managing client sites: the maximum SSL certificate lifetime is already down to 200 days, and it keeps shrinking (100 days in March 2027, 47 days by 2029). Anyone renewing by hand will feel that. How are you handling renewals?

**First comment (Page):**

> The full schedule and how to avoid expired-certificate outages: [Facebook link for post 3]

**Reply to comments with:**
- "Is this actually happening?" Yes. The 200-day limit has applied to new certificates since 15 March 2026. The guide has the dates.
- "Doesn't auto-renew fix it?" It helps, but auto-renew can fail without anyone noticing, which is the point of the post. Link to `https://site-monitors.net/guides/lets-encrypt-renewal-failed` if they use Let's Encrypt.
- Don't argue with anyone who thinks the change is a bad idea. Agree it's inconvenient, then move on.

**For LinkedIn:** this is your best LinkedIn post. Use the Page caption, and add `#ssl #webdevelopment #agencyowners`. LinkedIn rewards posts that spark discussion, so end with a question: "Are you still renewing by hand?"

**For X:** *SSL certs are heading for 47-day lifetimes. 200 days now, 100 in 2027, 47 in 2029. More renewals = more silent failures.* with the guide link.

**Track:** shares and saves, plus clicks to the guide. Saves mean people intend to come back to it.

---

## Before you post

- [ ] Open each link once yourself from the UTM version, so you know it loads and the page looks right.
- [ ] Paste a link into a draft (or a Facebook Sharing Debugger / LinkedIn Post Inspector check) to confirm the preview image and title look right. Many clicks start from that preview.
- [ ] Check that the analytics events for the checkers and signup fire, so the clicks you get can be measured.
- [ ] Add the alt text when you upload each image (Facebook: "Edit photo" then "Alternative text").
- [ ] Re-read your group's rules for every group you post to.
- [ ] Be ready to reply in the first hour. Quick replies keep the conversation going while people are still looking at the post.

## What to look at after a week

| Question | Where to look |
|---|---|
| Which post got the most conversation? | Comments and shares on each post |
| Which post got the most clicks? | Facebook Insights, or your analytics filtered by `utm_content` |
| Did clicks turn into checker uses? | Your analytics events for the SSL and domain checks |
| Did any turn into signups? | Signups with `utm_campaign=launch-posts` |
| What did people say in their own words? | Copy the best comments into a note. They are your next headlines and ad copy. |

If post 1 gets lots of comments, write the next post around the setups people described. If post 2 gets the clicks, put a small budget behind it (it matches ad concept 1 in `MARKETING.md`). If post 3 gets the saves and shares, turn it into a LinkedIn carousel (the schedule, then why it matters, then the free check).

---
---

# Posts 4 to 6

Posts 1 to 3 are already up, along with their stories. These three use new images (`facebook-post-4.png` to `-6.png`, 1200 x 630) and new story images (`facebook-story-4.png` to `-6.png`, 1080 x 1920). The tagged links below use a new campaign name, `launch-posts-2`, so you can tell them apart from the first batch in Umami.

Each image is an illustration with made-up names. Posts 4 and 5 carry an "Illustration. Example" label in the picture. Keep it, and don't swap in a real client's domain.

## Before you post anything

- **Post 6 links to a new guide that isn't on the live site yet.** The guide (`/guides/err-cert-common-name-invalid`) exists only in your project folder until you commit, push and deploy it. Open the live link first and check it loads. Posts 4 and 5 only link to pages that are live today.
- **After the guide is live,** paste its address into URL Inspection in Search Console and click **Request indexing**, the same as you did for the other two guides.
- **Spacing:** about two days between posts, as before. Post each story the same day as its post, or the day after.

| Post | Link for Facebook |
|---|---|
| 4 | `https://site-monitors.net/domain-checker?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-2&utm_content=post-4-domain-expiry` |
| 5 | `https://site-monitors.net/guides/lets-encrypt-renewal-failed?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-2&utm_content=post-5-certbot` |
| 6 | `https://site-monitors.net/guides/err-cert-common-name-invalid?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-2&utm_content=post-6-wrong-name` |

| Story | Link for the link sticker |
|---|---|
| 4 | `https://site-monitors.net/domain-checker?utm_source=facebook&utm_medium=story&utm_campaign=launch-posts-2&utm_content=story-4-domain-expiry` |
| 5 | `https://site-monitors.net/guides/lets-encrypt-renewal-failed?utm_source=facebook&utm_medium=story&utm_campaign=launch-posts-2&utm_content=story-5-certbot` |
| 6 | `https://site-monitors.net/guides/err-cert-common-name-invalid?utm_source=facebook&utm_medium=story&utm_campaign=launch-posts-2&utm_content=story-6-wrong-name` |

---

## Post 4: "When does your clients' domain registration run out?"

**Image:** `marketing-images/facebook-post-4.png` (story: `facebook-story-4.png`)

**What the image shows:** the domain expiry checker with an example result: "Expiring soon", "23 days left", registrar, registration date, expiry date and a nameserver. Every value is made up.

**Alt text:** The free domain expiry checker showing an example domain with 23 days left, its registrar, registration date, expiry date and nameserver.

**Caption (your Page):**

> Quick test: what day does your biggest client's domain registration run out?
>
> If you had to look it up, you're in good company. Most people can't say off the top of their head. And when a registration lapses, the website and the client's email both stop working.
>
> Our free domain expiry checker shows the expiry date, the registrar and when the domain was registered. No signup, takes seconds.
>
> Try it on a client domain today. Link in the comments.

**Caption (Facebook group version):**

> Genuine question for anyone who manages client sites: do you keep domain expiry dates somewhere, or look them up when it comes up? I've been using a free checker that shows the expiry date and registrar without an account. Happy to share it if it's useful.

**First comment (Page):**

> Free, no signup: [link for post 4]
>
> And if you'd like an email before any of them lapse, the free plan covers 5 sites.

**Reply to comments with:**
- "Where do you keep yours?" Ask what they use and how often it has missed one. Don't pitch yet.
- "Does it work for every domain?" Say it works for most domains. Some registries don't publish enough to read, and the guide covers what to do then: `https://site-monitors.net/guides/how-to-check-when-a-domain-expires`
- Someone's domain is close to expiring: tell them to renew now, before anything else.

**Story:** use `facebook-story-4.png` with a link sticker. Text over the sticker: "Check a domain".

**For LinkedIn:** use the Page caption. Add `#agencylife #webdesign #domains`.

**For X:** *What day does your biggest client's domain registration run out? If you had to look it up, you're not alone. Free expiry checker, no signup:* (link in the same post).

**Track:** clicks and `domain_check` events in Umami.

---

## Post 5: "Certbot failed at 3am. Did anyone tell you?"

**Image:** `marketing-images/facebook-post-5.png` (story: `facebook-story-5.png`)

**What the image shows:** a terminal with an example `certbot renew` run that fails, labelled "Illustration. Example output." The wording follows the messages Certbot prints, but the output in the picture is an example and not from a real server.

**Alt text:** A terminal window showing an example Certbot renewal that fails with the message "Failed to renew certificate" and "All renewals failed".

**Caption (your Page):**

> Certbot failed at 3am. Did anyone tell you?
>
> Let's Encrypt stopped sending expiry reminder emails in June 2025. So when automatic renewal quietly breaks, the first sign is often a visitor seeing a security warning on a client's site.
>
> If you run Certbot on any client servers, try this once:
>
> sudo certbot renew --dry-run
>
> It tests a renewal without issuing anything, and prints the reason if it fails.
>
> We wrote up the usual causes and how to fix them. Link in the comments.

**Caption (Facebook group version):**

> For anyone running Let's Encrypt on client servers: since June 2025 there are no expiry emails, so a failed auto-renew can go unnoticed until the certificate lapses. Running `sudo certbot renew --dry-run` once is a quick way to see whether renewal still works. How do you keep an eye on yours?

**First comment (Page):**

> The usual causes of a failed renewal and how to fix them: [link for post 5]

**Reply to comments with:**
- "My dry run failed, what now?" Ask them to paste the error line (with the domain removed), and point them to the guide's section on the usual causes.
- "I use a different tool" Fine. The point is the same: check that renewal still works, and monitor the certificate itself.
- "Doesn't Certbot email me?" It used to, through Let's Encrypt. That service ended on 4 June 2025, which is in the guide.

**Story:** use `facebook-story-5.png` with a link sticker. Text over the sticker: "Read the fix".

**For LinkedIn:** use the Page caption. Add `#devops #sysadmin #letsencrypt`. Developers see this one more than agency owners, so it suits groups for sysadmins and web developers.

**For X:** *Let's Encrypt stopped sending expiry emails in June 2025. If you run Certbot on client servers, run `sudo certbot renew --dry-run` once today. Common causes and fixes:* (link in the same post).

**For Reddit** (r/sysadmin, r/webdev): don't post the image. Ask a question or share the dry-run tip in words, and put the guide link in a comment only where the rules allow it.

**Track:** clicks to the guide, shares, and comments from people who run servers.

---

## Post 6: "Valid certificate. Wrong name."

**Image:** `marketing-images/facebook-post-6.png` (story: `facebook-story-6.png`)

**What the image shows:** a Chrome-style "Your connection is not private" warning with the code `NET::ERR_CERT_COMMON_NAME_INVALID`, then "Certificate covers example.com" with a tick and "Visitor opened www.example.com" with a cross. It is labelled "Illustration."

**Alt text:** A browser security warning with the error code NET::ERR_CERT_COMMON_NAME_INVALID. The certificate covers example.com, but the visitor opened www.example.com.

**Caption (your Page):**

> Your SSL certificate can be valid, not expired, and still show visitors a full-page warning.
>
> A certificate lists the exact names it covers. If it's issued for example.com and someone opens www.example.com, Chrome shows NET::ERR_CERT_COMMON_NAME_INVALID.
>
> The usual causes: www and the bare domain treated as one name, a wildcard that doesn't reach far enough, or a server showing another site's certificate right after a move.
>
> We wrote a short fix guide, including a command that lists the names a certificate covers. Link in the comments.

**Caption (Facebook group version):**

> Reminder for anyone moving client sites to new hosting: example.com and www.example.com are two different names on a certificate. A certificate for one doesn't cover the other, and visitors get a full-page warning even though nothing has expired. Do you check both after a move?

**First comment (Page):**

> The fix guide, with the command that lists the names a certificate covers: [link for post 6]
>
> To see which names a site's certificate covers right now, the free SSL checker lists them: https://site-monitors.net/ssl-checker?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-2&utm_content=post-6-checker

**Reply to comments with:**
- "How do I see what my certificate covers?" The command in the guide, or the free SSL checker (it lists the names).
- "I only see it on some devices" It's often DNS still spreading after a move, so some visitors reach the old server. The guide covers it.
- "Is a wildcard enough?" A wildcard like `*.example.com` covers `www` and other first-level subdomains, but not the bare domain or deeper names. Both are in the guide.

**Story:** use `facebook-story-6.png` with a link sticker. Text over the sticker: "Fix it".

**For LinkedIn:** use the Page caption and end with a question: "Do you check both www and the bare domain after a move?" Add `#webdevelopment #ssl #agencyowners`.

**For X:** *A valid, unexpired SSL certificate can still show a full-page warning if it's for example.com and the visitor opens www.example.com. How to find and fix the mismatch:* (link in the same post).

**Track:** clicks to the new guide. This post is also your first source of visitors for that page, so check in Umami whether it gets any, and look at it in Search Console in a couple of weeks.

---

## After these three

- Compare posts 4 to 6 against 1 to 3 in Umami by `utm_campaign` and `utm_content`. Whichever style gets the most clicks (a question, a tool, or a fix guide), do more of that.
- If post 6 or 5 gets traction, that's a signal to write more narrow guides on specific errors. I can draft the next one.

---
---

# Posts 7 to 12 (the next two weeks)

Six more posts, three a week, with the same set of files for each: a post image (`facebook-post-7.png` to `-12.png`, 1200 x 630) and a story image (`facebook-story-7.png` to `-12.png`, 1080 x 1920). The tagged links use a new campaign name, `launch-posts-3`, so you can tell this batch apart in Umami.

All six images are illustrations with made-up names and carry an "Illustration" label. Keep the label, and don't swap in a real client's domain.

## The two-week schedule

Monday, Wednesday and Friday mornings. If posts 4 to 6 aren't up yet, slide the whole run back and keep the order.

| Week | Day | Post | Topic | Why this slot |
|---|---|---|---|---|
| 1 | Mon 30 Nov | 7 | The quiet client sites | A question to start the week, built for comments |
| 1 | Wed 2 Dec | 8 | Client email going to spam | A practical tip people save |
| 1 | Fri 4 Dec | 9 | SSL expired: four steps in order | The "Friday expiry" scenario, posted on a Friday |
| 2 | Mon 7 Dec | 10 | Auto-renew on, domain lapsed anyway | Relatable "has this bitten you?" post |
| 2 | Wed 9 Dec | 11 | The backup that stopped | Speaks to developers and sysadmins |
| 2 | Fri 11 Dec | 12 | Status pages for clients | The agency pitch, with the clearest paid-plan tie-in |

Post each story the same day as its post, or the day after.

## Before you post anything

- **Open each link once** from the tagged version below and check it loads. I couldn't reach the live site from the environment this was written in, so I haven't been able to confirm the guide pages are live. Every guide used here exists in the project and is listed in the sitemap.
- **Posts 11 and 12 mention paid plans.** Heartbeat monitors and status pages start on the Starter plan ($9 a month), and a status page on the client's own domain is on Pro ($29 a month) and above. The first comments say so plainly. These figures come from the site's pricing data, so re-check them if you change the plans.
- **Post 12's image says "your logo", not "their logo".** A separate logo for each client is an Agency plan feature, so the image and caption don't promise it to everyone.

| Post | Link for Facebook |
|---|---|
| 7 | `https://site-monitors.net/guides/monitor-client-websites?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-3&utm_content=post-7-quiet-sites` |
| 8 | `https://site-monitors.net/guides/check-spf-dkim-dmarc?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-3&utm_content=post-8-email-spam` |
| 9 | `https://site-monitors.net/guides/ssl-certificate-expired?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-3&utm_content=post-9-ssl-expired` |
| 10 | `https://site-monitors.net/guides/how-to-check-when-a-domain-expires?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-3&utm_content=post-10-autorenew` |
| 11 | `https://site-monitors.net/guides/monitor-cron-jobs-heartbeat?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-3&utm_content=post-11-heartbeat` |
| 12 | `https://site-monitors.net/guides/status-page-for-clients?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-3&utm_content=post-12-status-page` |

| Story | Link for the link sticker |
|---|---|
| 7 | `https://site-monitors.net/guides/monitor-client-websites?utm_source=facebook&utm_medium=story&utm_campaign=launch-posts-3&utm_content=story-7-quiet-sites` |
| 8 | `https://site-monitors.net/guides/check-spf-dkim-dmarc?utm_source=facebook&utm_medium=story&utm_campaign=launch-posts-3&utm_content=story-8-email-spam` |
| 9 | `https://site-monitors.net/guides/ssl-certificate-expired?utm_source=facebook&utm_medium=story&utm_campaign=launch-posts-3&utm_content=story-9-ssl-expired` |
| 10 | `https://site-monitors.net/guides/how-to-check-when-a-domain-expires?utm_source=facebook&utm_medium=story&utm_campaign=launch-posts-3&utm_content=story-10-autorenew` |
| 11 | `https://site-monitors.net/guides/monitor-cron-jobs-heartbeat?utm_source=facebook&utm_medium=story&utm_campaign=launch-posts-3&utm_content=story-11-heartbeat` |
| 12 | `https://site-monitors.net/guides/status-page-for-clients?utm_source=facebook&utm_medium=story&utm_campaign=launch-posts-3&utm_content=story-12-status-page` |

---

## Post 7: "Which client site hasn't anyone opened in months?"

**Image:** `marketing-images/facebook-post-7.png` (story: `facebook-story-7.png`)

**What the image shows:** a list of four made-up client sites (`bakery.example`, `dental.example`, `joinery.example`, `pta.example`) with up/down status, SSL days left and domain days left. One site is down with an expired certificate, one certificate has 9 days left and one domain has 18 days left.

**Alt text:** A list of four made-up client sites with their status, SSL expiry and domain expiry. One site is down with an expired certificate, one has a certificate expiring in 9 days, and one has a domain expiring in 18 days.

**Caption (your Page):**

> Which of your client sites hasn't anyone opened in months?
>
> Those are the ones that cause trouble. Nobody is looking at them, so a certificate runs out, a domain lapses or the site goes down, and the first you hear of it is the client's email.
>
> How do you keep an eye on the quiet ones? A list you check by hand, or something that tells you?
>
> We wrote up a routine for watching every client site from one place. Link in the comments.

**Caption (Facebook group version):**

> Question for anyone who looks after more than a handful of client sites: how do you keep an eye on the quiet ones, the sites nobody has opened in months? Those seem to be the ones where a certificate or domain lapses without anyone noticing. What's your routine?

**First comment (Page):**

> The routine for watching every client site from one place: [link for post 7]
>
> The free plan covers 5 sites if you'd like to try it.

**Reply to comments with:**
- "I check them by hand": ask how often, and whether it has ever missed one. Don't pitch yet.
- "A spreadsheet": that's fine. The guide's advice is to record who owns the domain, the DNS and the certificate for each client, and that works in a spreadsheet too.
- Someone mentions a client's domain in their own account: point to the guide's section on checking who owns each domain and certificate.

**Story:** use `facebook-story-7.png` with a link sticker. Text over the sticker: "Read the routine".

**For LinkedIn:** use the Page caption and end with "How do you keep an eye on the quiet ones?" Add `#agencylife #webdesign #wordpress`.

**For X:** *Managing 30 client sites from memory doesn't work. The sites that cause trouble are the quiet ones nobody has opened in months. A routine for watching all of them:* (link in the same post).

**Track:** comments and shares. This is a conversation post, like post 1. Copy the best replies into a note.

---

## Post 8: "Client emails going to spam? The website is fine."

**Image:** `marketing-images/facebook-post-8.png` (story: `facebook-story-8.png`)

**What the image shows:** an example "Show original" header view with SPF, DKIM and DMARC each marked FAIL, and a made-up sender, `billing@example.com`.

**Alt text:** An example "Show original" email header view with SPF, DKIM and DMARC each marked FAIL.

**Caption (your Page):**

> A client says their emails keep landing in spam. You check the website and it's fine.
>
> The cause is usually three DNS records that tell receiving mail servers a message is genuine: SPF, DKIM and DMARC. Since 2024, large mailbox providers have made them a requirement for anyone who sends in volume.
>
> A quick test: send an email from the client's domain to a Gmail address, open it, and choose "Show original". You want SPF: PASS, DKIM: PASS and DMARC: PASS at the top. Whichever one says FAIL is the record to fix.
>
> We wrote a guide to checking each one, with the commands. Link in the comments.

**Caption (Facebook group version):**

> Tip for anyone whose clients' emails land in spam: send a test message from their domain to a Gmail address, open it, choose Show original, and look for SPF, DKIM and DMARC all saying PASS. Whichever says FAIL is the record to fix. Does anyone have a favourite free DMARC report tool?

**First comment (Page):**

> How to check and fix SPF, DKIM and DMARC, with the commands: [link for post 8]
>
> If you'd like to be told when one of them breaks, the daily health scan on the Starter plan ($9 a month) flags a missing or weak SPF or DMARC record.

**Reply to comments with:**
- "What DMARC record should I start with?" A monitoring-only record: `v=DMARC1; p=none; rua=mailto:dmarc@example.com`. Tighten to `quarantine` or `reject` only after the reports show real mail passing.
- "I added a second SPF record and it got worse": a domain can have only one SPF record. The two have to be merged into one.
- "It passes but still goes to spam": other senders (an invoice tool or website form) may be missing from SPF or DKIM. The guide lists the common mistakes.

**Story:** use `facebook-story-8.png` with a link sticker. Text over the sticker: "Check the records".

**For LinkedIn:** use the Page caption. Add `#email #dns #webdevelopment`.

**For X:** *Client email going to spam and the site is fine? Send a test to Gmail, choose Show original, and look for SPF, DKIM and DMARC PASS. Whichever says FAIL is the one to fix:* (link in the same post).

**Track:** saves and link clicks. A tip like this tends to be saved for later.

---

## Post 9: "Your SSL certificate expired. Four steps, in order."

**Image:** `marketing-images/facebook-post-9.png` (story: `facebook-story-9.png`)

**What the image shows:** a numbered list of the four steps in the SSL expired guide: confirm it has expired, renew it the way it was issued, check the new certificate is the one served, and stop it happening again.

**Alt text:** A numbered list of four steps to fix an expired SSL certificate: confirm it has expired, renew it the way it was issued, check the new certificate is the one served, and stop it happening again.

**Caption (your Page):**

> Your SSL certificate expired and visitors are seeing a full-page warning. Four steps, in order:
>
> 1. Confirm it has expired. An SSL checker shows the expiry date, or you can read it from a terminal.
> 2. Renew it the way it was issued: your hosting panel, Cloudflare, Certbot, or the provider you bought it from.
> 3. Check the new certificate is the one being served. Reload the web server, and check every server behind a load balancer.
> 4. Stop it happening again. Monitor the certificate from outside, so you hear weeks before the date.
>
> Test the fix in a private browsing window, as a normal one can hold on to the old connection for a while. The full guide is in the comments.

**Caption (Facebook group version):**

> If a client's site suddenly shows a full-page security warning, check the SSL expiry date first. If it has expired: renew it the way it was issued, reload the web server, check every server behind a load balancer, and test in a private window. If it hasn't expired, it's usually a wrong device clock or a certificate for the wrong name. Happy to share the full steps.

**First comment (Page):**

> The full fix guide: [link for post 9]
>
> To check the expiry date and certificate chain right now, the free SSL checker needs no signup: https://site-monitors.net/ssl-checker?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-3&utm_content=post-9-checker
>
> And to get an email 30, 14, 7, 3 and 1 days before a certificate expires, the free plan covers 5 sites.

**Reply to comments with:**
- "I renewed it but visitors still see the warning": the server probably still holds the old certificate. Reload it, and check each server behind a load balancer.
- "It says valid but I still get the warning": check that device's date and time, and whether the certificate is for the right hostname (link to the post 6 guide, `/guides/err-cert-common-name-invalid`).
- "I use Certbot": point to `/guides/lets-encrypt-renewal-failed`.

**Story:** use `facebook-story-9.png` with a link sticker. Text over the sticker: "Fix it".

**For LinkedIn:** use the Page caption. Add `#ssl #sysadmin #agencyowners`.

**For X:** *SSL certificate expired? Four steps in order: confirm it, renew it the way it was issued, check the new cert is the one being served, then set up an alert so it doesn't happen again:* (link in the same post).

**Track:** link clicks to the guide and checker uses. A fix guide on a Friday should reach people who have a problem right now.

---

## Post 10: "Auto-renew is on. The domain lapsed anyway."

**Image:** `marketing-images/facebook-post-10.png` (story: `facebook-story-10.png`)

**What the image shows:** four reasons auto-renew can still fail, each with a red cross.

**Alt text:** A list of four reasons a domain can lapse even with auto-renew on: the card on file expired, warnings go to a former employee's inbox, the domain is in someone else's account, and auto-renew was never switched on.

**Caption (your Page):**

> Auto-renew is on. The domain lapsed anyway.
>
> It happens, and usually for one of four reasons:
>
> - The card on file expired or was declined.
> - Renewal and warning emails go to an address nobody reads any more, like a former employee's.
> - The domain is registered in someone else's account: a previous agency, a freelancer, or a client's personal login.
> - Auto-renew was never switched on, or was switched off during a transfer.
>
> When a domain lapses, the website and the email on it stop working together. And don't plan around grace periods: some registrars have none.
>
> Which of these has bitten you? Guide in the comments.

**Caption (Facebook group version):**

> For anyone who manages client domains: auto-renew still lets domains lapse. The usual causes are an expired card, renewal emails going to someone who has left, the domain being in a previous agency's or the client's own account, and auto-renew never being switched on. Which of these has caught you out?

**First comment (Page):**

> Why auto-renew still lets domains lapse, and how to find any domain's expiry date: [link for post 10]
>
> Free domain expiry checker, no signup: https://site-monitors.net/domain-checker?utm_source=facebook&utm_medium=social&utm_campaign=launch-posts-3&utm_content=post-10-checker

**Reply to comments with:**
- Someone shares a lapse story: thank them, and ask how they found out. Their answer is useful copy.
- "How do I stop it?" Put the expiry date somewhere you check yourself, and record which registrar account each client's domain is in. Whoever holds that account is the one who can renew it. The guide says both.
- Someone's domain is close to expiring: tell them to renew it first, before anything else.

**Story:** use `facebook-story-10.png` with a link sticker. Text over the sticker: "Read why".

**For LinkedIn:** use the Page caption and end with "Which of these has caught you out?" Add `#domains #agencylife #webdesign`.

**For X:** *Auto-renew was on and the domain lapsed anyway. Four usual reasons: expired card, emails to someone who left, a domain in someone else's account, auto-renew never switched on:* (link in the same post).

**Track:** comments. If people tell you which cause bit them, that shows you which one to write about next.

---

## Post 11: "Your backup stopped running last week. Nothing told you."

**Image:** `marketing-images/facebook-post-11.png` (story: `facebook-story-11.png`)

**What the image shows:** an example heartbeat monitor called "Nightly backup", marked Down with "No report for 3 days", and a cron line that sends a request after `backup.sh` runs. Labelled "Illustration. Example heartbeat."

**Alt text:** A heartbeat monitor called Nightly backup marked Down with no report for 3 days, above a cron line that sends a request to a ping address after the backup runs.

**Caption (your Page):**

> Your backup stopped running last week. Nothing told you.
>
> A website that's down is obvious. A nightly backup that stopped three weeks ago isn't, because nothing visible breaks. You find out the day you need the backup. An ordinary uptime check can't see it, because there's nothing to request.
>
> The fix is a heartbeat: the job reports in each time it runs, and you get an alert when a report doesn't arrive. In a cron job it's one extra request at the end, joined with && so it only fires when the job succeeded.
>
> We wrote up how to add it and which numbers to pick. Link in the comments.

**Caption (Facebook group version):**

> For anyone running scheduled jobs for clients (backups, imports, syncs): how do you know when one silently stops? I use a heartbeat. One request at the end of the job, and an alert if it doesn't arrive on time. Curious what other people do.

**First comment (Page):**

> How to add a heartbeat to a cron job, with the exact line to use: [link for post 11]
>
> Heartbeat monitors are on the Starter plan, $9 a month.

**Reply to comments with:**
- "What if the job fails but still runs?" That's what `&&` is for: the request is only sent when the job finishes without an error, so a failed backup sends no report and you're alerted.
- "I get false alarms": leave a bit more room than the job's usual run time, and match the schedule (a daily job is "every 1 day"). The guide covers it.
- "Can two jobs share one?" No. Give each job its own address, or a failing job hides behind the other's reports.

**Story:** use `facebook-story-11.png` with a link sticker. Text over the sticker: "See how".

**For LinkedIn:** use the Page caption. Add `#devops #sysadmin #backups`. It suits developer audiences more than agency owners.

**For X:** *Your backup stopped running last week and nothing told you. An uptime check can't see a job that went quiet. A heartbeat can: one request at the end of the cron job, and an alert if it doesn't arrive:* (link in the same post).

**For Reddit** (r/sysadmin, r/devops): don't post the image. Share the one-line `&& curl` pattern in words and put the guide link in a comment only where the rules allow it.

**Track:** clicks and comments from people who run servers. This is a paid-plan feature, so watch for signups that follow.

---

## Post 12: "Clients ask 'is my site up?' Answer before they do."

**Image:** `marketing-images/facebook-post-12.png` (story: `facebook-story-12.png`)

**What the image shows:** an example client status page: "Your Agency" logo, "All systems operational", a row of daily uptime bars with one amber day, no open incidents and no planned maintenance. Labelled "Illustration. Example status page."

**Alt text:** An example client status page showing All systems operational, a row of daily uptime bars with one amber day, no open incidents and no planned maintenance.

**Caption (your Page):**

> When a client's site has a problem, their first question is whether you know.
>
> A status page answers it before they ask: current status, how the last month went, and what you're doing about anything that's wrong. It also takes the "is it just me?" messages out of your inbox.
>
> Give each client one with your logo (or theirs, on the Agency plan), post updates as you work on an incident, and schedule maintenance so planned downtime doesn't look like an outage.
>
> Step-by-step guide in the comments.

**Caption (Facebook group version):**

> How do you answer "is the site down?" messages from clients? I've started giving each client a status page they can check themselves: current status, recent uptime and incident updates. Curious whether anyone else does this, and whether clients actually use it.

**First comment (Page):**

> Step-by-step guide, including putting the page on the client's own domain: [link for post 12]
>
> Status pages start on the Starter plan ($9 a month). A page on the client's own domain, like status.clientname.com, is on Pro ($29 a month) and above.

**Reply to comments with:**
- "Do clients actually look at it?" Be honest if you don't know yet. The guide's point is that it takes the "is it just me?" messages away, so ask what messages they get now.
- "Can it be on the client's own domain?" Yes, on Pro and above, with two DNS records. The guide has the exact records.
- "Does it show error details?" No. Only the site's name, its status and the updates you write are public.

**Story:** use `facebook-story-12.png` with a link sticker. Text over the sticker: "See the guide".

**For LinkedIn:** use the Page caption. Add `#agencylife #clientservice #webdesign`. This is your best agency-owner post of the batch.

**For X:** *When a client's site has a problem, their first question is whether you know. A status page answers it before they ask:* (link in the same post).

**Track:** clicks, and pricing page visits that follow. This post is the clearest step toward a paid plan.

---

## After the two weeks

- Compare posts 7 to 12 against earlier batches in Umami by `utm_campaign=launch-posts-3` and `utm_content`. The mix is deliberate: two conversation posts (7 and 10), two tips (8 and 9), and two paid-feature posts (11 and 12), so you can see which type earns the clicks.
- Whichever paid-feature post (11 or 12) gets more clicks is a candidate for a small ad budget. They match ads 8 and 6 in `MARKETING.md`.
- I can draft the next batch from what people say in the comments on 7 and 10.
