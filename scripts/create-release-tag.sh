#!/bin/bash
# create-release-tag.sh
# Script to create and push release tag for Anora deployment
# Usage: ./scripts/create-release-tag.sh

set -e

RELEASE_TAG="release/2025-10-07-stable"
VERSION="0.9.0"
IMAGE_NAME="ghcr.io/diabotai/diabot:release-2025-10-07"

echo "=========================================="
echo "Anora Release Tag Creator"
echo "=========================================="
echo "Release Tag: $RELEASE_TAG"
echo "Version: $VERSION"
echo "Target Image: $IMAGE_NAME"
echo "=========================================="
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ ERROR: Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  WARNING: You have uncommitted changes"
    git status --short
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted by user"
        exit 1
    fi
fi

# Show current branch and last commits
echo "📋 Current Git Status:"
echo "Branch: $(git branch --show-current)"
echo "Last 5 commits:"
git log --oneline -5
echo ""

# Check if tag already exists locally
if git tag -l | grep -q "^${RELEASE_TAG}$"; then
    echo "⚠️  WARNING: Tag '$RELEASE_TAG' already exists locally"
    read -p "Delete and recreate? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "$RELEASE_TAG"
        echo "✅ Local tag deleted"
    else
        echo "❌ Aborted by user"
        exit 1
    fi
fi

# Check if tag exists on remote
if git ls-remote --tags origin | grep -q "refs/tags/${RELEASE_TAG}"; then
    echo "⚠️  WARNING: Tag '$RELEASE_TAG' already exists on remote"
    read -p "Delete remote tag and recreate? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push origin ":refs/tags/${RELEASE_TAG}"
        echo "✅ Remote tag deleted"
    else
        echo "❌ Aborted by user"
        exit 1
    fi
fi

# Confirm before creating tag
echo ""
echo "📦 About to create annotated tag:"
echo "   Tag: $RELEASE_TAG"
echo "   Commit: $(git rev-parse --short HEAD)"
echo "   Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo ""
read -p "Proceed with tag creation? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted by user"
    exit 1
fi

# Create annotated tag
echo ""
echo "🏷️  Creating annotated tag..."

git tag -a "$RELEASE_TAG" -m "Release 2025-10-07: Production stable build

Version: $VERSION
Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Commit: $(git rev-parse --short HEAD)

Features:
- Core logging (BG, Water, Meal, Insulin, BP, Weight)
- AI Gateway with rule-based fallback
- Chart visualization (7d, 30d)
- CSV export functionality
- Profile management

Security:
- Row Level Security enabled on all tables
- Authentication enforcement on protected endpoints
- Middleware properly configured for static assets

Build:
- Docker multi-stage build with Node 20 Alpine
- Target image: $IMAGE_NAME
- Registry: GitHub Container Registry (GHCR)

Smoke Tests:
- Automated via GitHub Actions
- QA selftest endpoint
- Core endpoint verification
- Static asset validation

Deployment:
- Tag-driven CI/CD via GitHub Actions
- Automated build and push to GHCR
- Post-deployment verification included

Constraints:
- No schema changes (migrations already applied)
- No container orchestration changes
- Bolt platform compatible"

echo "✅ Tag created successfully"

# Show tag details
echo ""
echo "📋 Tag Details:"
git show "$RELEASE_TAG" --no-patch
echo ""

# Confirm before pushing
read -p "Push tag to remote? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "⚠️  Tag created locally but NOT pushed to remote"
    echo "   To push later, run: git push origin $RELEASE_TAG"
    exit 0
fi

# Push tag to remote
echo ""
echo "📤 Pushing tag to remote..."
git push origin "$RELEASE_TAG"

echo ""
echo "=========================================="
echo "✅ Release tag created and pushed!"
echo "=========================================="
echo ""
echo "📊 Next Steps:"
echo "1. Monitor GitHub Actions workflow:"
echo "   https://github.com/$(git config --get remote.origin.url | sed 's/.*:\(.*\)\.git/\1/')/actions"
echo ""
echo "2. Wait for build to complete (~5-10 minutes)"
echo ""
echo "3. Review build artifacts:"
echo "   - Image: $IMAGE_NAME"
echo "   - Checksum: (will be in GitHub Actions summary)"
echo "   - Smoke test results: (will be in workflow logs)"
echo ""
echo "4. Fill QA Freeze Report:"
echo "   - Update: QA_FREEZE_REPORT_2025_10_07.md"
echo "   - Copy metadata from GitHub Actions summary"
echo "   - Record test results"
echo ""
echo "5. Deploy image:"
echo "   docker pull $IMAGE_NAME"
echo "   docker run -d -p 80:3000 --env-file .env.production $IMAGE_NAME"
echo ""
echo "6. Run post-deployment verification:"
echo "   ./scripts/verify-deployment.sh https://your-domain.com"
echo ""
echo "=========================================="
echo "🎉 Tag push successful!"
echo "GitHub Actions should now be building..."
echo "=========================================="
