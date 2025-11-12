# Quick Deployment Plan - Open Control Mode
## Release: 2025-10-07-stable

**Version:** 0.9.0
**Platform:** GitHub Container Registry (GHCR)
**Mode:** Open Control - Tag & Build via GitHub Actions
**Date:** 2025-10-07

---

## Overview

This is a tag-driven deployment where creating a git tag automatically triggers the full CI/CD pipeline including build, push to GHCR, and automated smoke tests. The process respects Bolt platform constraints by avoiding schema changes and container orchestration modifications.

---

## Prerequisites

### 1. Environment Verification
- Current version in package.json: 0.9.0
- All local changes committed
- Working directory clean
- Remote repository accessible

### 2. GitHub Secrets Configured
Verify these secrets exist in repository settings:
- `PGHOST`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `BRIDGE_URL`
- `BRIDGE_KEY`
- `GITHUB_TOKEN` (automatically provided)

### 3. Permissions Check
- GitHub Actions enabled
- Packages: write permission granted
- Workflow dispatch permission available

---

## Deployment Steps

### Step 1: Create Release Tag

```bash
# Navigate to project root
cd /path/to/diabot

# Verify current status
git status
git log --oneline -5

# Create annotated tag with release notes
git tag -a release/2025-10-07-stable -m "Release 2025-10-07: Production stable build

- Version: 0.9.0
- Features: Core logging, AI Gateway, Chart visualization
- Security: RLS enabled on all tables
- Smoke tests: Automated via GitHub Actions
- Image: ghcr.io/diabotai/diabot:release-2025-10-07"

# Verify tag created
git tag -l "release/*"

# Push tag to trigger GitHub Actions
git push origin release/2025-10-07-stable
```

**What happens next:**
GitHub Actions workflow `.github/workflows/docker.yml` is automatically triggered and will:
1. Build Docker image
2. Tag as `ghcr.io/diabotai/diabot:release-2025-10-07`
3. Push to GitHub Container Registry
4. Run automated smoke tests
5. Generate build metadata report

---

### Step 2: Monitor GitHub Actions Build

```bash
# View workflow status in browser
open https://github.com/[YOUR_ORG]/diabot/actions

# Or monitor via CLI (if gh CLI installed)
gh run list --workflow=docker.yml --limit 1
gh run watch
```

**Expected Build Time:** 5-10 minutes

**Build Stages:**
1. Checkout code
2. Docker image build (multi-stage)
3. Push to GHCR
4. Metadata capture (checksum, digest)
5. Smoke test container startup
6. QA selftest execution
7. Core endpoint verification

---

### Step 3: Review Build Artifacts

Once build completes, check the GitHub Actions summary page:

**Artifacts to Verify:**
- Image path: `ghcr.io/diabotai/diabot:release-2025-10-07`
- Image checksum (SHA256)
- Image digest
- Commit SHA
- Build timestamp
- Workflow run URL

**Example Summary Output:**
```
### Build Metadata
- Image: ghcr.io/diabotai/diabot:release-2025-10-07
- Checksum: sha256:abc123...
- Digest: ghcr.io/diabotai/diabot@sha256:xyz789...
- Commit: a1b2c3d4
- Timestamp: 2025-10-07 14:23:45 UTC
- Workflow Run: https://github.com/.../actions/runs/12345
```

---

### Step 4: Post-Deployment Smoke Tests

After image is built and pushed, GitHub Actions automatically runs smoke tests:

#### A. QA Selftest (`/api/qa/selftest`)
```bash
# Automated in CI, but can test manually after deployment:
curl https://your-domain.com/api/qa/selftest | jq
```

**Expected Response:**
```json
{
  "meta": {
    "version": "0.9.0",
    "commit": "...",
    "branch": "..."
  },
  "stats": {
    "total": 3,
    "passed": 2,
    "failed": 0
  },
  "featureFlags": {
    "killSwitch": false
  }
}
```

#### B. Core Endpoints Check
```bash
# /auth/login - Should return 200
curl -I https://your-domain.com/auth/login

# /api/charts/bg - Should return 401 (unauthorized)
curl -I https://your-domain.com/api/charts/bg?range=7d

# /api/export - Should return 401 (unauthorized)
curl -I https://your-domain.com/api/export

# /api/health - Should return 200
curl https://your-domain.com/api/health
```

#### C. Static Chunks Verification
```bash
# Find a webpack chunk URL from page source
curl -I https://your-domain.com/_next/static/chunks/webpack-[hash].js

# Should return:
# HTTP/2 200
# cache-control: public, max-age=31536000, immutable
```

---

### Step 5: Deploy to Target Environment

#### Option A: Pull from GHCR (Recommended)
```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u [USERNAME] --password-stdin

# Pull the release image
docker pull ghcr.io/diabotai/diabot:release-2025-10-07

# Run container
docker run -d \
  --name diabot-prod \
  -p 80:3000 \
  --env-file .env.production \
  ghcr.io/diabotai/diabot:release-2025-10-07

# Verify health
curl http://localhost/api/health
curl http://localhost/api/qa/selftest
```

#### Option B: Docker Compose (Production)
```bash
# Update docker-compose.production.yml with new image tag
sed -i 's/image: .*/image: ghcr.io\/diabotai\/diabot:release-2025-10-07/' docker-compose.production.yml

# Deploy
docker compose -f docker-compose.production.yml up -d

# Check logs
docker compose -f docker-compose.production.yml logs -f
```

#### Option C: Kubernetes (if applicable)
```yaml
# Update deployment manifest
spec:
  containers:
  - name: diabot
    image: ghcr.io/diabotai/diabot:release-2025-10-07
    imagePullPolicy: Always
```

```bash
kubectl apply -f k8s/deployment.yaml
kubectl rollout status deployment/diabot
```

