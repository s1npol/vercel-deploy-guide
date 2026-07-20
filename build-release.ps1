$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$distRoot = Join-Path $projectRoot "dist"
$releaseRoot = Join-Path $projectRoot "release\github-pages"
$node = Get-Command node -ErrorAction Stop

& $node.Source (Join-Path $projectRoot "scripts\build-release.mjs")
if ($LASTEXITCODE -ne 0) {
  throw "Production build failed."
}

if (-not $releaseRoot.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Release path escaped the project root."
}

if (Test-Path -LiteralPath $releaseRoot) {
  Remove-Item -LiteralPath $releaseRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null

Get-ChildItem -LiteralPath $distRoot -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $releaseRoot -Recurse -Force
}

$releaseFiles = Get-ChildItem -LiteralPath $releaseRoot -Recurse -File
$size = ($releaseFiles | Measure-Object -Property Length -Sum).Sum
Write-Output "GitHub Pages mirror ready: $releaseRoot"
Write-Output "Files: $($releaseFiles.Count)"
Write-Output ("Size: {0:N2} MB" -f ($size / 1MB))
