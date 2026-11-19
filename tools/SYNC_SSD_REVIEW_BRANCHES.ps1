# Apartment Platform SSD Git updater (review by default; apply ONLY with -Apply).
# Does not clone repositories, create worktrees, stash, reset, clean, force-push or deploy.
# Both repositories remain in their existing locations on the D: SSD.
param(
  [string]$ProjectRoot = "D:\ApartmentPlatform-vNext-foundation\ApartmentPlatform-vNext",
  [switch]$Apply
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Bash = "D:\bin\bash.exe"
if (-not (Test-Path -LiteralPath $Bash)) { throw "Git Bash missing at $Bash" }

$Root = ([IO.Path]::GetFullPath($ProjectRoot)).TrimEnd([char]'\')
$SiteRepo = Join-Path $Root "ApartmentPlatform-Website"
$Repos = @(
  @{ Name="Private platform"; Path=$Root; OwnerRepo="BusinessDOCS"; Branch="apartment-platform-source" },
  @{ Name="Website"; Path=$SiteRepo; OwnerRepo="Site"; Branch="main" }
)

function UnixPath([string]$value) {
  $full = [IO.Path]::GetFullPath($value)
  if ($full -notmatch '^([A-Za-z]):[\\/](.*)$') { throw "Not a supported Windows drive path: $value" }
  return "/" + $Matches[1].ToLowerInvariant() + "/" + ($Matches[2] -replace '\\','/')
}
function QuoteBash([string]$value) {
  return "'" + $value.Replace("'", "'\''") + "'"
}
function BashRun([string]$command) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $Bash "-lc" $command 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $old
  }
  if ($exitCode -ne 0) {
    throw ("Git stopped with exit code " + $exitCode + ": " + $command + [Environment]::NewLine + ($output -join [Environment]::NewLine))
  }
  return ($output -join [Environment]::NewLine).Trim()
}
function Git([string]$directory, [string]$command) {
  $path = UnixPath $directory
  $windowsPath = ([IO.Path]::GetFullPath($directory)).Replace([char]'\', [char]'/')
  # Respect Git for Windows ownership checks in either pathname format.
  return BashRun ("git -c safe.directory=" + (QuoteBash $windowsPath) +
    " -c safe.directory=" + (QuoteBash $path) +
    " -C " + (QuoteBash $path) + " " + $command)
}
function VerifyRepo([hashtable]$spec) {
  if (-not (Test-Path -LiteralPath (Join-Path $spec.Path ".git"))) { throw "Not a Git checkout: $($spec.Path)" }
  $expected = UnixPath $spec.Path
  $actual = (Git $spec.Path "rev-parse --show-toplevel").TrimEnd("/")
  # Git for Windows may return D:/folder, while Bash uses /d/folder.
  if ($actual -match '^[A-Za-z]:/') { $actual = UnixPath $actual }
  if ($actual -ine $expected.TrimEnd("/")) { throw "Unexpected checkout root: $actual" }
  $remote = Git $spec.Path "remote get-url origin"
  $pattern = "(?i)github\.com[:/]+LordmyGod77/" + [regex]::Escape($spec.OwnerRepo) + "(\.git)?$"
  if ($remote -notmatch $pattern) { throw "Unexpected remote for $($spec.Name): $remote" }
}
Write-Host ""
Write-Host "Apartment Platform | GitHub source update" -ForegroundColor Cyan
Write-Host "Operating project: $Root"
Write-Host ("Mode: " + $(if ($Apply) { "APPLY APPROVED COMMITS IN PLACE" } else { "REVIEW ONLY - no working files changed" }))
Write-Host ""

# Preflight both repositories before updating either one.
$plans = @()
foreach ($spec in $Repos) {
  VerifyRepo $spec
  $remoteRef = "refs/remotes/origin/" + $spec.Branch
  $fetchSpec = "refs/heads/" + $spec.Branch + ":" + $remoteRef
  [void](Git $spec.Path ("fetch origin " + (QuoteBash $fetchSpec)))
  $branch = Git $spec.Path "branch --show-current"
  $localSha = Git $spec.Path "rev-parse HEAD"
  $remoteSha = Git $spec.Path ("rev-parse " + (QuoteBash $remoteRef))
  $dirty = Git $spec.Path "status --porcelain --untracked-files=no"
  $hasChanges = $localSha -ne $remoteSha
  Write-Host ("[" + $spec.Name + "] Branch: " + $branch + ", expected: " + $spec.Branch) -ForegroundColor Cyan
  Write-Host ("  Current: " + $localSha.Substring(0,12) + " | GitHub: " + $remoteSha.Substring(0,12))
  if ($dirty) { Write-Host "  Local tracked modifications are present. They will not be overwritten." -ForegroundColor Yellow }
  if ($hasChanges) {
    Write-Host "  Proposed incoming changes:" -ForegroundColor White
    $log = Git $spec.Path ("log --oneline -n 10 HEAD.." + (QuoteBash $remoteRef))
    if ($log) { Write-Host $log }
    $summary = Git $spec.Path ("diff --stat HEAD " + (QuoteBash $remoteRef))
    if ($summary) { Write-Host $summary }
  } else {
    Write-Host "  Already current with approved GitHub branch." -ForegroundColor Green
  }
  if ($Apply) {
    if ($branch -cne $spec.Branch) { throw "Wrong active branch for $($spec.Name). No project files changed." }
    if ($dirty) { throw "Uncommitted tracked edits in $($spec.Name). Commit/review them before applying. No project files changed." }
    if ($hasChanges) {
      try { [void](Git $spec.Path ("merge-base --is-ancestor HEAD " + (QuoteBash $remoteRef))) }
      catch { throw "Local and remote history diverged in $($spec.Name). Fast-forward is unsafe; nothing has been applied." }
    }
  }
  $plans += @{ Spec=$spec; Ref=$remoteRef; HasChanges=$hasChanges; LocalSha=$localSha }
}
if (-not $Apply) {
  Write-Host ""
  Write-Host "REVIEW FINISHED. No extra folders, worktrees or project copies were created." -ForegroundColor Green
  Write-Host "Review draft code in GitHub Pull Requests. Only run APPLY_APPROVED_UPDATES.bat after the PRs are tested and merged." -ForegroundColor Yellow
  exit 0
}

# Git tags are tiny references to the prior commit, NOT extra project copies.
$tagTime = Get-Date -Format "yyyyMMdd-HHmmss"
foreach ($plan in $plans) {
  if (-not $plan.HasChanges) { continue }
  $spec = $plan.Spec
  $suffix = $spec.OwnerRepo.ToLowerInvariant()
  $tag = "ssd-before-approved-update-" + $tagTime + "-" + $suffix
  [void](Git $spec.Path ("tag " + (QuoteBash $tag) + " HEAD"))
  Write-Host ("Backup checkpoint tag: " + $tag) -ForegroundColor DarkCyan
  [void](Git $spec.Path ("merge --ff-only " + (QuoteBash $plan.Ref)))
  Write-Host ("Updated working files IN PLACE: " + $spec.Path) -ForegroundColor Green
}
Write-Host ""
Write-Host "Source update complete. No extra copies, no Cloudflare deployment, no database writes." -ForegroundColor Green
Write-Host "Run the desktop scraper/manager smoke tests and website preview checks before deploying any changes." -ForegroundColor Yellow
