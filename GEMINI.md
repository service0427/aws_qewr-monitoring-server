# GEMINI Project Instructions: Qewr Monitoring Server

## Project Overview
The `qewr-monitoring-server` is a development workspace designed for building and deploying monitoring services to AWS. Due to resource constraints (t2.nano/micro) on the AWS instances, this project follows a **"Develop Locally, Deploy Selectively"** architectural pattern.

- **Primary Goal:** Provide a lightweight monitoring solution for `*.qewr.link`.
- **Target Environment:** AWS Ubuntu instances (13.125.105.188).
- **Deployment Strategy:** Surgical synchronization of source files to the remote server, excluding heavy development artifacts and local configurations.

## Development & Deployment Workflow

### Prerequisites
- SSH access to the AWS instance using `qewr.pem` (located at `/home/tech/aws/pem/qewr.pem`).
- Local environment variables configured in `.env`.

### Key Commands
- **Deploy to AWS:**
  ```bash
  ./deploy.sh
  ```
  This script uses `rsync` to sync the current directory to `~/qewr-monitoring-server` on the remote host. It automatically excludes `.git`, `.env`, `node_modules`, and other development-only files.

- **Git Management:**
  The project is backed up to `https://github.com/service0427/aws`. Ensure all commits are pushed to the `master` branch.

## Project Structure & Conventions

### Directory Layout
- `/home/tech/aws/qewr-monitoring-server/`: Root development directory.
- `deploy.sh`: Core deployment utility.
- `.env`: **PRIVATE** configuration. Never commit or deploy this file.
- `.gitignore`: Configured to protect secrets (`.env`, `.pem`).

### Coding Standards
- **Lightweight Implementation:** Since the target server is resource-constrained, avoid heavy frameworks or large dependency chains unless strictly necessary.
- **Environment Driven:** Use the `.env` file for all environment-specific configurations (IPs, tokens, paths).
- **Surgical Updates:** Only upload the minimum required source files to the AWS server.
- **PM2 & Port Management (MANDATORY):** 
    - The server hosts multiple active services. 
    - Before adding any new service to **PM2**, you MUST verify existing port usage using `netstat` or `ss` on the remote server.
    - Never use a port that is already occupied by another service.

## Future Development Notes (TODO)
- [ ] Initialize the actual monitoring server logic (e.g., Node.js, Python, or Go).
- [ ] Set up domain routing for `*.qewr.link`.
- [ ] Implement health check and logging mechanisms.
