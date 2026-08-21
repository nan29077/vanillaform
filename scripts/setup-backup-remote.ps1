# Windows -> 바닐라폼 전용 서버로 DB 백업 스크립트를 전송하고
# 매일 자정(KST) cron 을 등록한다.
#
# 사용:
#   .\scripts\setup-backup-remote.ps1
#
# 환경변수로 오버라이드 가능:
#   VANILLAFORM_DEPLOY_SSH_KEY   필수: 바닐라폼 전용 SSH 키
#   VANILLAFORM_DEPLOY_SSH_USER  기본 ubuntu
#   VANILLAFORM_DEPLOY_SSH_HOST  필수: 바닐라폼 전용 서버 호스트
#   VANILLAFORM_DEPLOY_REPO_DIR  기본 /home/ubuntu/vanillaform

$ErrorActionPreference = 'Stop'

function Get-EnvOrDefault($name, $default) {
  $v = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($v)) { return $default } else { return $v }
}

$SshKey  = Get-EnvOrDefault 'VANILLAFORM_DEPLOY_SSH_KEY'  ''
$SshUser = Get-EnvOrDefault 'VANILLAFORM_DEPLOY_SSH_USER' 'ubuntu'
$SshHost = Get-EnvOrDefault 'VANILLAFORM_DEPLOY_SSH_HOST' ''
$RepoDir = Get-EnvOrDefault 'VANILLAFORM_DEPLOY_REPO_DIR' '/home/ubuntu/vanillaform'

if ([string]::IsNullOrWhiteSpace($SshKey) -or [string]::IsNullOrWhiteSpace($SshHost)) {
  Write-Error '바닐라폼 전용 SSH 키와 서버 호스트를 먼저 설정하세요.'
  exit 1
}

if ($SshHost -eq '15.165.111.176') {
  Write-Error '이전 서비스 서버 주소는 바닐라폼 백업 대상으로 사용할 수 없습니다.'
  exit 1
}

if (-not (Test-Path $SshKey)) {
  Write-Error "SSH 키 파일 없음: $SshKey"
  exit 1
}

$Files = @('backup-db.sh', 'setup-backup-cron.sh')

Write-Host "[backup-setup] target : $SshUser@$SshHost"
Write-Host "[backup-setup] repo   : $RepoDir"
Write-Host "[backup-setup] key    : $SshKey"
Write-Host ""

# 각 .sh 파일을 CRLF/BOM 제거 후 원격 scripts/ 로 전송 (bash 가 \r 로 깨지지 않도록).
foreach ($f in $Files) {
  $local = Join-Path $PSScriptRoot $f
  if (-not (Test-Path $local)) { Write-Error "로컬 파일 없음: $local"; exit 1 }

  $body = ((Get-Content $local -Raw) -replace "`r", "")
  $body = $body.TrimStart([char]0xFEFF)
  $tmp  = Join-Path $env:TEMP $f
  [System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding($false)))

  $dest = "$RepoDir/scripts/$f"
  Write-Host "[backup-setup] 전송: $f -> $dest"
  $cmd = 'ssh -i "{0}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 {1}@{2} "mkdir -p ''{3}/scripts'' && cat > ''{4}''" < "{5}"' -f `
    $SshKey, $SshUser, $SshHost, $RepoDir, $dest, $tmp
  cmd /c $cmd
  if ($LASTEXITCODE -ne 0) { Write-Error "전송 실패: $f (exit $LASTEXITCODE)"; exit $LASTEXITCODE }
}

Write-Host ""
Write-Host "[backup-setup] cron 등록 실행..."
$setup = "REPO_DIR='$RepoDir' bash '$RepoDir/scripts/setup-backup-cron.sh'"
$cmd = 'ssh -i "{0}" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 {1}@{2} "{3}"' -f `
  $SshKey, $SshUser, $SshHost, $setup
cmd /c $cmd
if ($LASTEXITCODE -ne 0) { Write-Error "cron 등록 실패 (exit $LASTEXITCODE)"; exit $LASTEXITCODE }

Write-Host ""
Write-Host "[backup-setup] 완료. 즉시 테스트하려면:" -ForegroundColor Green
Write-Host "  ssh -i `"$SshKey`" $SshUser@$SshHost `"bash $RepoDir/scripts/backup-db.sh`""
