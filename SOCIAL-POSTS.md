# First 3 social posts for site-monitors.net

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
