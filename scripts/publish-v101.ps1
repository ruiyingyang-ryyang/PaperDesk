$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'GitHub connection failed. No changes were pushed.' }
git push origin main
if ($LASTEXITCODE -ne 0) { throw 'Branch push failed. Resolve the reported Git error before continuing.' }
git push origin v1.0.1
if ($LASTEXITCODE -ne 0) { throw 'Version tag push failed. Check the remote tag before retrying.' }
Write-Output 'GitHub received main and v1.0.1. The Windows build workflow will validate, build and publish the release.'
