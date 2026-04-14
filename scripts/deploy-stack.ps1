param(
    [switch]$SkipAppDeploy,
    [switch]$SkipLandingDeploy,
    [switch]$SkipVerify,
    [switch]$RequireLandingFresh
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-Step {
    param([string]$Message)
    Write-Host "[deploy] $Message" -ForegroundColor Cyan
}

$script:SupportsUseBasicParsing = $null
function Invoke-WebRequestCompat {
    param(
        [string]$Uri,
        [string]$Method = 'Get',
        [int]$TimeoutSec = 30
    )

    if ($null -eq $script:SupportsUseBasicParsing) {
        $command = Get-Command Invoke-WebRequest -ErrorAction Stop
        $script:SupportsUseBasicParsing = $command.Parameters.ContainsKey('UseBasicParsing')
    }

    $requestArgs = @{
        Uri = $Uri
        Method = $Method
        TimeoutSec = $TimeoutSec
    }

    if ($script:SupportsUseBasicParsing) {
        $requestArgs.UseBasicParsing = $true
    }

    return Invoke-WebRequest @requestArgs
}

function Set-EnvVarIfMissing {
    param(
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return
    }

    $current = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ([string]::IsNullOrWhiteSpace($current)) {
        [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
    }
}

function Import-EnvFile {
    param([string]$FilePath)

    if (-not (Test-Path -LiteralPath $FilePath)) {
        return
    }

    $loadedCount = 0
    foreach ($line in (Get-Content -LiteralPath $FilePath)) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith('#')) {
            continue
        }

        $envMatch = [regex]::Match($trimmed, '^(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<value>.*)$')
        if (-not $envMatch.Success) {
            continue
        }

        $name = $envMatch.Groups['name'].Value
        $value = $envMatch.Groups['value'].Value.Trim()
        if ($value.Length -ge 2 -and (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        )) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $before = [Environment]::GetEnvironmentVariable($name, 'Process')
        Set-EnvVarIfMissing -Name $name -Value $value
        $after = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ([string]::IsNullOrWhiteSpace($before) -and -not [string]::IsNullOrWhiteSpace($after)) {
            $loadedCount += 1
        }
    }

    Write-Step ("Loaded $loadedCount deploy env vars from " + (Split-Path -Leaf $FilePath))
}

function Invoke-HttpGet {
    param(
        [string]$Url,
        [int]$MaxAttempts = 1,
        [int]$RetryDelaySeconds = 0
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            return Invoke-WebRequestCompat -Uri $Url -Method 'Get' -TimeoutSec 30
        }
        catch {
            if ($attempt -ge $MaxAttempts) {
                throw "HTTP GET failed for $Url :: $($_.Exception.Message)"
            }

            $statusCode = $null
            try {
                $statusCode = [int]$_.Exception.Response.StatusCode.value__
            }
            catch {
            }

            if ($statusCode) {
                Write-Warning "Attempt $attempt/$MaxAttempts failed for $Url (status $statusCode). Retrying in $RetryDelaySeconds seconds..."
            }
            else {
                Write-Warning "Attempt $attempt/$MaxAttempts failed for $Url. Retrying in $RetryDelaySeconds seconds..."
            }

            if ($RetryDelaySeconds -gt 0) {
                Start-Sleep -Seconds $RetryDelaySeconds
            }
        }
    }
}

function Invoke-SshCommand {
    param(
        [string]$Target,
        [string]$RemoteCommand,
        [string]$Secret
    )
    if (-not [string]::IsNullOrWhiteSpace($Secret)) {
        $sshArgs = @(
            '-o', 'PreferredAuthentications=password',
            '-o', 'PubkeyAuthentication=no',
            '-o', 'StrictHostKeyChecking=no',
            $Target,
            $RemoteCommand
        )

        $sshpass = Get-Command sshpass -ErrorAction SilentlyContinue
        if (-not $sshpass) {
            throw 'sshpass is required for password-based deploy. Install sshpass or use SSH keys.'
        }

        & sshpass -p $Secret ssh @sshArgs
    }
    else {
        $sshArgs = @(
            '-o', 'StrictHostKeyChecking=no',
            $Target,
            $RemoteCommand
        )

        & ssh @sshArgs
    }
}

function Get-AllJsPathsFromHtml {
    param([string]$Html)
    $pathMatches = [regex]::Matches($Html, '/_next/static/[^"'']+\.js')
    $paths = @()
    foreach ($m in $pathMatches) {
        $paths += $m.Value
    }
    return $paths | Select-Object -Unique
}

