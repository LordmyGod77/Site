# Updating Apartment Platform: one SSD project

You do not need a separate project copy for every version. GitHub tracks code history; your operating project remains at:

- D:\ApartmentPlatform-vNext-foundation\ApartmentPlatform-vNext (private project, branch apartment-platform-source).
- D:\ApartmentPlatform-vNext-foundation\ApartmentPlatform-vNext\ApartmentPlatform-Website (website, separate repository, branch main).

The Desktop Manager, Windows scraper and other PC utilities continue to use those existing folders.

## Review first

Review draft pull requests:
- Website: https://github.com/LordmyGod77/Site/pull/2
- Private API and scraper: https://github.com/LordmyGod77/BusinessDOCS/pull/1

GitHub PRs show changes and review history; they are not by themselves proof the Windows programs work. Check dependencies, run automated tests, and run PC-specific smoke tests before merging.

SYNC_TO_SSD.bat is now a REVIEW-ONLY button. It fetches approved-branch Git history and prints incoming code changes. It never creates a new project copy or changes tracked operating files. Draft PR changes are visible on GitHub but not in approved branches before merge.

If a change must be tested on Windows without disturbing a working scraper, use ONE temporary reusable test environment and remove it after verifying its status. The updater never creates testing copies itself.

## Apply approved changes in place

Only after relevant PRs pass tests, staging dependencies are ready, and the PRs have been merged into their target GitHub branches:

1. Close your Desktop Manager, scraper, and other processes that use project files.
2. Save and commit any local source edits. Do not discard changes.
3. Double-click APPLY_APPROVED_UPDATES.bat from the refreshed website preview initially, and later from the website checkout inside the main project.
4. Type APPLY to confirm.

The script verifies the two repository origins, correct active branches, clean tracked files, and fast-forward history before changing either repository. It saves a local checkpoint tag (a tiny Git reference to the previous source commit), then updates files IN PLACE. No clones or worktree copies, no cloud deployment, no D1 migration.

If it refuses, stop and check the error. Never use reset --hard, git clean or force push to bypass a safety check.

## Cross-component review

When changing location/media/account/scraper code, inspect the D1 schema, internal Worker endpoints, the scraper's write path, Desktop Manager consumers, website listing/tour pages, SEO generator, Firebase account access and the guest-card bridge. Keep private property names and exact addresses off anonymous APIs.

## What Git cannot restore

Git tracks committed code, not D1 or R2 production contents, runtime/generated files, passwords/secrets, or external service configuration. Back up those systems before database or deployment changes. For shared code, use a reviewed revert commit for rollback instead of rewriting public history.

Earlier _review\GitHub worktrees (if an older button created them) are not deleted automatically. Confirm they contain no unsaved work before cleanup.

## Current status

Both feature PRs remain drafts, not merged. Firebase and Cloudflare staging integration has not yet been activated, so do not assume the real media, renter accounts, guest-card sending or public search is ready for production.
