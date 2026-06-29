# Qewr Monitoring Server

## Production Architecture
- **Target URL:** `https://qewr.link` (Resolves to AWS 13.125.105.188)
- **Web Server:** Nginx reverse proxy routing port 80/443 to internal port 8000.
- **SSL Certificate:** Free Let's Encrypt certificate auto-renewing via `/etc/cron.d/certbot-renew`.
- **Application Server:** FastAPI + Uvicorn managed by PM2 (`qewr-api` process).
- **Database:** Local MariaDB (`qewr` / `Tech1324`) on the AWS instance.

## Agent Installation
Agents are installed on remote nodes via a single command. The source code for the installer is managed in the `github-init/` directory (linked to the `init` repository). The script enforces that the hostname must not be 'tech', auto-installs Tailscale, and configures a cron job.

```bash
curl -sSL https://raw.githubusercontent.com/service0427/init/main/install.sh | sudo bash
```

## Repositories
- **Main App:** `https://github.com/service0427/aws_qewr-monitoring-server` (This project)
- **Installer Script:** `https://github.com/service0427/init` (Managed locally in `github-init/`)
