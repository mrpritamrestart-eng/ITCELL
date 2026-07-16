$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetFile = Join-Path $scriptDir "app\stationery-bills\permission-comparative\bill-calculations\page.tsx"

Write-Host ""
Write-Host "ITCELL - Permission Item Order Fix" -ForegroundColor Cyan
Write-Host "Target: $targetFile"
Write-Host ""

if (-not (Test-Path -LiteralPath $targetFile)) {
    Write-Host "ERROR: Required page.tsx file nahi mili." -ForegroundColor Red
    Write-Host "Dono fix files ko extracted ITCELL project ke root folder me rakhein." -ForegroundColor Yellow
    Write-Host "Root folder wahi hai jahan package.json aur app folder present hain." -ForegroundColor Yellow
    exit 1
}

$content = [System.IO.File]::ReadAllText($targetFile)

$oldPattern = @'
return\s+Array\.from\(\s*
\s*combined\.values\(\)\s*
\s*\)\.sort\(\(a,\s*b\)\s*=>\s*
\s*a\.itemName\.localeCompare\(\s*
\s*b\.itemName\s*
\s*\)\s*
\s*\);
'@

$regex = [System.Text.RegularExpressions.Regex]::new(
    $oldPattern,
    [System.Text.RegularExpressions.RegexOptions]::Multiline
)

$matches = $regex.Matches($content)

if ($matches.Count -eq 0) {
    $alreadyFixedPattern = 'return\s+Array\.from\(\s*combined\.values\(\)\s*\);'
    $stillHasAlphabeticalSort = $content -match 'combined\.values\(\)\s*\)\.sort\('

    if (($content -match $alreadyFixedPattern) -and (-not $stillHasAlphabeticalSort)) {
        Write-Host "Fix already applied hai. Koi change required nahi tha." -ForegroundColor Green
        exit 0
    }

    Write-Host "ERROR: Expected alphabetical sorting block nahi mila." -ForegroundColor Red
    Write-Host "File ka code repository version se alag ho sakta hai; koi automatic change nahi kiya gaya." -ForegroundColor Yellow
    exit 1
}

if ($matches.Count -gt 1) {
    Write-Host "ERROR: Sorting block ek se adhik jagah mila. Safety ke liye change roka gaya." -ForegroundColor Red
    exit 1
}

$replacement = @'
/*
       * Map apna insertion order preserve karta hai.
       * Isliye items permission page par saved/original
       * order me hi Bill Calculations page par dikhenge.
       */
      return Array.from(
        combined.values()
      );
'@

$backupFile = "$targetFile.before-item-order-fix.bak"
Copy-Item -LiteralPath $targetFile -Destination $backupFile -Force

$updatedContent = $regex.Replace($content, $replacement, 1)

if ($updatedContent -eq $content) {
    Write-Host "ERROR: File content update nahi hua." -ForegroundColor Red
    exit 1
}

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($targetFile, $updatedContent, $utf8WithoutBom)

$verifyContent = [System.IO.File]::ReadAllText($targetFile)
$verifyFixed = $verifyContent -match 'return\s+Array\.from\(\s*combined\.values\(\)\s*\);'
$verifyOldRemoved = -not ($verifyContent -match 'combined\.values\(\)\s*\)\.sort\(')

if (-not ($verifyFixed -and $verifyOldRemoved)) {
    Copy-Item -LiteralPath $backupFile -Destination $targetFile -Force
    Write-Host "ERROR: Verification fail hui. Original file backup se restore kar di gayi." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SUCCESS: Item order fix apply ho gaya." -ForegroundColor Green
Write-Host "Alphabetical sorting hata di gayi hai." -ForegroundColor Green
Write-Host "Ab Bill Calculations page permission page ka original item order follow karega." -ForegroundColor Green
Write-Host ""
Write-Host "Backup created:" -ForegroundColor Cyan
Write-Host $backupFile
Write-Host ""