function Test-AppPricing {
    param([string]$AppBaseUrl)

    $registroUrl = "$AppBaseUrl/registro"
    $registro = Invoke-HttpGet -Url $registroUrl
    $paths = Get-AllJsPathsFromHtml -Html $registro.Content

    $starter39 = $false
    $starter150 = $false
    $basic59 = $false
    $basic450 = $false

    foreach ($p in $paths) {
        try {
            $js = (Invoke-WebRequestCompat -Uri ("$AppBaseUrl$p") -Method 'Get' -TimeoutSec 30).Content
        }
        catch {
            continue
        }

        if ($js -match 'starter:\{nombre:"I.{0,80}precio:39e3') { $starter39 = $true }
        if ($js -match 'starter:\{nombre:"I.{0,180}maxClientes:150') { $starter150 = $true }
        if ($js -match 'basic:\{nombre:"B.{0,80}precio:59e3') { $basic59 = $true }
        if ($js -match 'basic:\{nombre:"B.{0,180}maxClientes:450') { $basic450 = $true }
    }

    return [pscustomobject]@{
        Url = $registroUrl
        Starter39 = $starter39
        Starter150 = $starter150
        Basic59 = $basic59
        Basic450 = $basic450
    }
}

function Test-LandingPricing {
    param([string]$LandingBaseUrl)

    $landingUrl = "$LandingBaseUrl/"
    $landingResponse = Invoke-HttpGet -Url $landingUrl
    $html = $landingResponse.Content
    $paths = Get-AllJsPathsFromHtml -Html $html

    # Scope checks to Starter/Inicial and Basic markers to avoid matching other tiers.
    $starterPrice = [bool]($html -match 'Inicial.{0,120}\$39\.000|key:"inicial".{0,120}mensual:39e3|planKey:"starter".{0,120}mensual:39e3')
    $starterLimit = [bool]($html -match 'Inicial.{0,260}150 clientes|key:"inicial".{0,260}150 clientes|planKey:"starter".{0,260}150 clientes|maxClientes:150')
    $basicPrice = [bool]($html -match 'Básico.{0,120}\$59\.000|key:"basico".{0,120}mensual:59e3|planKey:"basic".{0,120}mensual:59e3')
    $basicLimit = [bool]($html -match 'Básico.{0,260}450 clientes|key:"basico".{0,260}450 clientes|planKey:"basic".{0,260}450 clientes|maxClientes:450')

    foreach ($p in $paths) {
        try {
            $js = (Invoke-WebRequestCompat -Uri ("$LandingBaseUrl$p") -Method 'Get' -TimeoutSec 30).Content
        }
        catch {
            continue
        }

        if ($js -match 'key:"inicial".{0,120}mensual:39e3|planKey:"starter".{0,120}mensual:39e3|Inicial.{0,120}\$39\.000') { $starterPrice = $true }
        if ($js -match 'key:"inicial".{0,260}150 clientes|planKey:"starter".{0,260}150 clientes|Inicial.{0,260}150 clientes|maxClientes:150') { $starterLimit = $true }
        if ($js -match 'key:"basico".{0,120}mensual:59e3|planKey:"basic".{0,120}mensual:59e3|Básico.{0,120}\$59\.000') { $basicPrice = $true }
        if ($js -match 'key:"basico".{0,260}450 clientes|planKey:"basic".{0,260}450 clientes|Básico.{0,260}450 clientes|maxClientes:450') { $basicLimit = $true }
    }

    return [pscustomobject]@{
        Url = $landingUrl
        StarterPrice = $starterPrice
        StarterLimit = $starterLimit
        BasicPrice = $basicPrice
        BasicLimit = $basicLimit
    }
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$envFiles = @(
    (Join-Path $repoRoot '.env.deploy.local'),
    (Join-Path $repoRoot '.env.deploy')
)
foreach ($envFile in $envFiles) {
    Import-EnvFile -FilePath $envFile
}

$appBaseUrl = if ($env:APP_BASE_URL) { $env:APP_BASE_URL.TrimEnd('/') } else { 'https://app.control-finanzas.com' }
$landingBaseUrl = if ($env:LANDING_BASE_URL) { $env:LANDING_BASE_URL.TrimEnd('/') } else { 'https://control-finanzas.com' }
$deployScript = if ($env:DEPLOY_SCRIPT_PATH) { $env:DEPLOY_SCRIPT_PATH } else { '/home/deploy-sistema.sh' }
$landingDeployScript = if ($env:LANDING_DEPLOY_SCRIPT_PATH) { $env:LANDING_DEPLOY_SCRIPT_PATH } else { '/home/deploy-landing.sh' }

if (-not $SkipAppDeploy) {
    if ([string]::IsNullOrWhiteSpace($env:DEPLOY_SSH_USER) -or [string]::IsNullOrWhiteSpace($env:DEPLOY_SSH_HOST)) {
        throw 'Missing DEPLOY_SSH_USER or DEPLOY_SSH_HOST.'
    }

    $target = "$($env:DEPLOY_SSH_USER)@$($env:DEPLOY_SSH_HOST)"
    Write-Step "Deploying app repo on $target with script $deployScript"
    Invoke-SshCommand -Target $target -RemoteCommand "bash $deployScript" -Secret $env:DEPLOY_SSH_PASSWORD
    if ($LASTEXITCODE -ne 0) {
        throw "App deploy command failed with exit code $LASTEXITCODE."
    }
    Write-Step 'App deploy command finished.'
}
else {
    Write-Step 'Skipping app deploy.'
}

$landingTriggered = $false
if (-not $SkipLandingDeploy) {
    if (-not [string]::IsNullOrWhiteSpace($env:LANDING_DEPLOY_HOOK_URL)) {
        Write-Step 'Triggering landing deploy hook.'
        $resp = Invoke-WebRequestCompat -Uri $env:LANDING_DEPLOY_HOOK_URL -Method 'Post' -TimeoutSec 30
        Write-Step ("Landing hook status: " + [int]$resp.StatusCode)
        $landingTriggered = $true
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:LANDING_DEPLOY_SSH_USER) -and -not [string]::IsNullOrWhiteSpace($env:LANDING_DEPLOY_SSH_HOST)) {
        $landingTarget = "$($env:LANDING_DEPLOY_SSH_USER)@$($env:LANDING_DEPLOY_SSH_HOST)"
        Write-Step "Deploying landing repo on $landingTarget with script $landingDeployScript"
        Invoke-SshCommand -Target $landingTarget -RemoteCommand "bash $landingDeployScript" -Secret $env:LANDING_DEPLOY_SSH_PASSWORD
        if ($LASTEXITCODE -ne 0) {
            throw "Landing deploy command failed with exit code $LASTEXITCODE."
        }
        Write-Step 'Landing deploy command finished.'
        $landingTriggered = $true
    }
    else {
        Write-Warning 'Landing deploy skipped: set LANDING_DEPLOY_HOOK_URL or LANDING_DEPLOY_SSH_USER + LANDING_DEPLOY_SSH_HOST.'
    }
}
else {
    Write-Step 'Skipping landing deploy.'
}

