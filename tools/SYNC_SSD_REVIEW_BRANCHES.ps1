# SYNC_SSD_REVIEW_BRANCHES.ps1
# Read-only for operating project checkouts: fetch + refresh detached review worktrees.
# Requires Git for Windows Bash at D:\bin\bash.exe; no force, reset, clean or merge.
param([string]$ProjectRoot = "D:\ApartmentPlatform-vNext-foundation\ApartmentPlatform-vNext")
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Bash = "D:\bin\bash.exe"
if (-not (Test-Path -LiteralPath $Bash)) {
  throw "Git Bash not found at $Bash. Install Git for Windows or adjust this script's Bash path."
}
$Root = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd("\")
$SiteRepo = Join-Path $Root "ApartmentPlatform-Website"
$ReviewRoot = Join-Path $Root "_review\GitHub"
if (-not (Test-Path -LiteralPath (Join-Path $Root ".git"))) { throw "Private repository missing in $Root" }
if (-not (Test-Path -LiteralPath (Join-Path $SiteRepo ".git"))) { throw "Website repository missing in $SiteRepo" }

function UnixPath([string]$WindowsPath) {
  $full = [IO.Path]::GetFullPath($WindowsPath)
  if ($full -notmatch '^([A-Za-z]):[\\/](.*)$') { throw "Expected a Windows drive path: $WindowsPath" }
  return "/" + $Matches[1].ToLowerInvariant() + "/" + ($Matches[2] -replace '\\','/')
}
function Q([string]$value) {
  return "'" + $value.Replace("'", "'\''") + "'"
}
function BashRun([string]$command) {
  # Windows PowerShell 5.1 treats Git's normal fetch/status stderr progress as
  # NativeCommandError. Use the actual process exit code for success/failure.
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try { $output = & $Bash "-lc" $command 2>&1 }
  finally { $ErrorActionPreference = $previousPreference }
  if ($LASTEXITCODE -ne 0) {
    throw ("Git operation stopped safely (exit " + $LASTEXITCODE + "): " + $command + [Environment]::NewLine + ($output -join [Environment]::NewLine))
  }
  return ($output -join [Environment]::NewLine).Trim()
}
function GitRun([string]$repo,[string]$args) {
  $posix = UnixPath $repo
  return BashRun ("git -c safe.directory=" + (Q $posix) + " -C " + (Q $posix) + " " + $args)
}
function EnsureExpectedRemote([string]$repo,[string]$name) {
  $remote = GitRun $repo "remote get-url origin"
  if ($remote -notmatch ("(?i)github\.com[:/]+LordmyGod77/" + [regex]::Escape($name) + "(\.git)?$")) {
    throw "Wrong origin for $name, so no sync was performed: $remote"
  }
}
function SyncOne([string]$repo,[string]$name,[string]$branch,[string]$outputDir) {
  Write-Host ("Checking " + $name + " / " + $branch) -ForegroundColor Cyan
  EnsureExpectedRemote $repo $name
  $ref = "refs/remotes/origin/" + $branch
  $target = UnixPath $outputDir
  $remoteBranch = "refs/heads/" + $branch + ":" + $ref
  [void](GitRun $repo ("fetch origin " + (Q $remoteBranch)))
  if (Test-Path -LiteralPath $outputDir) {
    if (-not (Test-Path -LiteralPath (Join-Path $outputDir ".git"))) {
      throw "Preview destination already exists but is not a Git worktree: $outputDir"
    }
    $found = GitRun $outputDir "rev-parse --show-toplevel"
    if ($found.TrimEnd("/") -ine $target.TrimEnd("/")) {
      throw "Preview folder belongs to a different repository: $found"
    }
    $dirty = GitRun $outputDir "status --porcelain"
    if ($dirty) {
      throw ("Uncommitted preview changes found at " + $outputDir + ". Nothing was overwritten: " + $dirty)
    }
    [void](GitRun $outputDir ("switch --detach " + (Q $ref)))
  } else {
    [void](GitRun $repo ("worktree add --detach " + (Q $target) + " " + (Q $ref)))
  }
  $sha = GitRun $outputDir "rev-parse --short HEAD"
  Write-Host ("Synced: " + $outputDir + " (" + $sha + ")") -ForegroundColor Green
}
# Keep review worktrees out of the active project's Git commit without changing
# the tracked .gitignore or deleting/copying any operating project files.
$exclude = Join-Path $Root ".git\info\exclude"
if (-not (Test-Path -LiteralPath $exclude)) { throw "Main repository Git exclude file missing: $exclude" }
$existing = Get-Content -LiteralPath $exclude -Raw
if ($existing -notmatch '(?m)^/_review/?$') { Add-Content -LiteralPath $exclude -Value "/_review/" }
New-Item -ItemType Directory -Force -Path $ReviewRoot | Out-Null

SyncOne $SiteRepo "Site" "feature/search-housing-types-second-chance-20261114" (Join-Path $ReviewRoot "Site")
SyncOne $Root "BusinessDOCS" "feature/renter-public-api-v1-20261114" (Join-Path $ReviewRoot "Platform")
Write-Host "Both preview branches are on the SSD inside your main project folder." -ForegroundColor Green
Write-Host ("View Site: " + (Join-Path $ReviewRoot "Site\listings\index.html"))
Write-Host ("Review Cloudflare Worker code: " + (Join-Path $ReviewRoot "Platform\cloud-worker\src"))
Write-Host "Your operating Desktop Manager, scraper, production Worker files and existing website checkout were NOT overwritten."
