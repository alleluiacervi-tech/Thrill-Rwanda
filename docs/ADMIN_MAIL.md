# Admin mail (Spacemail)

The shared company mailbox (`contact@thrillrwanda.com`) inside the admin dashboard at **Admin > Mail**.
It reads and sends over ordinary IMAP and SMTP, so nothing is stored in our database. The mailbox is the single source of truth: anything done here also shows in any other mail app signed in to it.

## Turning it on

Set these in the host's environment (Vercel project settings, or the env file the VPS container reads). Never commit them.

| Variable | Value |
| --- | --- |
| `MAIL_USER` | `contact@thrillrwanda.com` |
| `MAIL_PASSWORD` | the mailbox password |
| `MAIL_FROM_NAME` | optional, default `Thrill Rwanda` |
| `MAIL_IMAP_HOST`, `MAIL_IMAP_PORT` | optional, default `mail.spacemail.com`, `993` |
| `MAIL_SMTP_HOST`, `MAIL_SMTP_PORT` | optional, default `mail.spacemail.com`, `465` (587 uses STARTTLS) |

Spacemail's server is `mail.spacemail.com` for both IMAP and SMTP. (`imap.spacemail.com` and `smtp.spacemail.com` do not work.)
Until `MAIL_USER` and `MAIL_PASSWORD` are set, the page shows a setup panel instead of the inbox.

## What it does

- Folders: Inbox, Unread, Favorites (starred, across folders), Drafts, Sent, Spam, Archive, Trash.
- Read, search (sender, subject, text), page through, star, mark read/unread, archive, report spam, move, delete (trash first; deleting from Trash or Spam is permanent), empty Trash/Spam.
- Compose, reply, reply all, forward. Rich text, Cc/Bcc, attachments (20 MB total, 15 files), draft autosave, `Ctrl+Enter` to send.
- A copy of every sent message is filed in Sent. Forwarding and editing a draft carry the attachments over.
- New mail appears on its own every minute while the tab is open.

## Safety

- Administrators only, re-checked from the database on every request.
- Received HTML is sanitised and shown in a sandboxed frame with no scripts and a content policy. Remote images are hidden until the reader chooses to load them (they reveal when a message was opened).
- Attachments always download; they are never rendered on our origin.
- Sending and saving drafts go through a route handler that also checks the request came from our own site.
- The activity log records sends (recipients and subject, never the body) and permanent deletions.
- The password is only used on the server and never reaches the browser or the logs.

## Speed

Signing in to the mail server takes about 5 seconds; every command after that is well under one. One signed-in connection is kept per server process and closed after 90 idle seconds. On the VPS (a long-lived process) that makes clicks quick. On a serverless host each cold request reconnects, which is slower but correct.

## Limits to know

- Spam filtering is the mail provider's; "Report spam" only moves the message.
- Folders other than the six above are not shown.
- Search is a server-side IMAP search, so large mailboxes search more slowly.

## Tests

`npm test` runs the offline unit tests. To run the live suite against the real mailbox (it sends one message to itself and deletes everything it created):

```
MAIL_LIVE_TEST=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run src/lib/mail/mail.live.test.ts
```
