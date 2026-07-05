param(
  [Parameter(Mandatory=$false)]
  [string]$AppRepo = "foggygoofball/reelview-final",

  [Parameter(Mandatory=$false)]
  [string]$Owner = "foggygoofball",

  [Parameter(Mandatory=$false)]
  [string]$SyncRepoName = "reelview-sync-data",

  [Parameter(Mandatory=$false)]
  [string]$Branch = "main",

  [Parameter(Mandatory=$false)]
  [string]$PathPrefix = "history-sync",

  [Parameter(Mandatory=$false)]
  [switch]$CreateSyncRepo
)

$ErrorActionPreference = 'Stop'

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command '$name' is not installed or not in PATH."
  }
}

Require-Command gh

Write-Host "Checking GitHub CLI auth..." -ForegroundColor Cyan
gh auth status | Out-Null

$syncRepo = "$Owner/$SyncRepoName"

if ($CreateSyncRepo) {
  Write-Host "Creating sync repo: $syncRepo" -ForegroundColor Cyan
  gh repo create $syncRepo --public --disable-issues --disable-wiki --description "ReelView history sync storage" --confirm

  $readme = @"
# ReelView Sync Data

This repository stores per-user watch history sync files for ReelView.
"@

  $tmp = New-TemporaryFile
  Set-Content -Path $tmp -Value $readme -NoNewline -Encoding UTF8

  gh api "repos/$syncRepo/contents/README.md" --method PUT --field message="init sync repo" --field content="$( [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($readme)) )" --field branch="$Branch" | Out-Null

  Remove-Item $tmp -ErrorAction SilentlyContinue
}

Write-Host "Setting repository variables on $AppRepo" -ForegroundColor Cyan
gh variable set VITE_SYNC_GITHUB_OWNER --repo $AppRepo --body $Owner
gh variable set VITE_SYNC_GITHUB_REPO --repo $AppRepo --body $SyncRepoName
gh variable set VITE_SYNC_GITHUB_BRANCH --repo $AppRepo --body $Branch
gh variable set VITE_SYNC_GITHUB_PATH_PREFIX --repo $AppRepo --body $PathPrefix

Write-Host "Enter fine-grained token (input hidden)." -ForegroundColor Yellow
$secure = Read-Host "Token" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Token cannot be empty."
}

gh secret set VITE_SYNC_GITHUB_TOKEN --repo $AppRepo --body $token

Write-Host "Done. Variables and secret configured for $AppRepo" -ForegroundColor Green
Write-Host "Next: run your deploy workflow so Pages rebuilds with sync config." -ForegroundColor Green
