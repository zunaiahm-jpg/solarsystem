Add-Type -AssemblyName System.Drawing
Get-ChildItem 'assets\textures','assets\sky' | ForEach-Object {
  $mb = [math]::Round($_.Length / 1MB, 2)
  $dims = ''
  try {
    $img = [System.Drawing.Image]::FromFile($_.FullName)
    $dims = "$($img.Width)x$($img.Height)"
    $img.Dispose()
  } catch { $dims = 'n/a' }
  Write-Output ($_.Name.PadRight(28) + $mb.ToString().PadLeft(8) + ' MB  ' + $dims)
}
