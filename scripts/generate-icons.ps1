Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$sourcePath = "C:\Users\nephi\Downloads\CANVAS.png"
$buildDir = "M:\CANVAS\build\icons"
$publicDir = "M:\CANVAS\public"

New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null

$bitmap = [System.Drawing.Bitmap]::FromFile($sourcePath)

function New-ResizedBitmap {
  param(
    [System.Drawing.Bitmap]$Source,
    [int]$Size
  )

  $target = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($target)
  $graphics.Clear([System.Drawing.Color]::White)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $paddingRatio =
    if ($Size -le 16) { 0.16 }
    elseif ($Size -le 32) { 0.14 }
    elseif ($Size -le 64) { 0.11 }
    else { 0.08 }

  $padding = [Math]::Round($Size * $paddingRatio)
  $drawSize = $Size - ($padding * 2)
  $graphics.DrawImage($Source, $padding, $padding, $drawSize, $drawSize)
  $graphics.Dispose()
  return $target
}

function Save-Png {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$sizes = @(16, 32, 48, 64, 128, 256)
$pngPaths = @{}

foreach ($size in $sizes) {
  $resized = New-ResizedBitmap -Source $bitmap -Size $size
  $path = Join-Path $buildDir "icon-$size.png"
  Save-Png -Bitmap $resized -Path $path
  $pngPaths[$size] = $path
  $resized.Dispose()
}

Copy-Item $pngPaths[256] (Join-Path $buildDir "icon.png") -Force
Copy-Item $pngPaths[32] (Join-Path $publicDir "favicon-32x32.png") -Force
Copy-Item $pngPaths[16] (Join-Path $publicDir "favicon-16x16.png") -Force
Copy-Item $pngPaths[256] (Join-Path $publicDir "apple-touch-icon.png") -Force
Copy-Item $pngPaths[32] (Join-Path $publicDir "favicon.png") -Force

$icoFrames = @(16, 32, 48, 64, 128, 256)
$icoPath = Join-Path $buildDir "icon.ico"
$publicIcoPath = Join-Path $publicDir "favicon.ico"

function Write-IcoFile {
  param(
    [int[]]$FrameSizes,
    [string]$OutputPath
  )

  $fileStream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create)
  $writer = New-Object System.IO.BinaryWriter $fileStream

  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$FrameSizes.Count)

  $dataBlobs = @()
  $offset = 6 + (16 * $FrameSizes.Count)

  foreach ($size in $FrameSizes) {
    $bytes = [System.IO.File]::ReadAllBytes($pngPaths[$size])
    $dataBlobs += ,@($size, $bytes, $offset)

    $writer.Write([byte]([Math]::Min($size, 255) % 256))
    $writer.Write([byte]([Math]::Min($size, 255) % 256))
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$bytes.Length)
    $writer.Write([UInt32]$offset)

    $offset += $bytes.Length
  }

  foreach ($entry in $dataBlobs) {
    $writer.Write($entry[1])
  }

  $writer.Flush()
  $writer.Dispose()
  $fileStream.Dispose()
}

Write-IcoFile -FrameSizes $icoFrames -OutputPath $icoPath
Copy-Item $icoPath $publicIcoPath -Force

$bitmap.Dispose()

Write-Host "Generated icons:"
Write-Host " - $icoPath"
Write-Host " - $publicIcoPath"