if (-not $SkipVerify) {
    Write-Step 'Running post-deploy checks.'

    # PM2 restart can produce brief 503 responses while the app warms up.
    $health = Invoke-HttpGet -Url "$appBaseUrl/api/health" -MaxAttempts 8 -RetryDelaySeconds 5
    $appCheck = Test-AppPricing -AppBaseUrl $appBaseUrl
    $landingCheck = Test-LandingPricing -LandingBaseUrl $landingBaseUrl

    Write-Output ''
    Write-Output '=== DEPLOY CHECKS ==='
    Write-Output ("APP_HEALTH_STATUS={0}" -f [int]$health.StatusCode)
    Write-Output ("APP_STARTER_PRICE_39={0}" -f $appCheck.Starter39)
    Write-Output ("APP_STARTER_LIMIT_150={0}" -f $appCheck.Starter150)
    Write-Output ("APP_BASIC_PRICE_59={0}" -f $appCheck.Basic59)
    Write-Output ("APP_BASIC_LIMIT_450={0}" -f $appCheck.Basic450)
    Write-Output ("LANDING_STARTER_PRICE_39={0}" -f $landingCheck.StarterPrice)
    Write-Output ("LANDING_STARTER_LIMIT_150={0}" -f $landingCheck.StarterLimit)
    Write-Output ("LANDING_BASIC_PRICE_59={0}" -f $landingCheck.BasicPrice)
    Write-Output ("LANDING_BASIC_LIMIT_450={0}" -f $landingCheck.BasicLimit)

    $okApp = ([int]$health.StatusCode -eq 200) -and $appCheck.Starter39 -and $appCheck.Starter150 -and $appCheck.Basic59 -and $appCheck.Basic450
    if (-not $okApp) {
        throw 'App verification failed: expected starter=39k/150 and basic=59k/450.'
    }

    $okLanding = $landingCheck.StarterPrice -and $landingCheck.StarterLimit -and $landingCheck.BasicPrice -and $landingCheck.BasicLimit
    if ($RequireLandingFresh -or $landingTriggered) {
        if (-not $okLanding) {
            throw 'Landing verification failed: expected starter=39k/150 and basic=59k/450.'
        }
    }
    elseif (-not $okLanding) {
        Write-Warning 'Landing looks stale. This is expected if landing has its own repo and deploy was not triggered.'
    }

    Write-Step 'Deploy verification passed.'
}
else {
    Write-Step 'Skipping verification.'
}