---

### Step 6: Post-Deployment Verification

Run comprehensive smoke test suite:

```bash
# Run full smoke test
./scripts/smoke_full.sh https://your-domain.com

# Or individual test suites
./scripts/smoke_chunks.sh https://your-domain.com
./scripts/smoke_endpoints.sh https://your-domain.com

# Check specific features
npm run auth:check
npm run meal:check
```

**Expected Results:**
- All health checks pass
- Authentication flows work
- Core logging endpoints secured
- Charts render correctly
- CSV export available to authenticated users

---

### Step 7: Fill QA Freeze Report

Update `QA_FREEZE_REPORT_2025_10_07.md` with actual results:

```bash
# Copy build metadata from GitHub Actions summary
# Fill in test results from smoke tests
# Update status fields from PENDING to PASS/FAIL
# Add actual HTTP response codes
# Record performance metrics
# Capture test execution logs
```

**Required Data Points:**
- Commit SHA
- Image checksum
- Image digest
- GitHub Actions run URL
- Test pass/fail counts
- HTTP response codes
- Response times
- Error logs (if any)

---

## Rollback Procedure

If issues are found after deployment:

### Quick Rollback
```bash
# Stop current container
docker stop diabot-prod

# Start previous stable version
docker run -d \
  --name diabot-prod \
  -p 80:3000 \
  --env-file .env.production \
  ghcr.io/diabotai/diabot:release-2025-09-30-stable

# Verify rollback
curl http://localhost/api/qa/selftest | jq '.meta.version'
```

### Git Rollback
```bash
# Remove problematic tag
git tag -d release/2025-10-07-stable
git push origin :refs/tags/release/2025-10-07-stable

# Tag previous commit if needed
git checkout [PREVIOUS_COMMIT]
git tag -a release/2025-10-07-stable-rollback -m "Rollback"
git push origin release/2025-10-07-stable-rollback
```

---

## Bolt Platform Constraints

**What we DON'T do:**
- No database schema changes (migrations already applied)
- No Docker network modifications
- No volume changes
- No container orchestration changes
- No Postgres container manipulation

**What we DO do:**
- Build and tag new application image
- Push to GHCR
- Run automated smoke tests
- Update application container only
- Verify via API endpoints

---

## Success Criteria

### Build Phase
- ✅ Docker image builds successfully
- ✅ Image pushed to GHCR
- ✅ Image checksum recorded
- ✅ Build metadata captured

### Test Phase
- ✅ Container starts within 60 seconds
- ✅ Health check responds 200
- ✅ QA selftest passes (2/3 minimum)
- ✅ Core endpoints secured (401)
- ✅ Static chunks load (200 + cache headers)

### Deployment Phase
- ✅ Image deployed to target environment
- ✅ Service accessible from internet
- ✅ Authentication flows work
- ✅ No ChunkLoadError
- ✅ RLS enforced on all queries

---

## Evidence Collection

### Automated (from GitHub Actions)
- Build logs (automatically saved)
- Smoke test results (in workflow summary)
- Image metadata (checksum, digest)
- Workflow run URL

### Manual
- Post-deployment smoke test output
- Response time measurements
- Screenshot of /auth/login page
- Screenshot of /chart page
- CSV export sample file

### Storage
Store all evidence in:
- `QA_FREEZE_REPORT_2025_10_07.md` (primary)
- GitHub Actions artifacts (automated)
- Local `backups/2025-10-07/` directory

---

## Timeline

**Estimated Total Time:** 30-45 minutes

```
00:00 - Create and push tag (2 min)
00:02 - GitHub Actions trigger and start (1 min)
00:03 - Docker build stage (5-8 min)
00:11 - Push to GHCR (2-3 min)
00:14 - Smoke tests run (5 min)
00:19 - Review results and approve (5 min)
00:24 - Pull image and deploy (3 min)
00:27 - Post-deployment verification (10 min)
00:37 - Fill QA report and sign-off (5 min)
00:42 - Complete
```

---

## Troubleshooting

### Issue: GitHub Actions fails to trigger
**Solution:**
```bash
# Verify tag format
git tag -l "release/*"

# Check workflow file syntax
cat .github/workflows/docker.yml | grep "tags:"

# Manually trigger workflow
gh workflow run docker.yml
```

### Issue: Build fails during Docker build
**Solution:**
```bash
# Check build logs in GitHub Actions
# Common causes:
# - Missing dependencies in package.json
# - TypeScript errors (should be ignored)
# - Network timeout

# Test build locally
npm run build
docker build -t test .
```

### Issue: Smoke tests fail
**Solution:**
```bash
# Check specific failure from GitHub Actions logs
# Common failures:
# - AI Gateway (expected without OPENAI_API_KEY)
# - Postgres connection (check secrets)
# - Timeout (increase wait time)

# Verify environment variables
curl http://localhost:3000/api/qa/selftest | jq '.items'
```

### Issue: Image won't pull from GHCR
**Solution:**
```bash
# Verify authentication
echo $GITHUB_TOKEN | docker login ghcr.io -u [USER] --password-stdin

# Check image exists
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://ghcr.io/v2/[ORG]/diabot/tags/list

# Try with full digest
docker pull ghcr.io/diabotai/diabot@sha256:[DIGEST]
```

---

## Contact & Escalation

**GitHub Actions Failure:**
- Check workflow logs
- Review recent commits
- Contact: DevOps Team

**Deployment Issues:**
- Review container logs: `docker logs diabot-prod`
- Check health endpoint: `curl /api/health`
- Contact: Platform Team

**Security Concerns:**
- RLS not enforcing
- Unauthorized access
- Contact: Security Team

---

**Plan Status:** READY FOR EXECUTION
**Last Updated:** 2025-10-07
**Next Review:** After successful deployment
