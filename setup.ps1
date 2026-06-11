param(
  [switch]$WithLocalWhisper
)

$ErrorActionPreference = "Stop"
$argsList = @("scripts/setup.mjs")
if ($WithLocalWhisper) {
  $argsList += "--with-local-whisper"
}

node @argsList
