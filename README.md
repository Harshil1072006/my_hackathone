# Swap Hack

Swap Hack is a free hackathon for adults in and around Kheda, Gujarat. Participants share real problems, and verified builders get seven days to build for a different, anonymous brief. The website includes the public event pages, participant and judge workspaces, organizer controls, results and certificate verification.

## Run locally

With Docker and Compose installed, run this from the project folder.

```sh
docker compose up --build
```

Open <http://localhost:8787>. Choose **Try the demo** to walk through a fictional event. Each browser session gets its own demo data. To try registration, select **New participant** and use fictional details. To exercise the review flow, open the organizer view and move the event to **Testing and judging**, then switch to a pain finder or judge. To try the certificate checker, enter `DEMO-SWAP-26`.

The Compose service binds to the local machine and stores D1 data in a Docker volume. For a local-only live workspace, visit <http://localhost:8787/workspace?organizer=1> and enter `swap-hack-local-organizer`. The local sign-in form shows email codes on screen.

On Node.js 24 or later, use these commands to run without Docker.

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run dev
```

## Deploy to Cloudflare

1. Install dependencies using `npm ci`, then run `npx wrangler login` with your Cloudflare account.
2. Run `npx wrangler d1 create swap-hack`. Copy the returned database UUID into `d1_databases[0].database_id` in `wrangler.jsonc`.
3. Run `npx wrangler d1 migrations apply DB --remote`.
4. Run `npm run deploy`. Wrangler prints the public Worker URL. Registration starts in the draft phase.
5. Use `npx wrangler secret put ADMIN_KEY` to set a long, random organizer key. Set `RESEND_API_KEY` and `MAIL_FROM` with the same command for each name. `MAIL_FROM` is the sender, such as `Swap Hack <event@your-domain.example>`, on a domain verified with Resend. Leave local-code mode in the local Docker or Wrangler configuration.
6. On the deployed site, open `/workspace?organizer=1`. Configure the dates, finale venue, organizer name, contact, retention date and approved terms and privacy notice. Set your peer count, pain finder cap, group cap and judge rubric. Choose **Registration open** when the event is ready.

You can add a custom domain under the Worker's Cloudflare Domains & Routes settings. Run `npx wrangler deploy --dry-run` to check packaging without publishing.

## Operate the event

- In **Entries and briefs**, review participant eligibility, screen problem briefs and remove any details that could identify an author. Use the reserve status for spare briefs. The organized review of college enrollment and age evidence takes place privately. Record the outcome in the workspace.
- In **Match builders**, shuffle approved briefs or assign one manually. Open **Build week** to release the briefs. Builders can submit their plan, prototype and final project, and relay up to three questions through the organizer.
- In **Review and results**, add the judges' email addresses and share the workspace URL with them. Run prechecks on the project, video length, repository history and anonymity. Queue reviews once the entries pass. Review criteria lock when judging opens.
- Confirm three eligible judge scores for each project that should be ranked. The judge score is doubled when the author supplies no rating. The top three can be published with opt-in public names. A verified pain finder whose brief produced the highest-ranked eligible solution can receive the Best Problem award.
- Issue certificates from **Certificates** after publishing the results. A verification URL can be shared or printed from the certificate page. Get the recipient's permission before issuing.

The Worker manages phase changes from the organizer screen. The reference timeline is relative to the event start. Help requests, document checks and event-day arrangements remain organizer responsibilities. English is the site interface language. Problem briefs accept English, Gujarati and Hindi.

## Storage

The D1 migration sets up event state, sessions, sign-in codes and rate limits. The app hosts one live event. Demo sessions are isolated and expire after four hours. Live records are sized for a local, single-event hackathon. The organizer workflow currently supports a live event up to 1.75 MB of event state. The scheduled Worker clears expired sessions and demo data and applies the configured contact-data retention date after results. Public credits and certificate verification records remain available as published.

The frontend bundles Bricolage Grotesque, DM Sans and IBM Plex Mono locally. See `THIRD_PARTY/` for font licences.
