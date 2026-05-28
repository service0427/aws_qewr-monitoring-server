# GEMINI Project Instructions: Qewr Monitoring Server

## Project Overview
The `qewr-monitoring-server` is an advanced, lightweight monitoring solution for `*.qewr.link`. It is designed to track dozens of remote servers using a 2-column mobile-first dashboard and a robust Python-based agent (`psutil`).

- **Target Environment:** AWS Ubuntu instances (nano/micro).
- **Primary Repo:** `https://github.com/service0427/aws_qewr-monitoring-server` (This specific service is isolated here).
- **Installer Repo:** `https://github.com/service0427/init` (Contains the `install.sh` and `agent.py` for client rollout).

## Security & Secrets (CRITICAL)
- **Shared Secrets:** The GitHub token and AWS PEM keys (`qewr.pem`) are managed centrally in the parent directory (`/home/tech/aws/.env` and `/home/tech/aws/pem/`).
- **Local Isolation:** Do NOT copy `.env` or `.pem` files into this project folder.
- **Port Management:** Before adding any new service to **PM2** on AWS, you MUST verify existing port usage using `netstat` or `ss` to prevent conflicts.

## Development & Deployment Workflow
### Local Development
- Run the FastAPI server locally: `./venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000`
- Features include live caching disablement (`Cache-Control: no-store`) and 10-second auto-refresh.

### Deployment Strategy ("Develop Locally, Deploy Selectively")
1. Test everything locally first.
2. Ensure changes are pushed to `aws_qewr-monitoring-server`.
3. Use the `deploy.sh` script to surgically sync only the source files to the remote AWS instance via `rsync`.
4. **Important:** The remote AWS server uses Nginx to reverse proxy port 443 to the PM2 instance on port 8000. SSL is handled by Let's Encrypt. Do NOT bind FastAPI directly to port 80 or 443.

### Client Installation
- Run on target client: `curl -sSL https://raw.githubusercontent.com/service0427/init/main/install.sh | sudo bash`
- Enforces `U*` hostname pattern (must start with 'U') and automates Tailscale auth and crontab registration (`/etc/cron.d/`).