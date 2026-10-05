# Release verification and idle recovery

KAN-11 adds operational checks without changing hosting or the database. Delivery is complete only after the live checks match the merged source. Current implementation status is in [project status](project-status.md).

## Read-only release checks

| Check                  | Meaning                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| API `/health`          | Process responds; does not prove database availability                   |
| API `/ready`           | A bounded database ping succeeded: 200 ready or 503 unavailable          |
| API `/release`         | Commit embedded from the actual build checkout; unknown means unverified |
| Client `/release.json` | Client build commit and the public API base URL used by that build       |

After merge, compare both commits to the merge SHA and the client API target to the intended Render service. Check main CI and provider deployment status separately. Metadata reports source identity, not a security attestation. Local builds with uncommitted edits still name their HEAD; a clean committed checkout and CI are required release evidence.

```powershell
Invoke-RestMethod https://taskforge-alpha-six.vercel.app/release.json -TimeoutSec 30
Invoke-RestMethod https://taskforge-api-rp2m.onrender.com/release -TimeoutSec 45
Invoke-WebRequest https://taskforge-api-rp2m.onrender.com/ready -SkipHttpErrorCheck -TimeoutSec 45
```

`/health` remains Render's configured health check. Do not switch it to readiness without a separate operational decision. Readiness returns no connection strings, database names, credentials, or internal error details. A probe deadline limits the response; shared probes prevent concurrent requests from spawning unlimited database work.

## Preview boundary

A Vercel preview is a client deployment, not an isolated API or database. Read its `/release.json` before QA. If `apiBaseUrl` is the production Render URL, perform read-only checks there. CORS success does not establish data isolation. Write QA uses a disposable local API/database; credentials and production data stay out of fixtures. No dashboard environment changes are part of KAN-11.

## Returning after idle

Render free services sleep after 15 minutes without inbound traffic and may take about a minute to wake. Wake the existing URL, then retry the read-only health/readiness checks after it responds. If Render reports a suspended service, inspect its dashboard and free usage limits before changing anything. [Render free service limits](https://render.com/docs/free).

Atlas automatically pauses inactive Free clusters after 30 days. Connecting restores monitoring when only monitoring has paused; a fully paused cluster needs manual resume in Atlas. Check `Cluster0` in the owner's dashboard, choose Resume when paused, and wait for availability before checking readiness again. Avoid deleting or recreating the cluster. [Atlas pause and resume](https://www.mongodb.com/docs/atlas/pause-terminate-cluster/).

The current $0 plan supports manual recovery after prolonged inactivity. It cannot guarantee an unattended, always-available API after months: no paid upgrade, keepalive scheduler, automatic cluster administration, or new credentials are introduced. Record a failed readiness response and recovery time; do not present liveness alone as database recovery.

## Backup and recovery

Atlas Free clusters have no managed Atlas backups. Use MongoDB Database Tools `mongodump` for a private encrypted/offline export before a long absence, and `mongorestore` only into an isolated destination to rehearse recovery. [Atlas backup limitations](https://www.mongodb.com/docs/atlas/backup-restore-cluster/).

- Keep the credential config and export outside this repository; never commit either. Confirm the archive is readable and record its date and checksum privately.
- Validate collection/document counts in an isolated local database, including tasks, projects, agents, users, and ownership links. Tests that mock Mongoose do not demonstrate restore correctness.
- Production restore, destructive options, data migration, new credentials or paid services require a separate owner decision. KAN-11 performs no export, restore, production writes, seed or cluster administration.
- A backup/restore rehearsal requires an available isolated MongoDB plus a synthetic archive. If unavailable, record that limitation rather than claiming an actual production backup or restore was verified.

## Safe runbook rehearsal

Automated tests simulate disconnected, healthy, failed, timed-out and recovered database probes. A local built API smoke run can verify release metadata and liveness without a real database; readiness is 503 while disconnected. Compare the built client metadata to HEAD and a controlled public API URL. This checks instructions and operational contracts without changing production data.
