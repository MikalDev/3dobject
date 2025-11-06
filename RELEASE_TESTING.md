# Testing the New GitHub Actions Release Workflow

This document provides instructions for testing the new automated release workflow.

## Pre-release Testing (Recommended First Step)

To test the workflow without creating an official release, create a beta/pre-release:

### Step 1: Prepare a Test Version

```bash
# Update to a beta version
npm run version:bump 2.82.1-beta.1

# Review the changes
git diff

# Commit the changes
git add -A
git commit -m "chore: test release workflow with beta version"
```

### Step 2: Create and Push the Test Tag

```bash
# Create a beta tag
git tag v2.82.1-beta.1

# Push the changes and tag
git push && git push origin v2.82.1-beta.1
```

### Step 3: Monitor the GitHub Actions

1. Go to https://github.com/MikalDev/3dobject/actions
2. Watch the "Release" workflow execute
3. Check for any errors in the build process

### Step 4: Verify the Pre-release

1. Go to https://github.com/MikalDev/3dobject/releases
2. You should see a new pre-release for v2.82.1-beta.1
3. Download the .c3addon file and test it in Construct 3

## Full Release Testing

Once the pre-release test is successful, you can create a full release:

```bash
# Update to the next version
npm run version:bump 2.83.0

# Commit
git add -A
git commit -m "chore: bump version to 2.83.0"

# Tag and push
git tag v2.83.0
git push && git push origin v2.83.0
```

## Troubleshooting

### If the workflow fails:

1. **Check the Actions log**: https://github.com/MikalDev/3dobject/actions
2. **Common issues**:
   - Version mismatch: Ensure all version files are synchronized
   - Missing dependencies: Check if `terser` is installed
   - Build script issues: Test locally with `npm run build`

### To delete a test tag (if needed):

```bash
# Delete local tag
git tag -d v2.82.1-beta.1

# Delete remote tag
git push origin :refs/tags/v2.82.1-beta.1
```

## Manual Workflow Trigger (Advanced)

If you need to manually trigger the workflow for testing:

1. Go to https://github.com/MikalDev/3dobject/actions/workflows/release.yml
2. Click "Run workflow" (if available)
3. Select the branch and provide the tag name

Note: The release workflow is designed to trigger on tags, so manual triggers may require workflow modifications.

## Checklist Before First Official Release

- [ ] Test with a beta/pre-release version
- [ ] Verify the .c3addon file works in Construct 3
- [ ] Check that release notes are generated correctly
- [ ] Confirm the download link works
- [ ] Test the build validation workflow on a PR
- [ ] Document any issues found and resolved

## Next Steps After Testing

1. **Clean up old dist/ files** (optional):
   ```bash
   # Remove dist/ from git history (reduces repo size)
   git rm -r dist/
   git commit -m "chore: remove built files from repository"
   ```

2. **Upload historical releases** (optional):
   - Manually create releases for important historical versions
   - Upload the corresponding .c3addon files from your local dist/

3. **Update documentation**:
   - Update any external documentation or wiki pages
   - Inform users about the new download location