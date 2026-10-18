# ============================================================
#  Genera el icono de MacKiosco (instalador\recursos\mackiosco.ico)
#  con los tamanos 16, 32, 48 y 256 px. Solo hace falta volver a
#  ejecutarlo si se quiere cambiar el diseno del icono.
#
#    powershell -ExecutionPolicy Bypass -File instalador\recursos\crear-icono.ps1
# ============================================================
Add-Type -AssemblyName System.Drawing

$destino = Join-Path $PSScriptRoot 'mackiosco.ico'
$tamanos = 256, 48, 32, 16
$imagenes = @()

foreach ($t in $tamanos) {
  $bitmap = New-Object System.Drawing.Bitmap $t, $t
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  # Fondo: cuadrado con esquinas redondeadas, color principal de la aplicacion.
  $radio = [int]($t * 0.22)
  $d = $radio * 2
  $forma = New-Object System.Drawing.Drawing2D.GraphicsPath
  $forma.AddArc(0, 0, $d, $d, 180, 90)
  $forma.AddArc($t - $d - 1, 0, $d, $d, 270, 90)
  $forma.AddArc($t - $d - 1, $t - $d - 1, $d, $d, 0, 90)
  $forma.AddArc(0, $t - $d - 1, $d, $d, 90, 90)
  $forma.CloseFigure()
  $fondo = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 79, 70, 229))
  $g.FillPath($fondo, $forma)

  # Letras "MK" centradas.
  $fuente = New-Object System.Drawing.Font('Segoe UI', [single]($t * 0.40), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $formato = New-Object System.Drawing.StringFormat
  $formato.Alignment = [System.Drawing.StringAlignment]::Center
  $formato.LineAlignment = [System.Drawing.StringAlignment]::Center
  $area = New-Object System.Drawing.RectangleF 0, ([single]($t * 0.02)), $t, $t
  $g.DrawString('MK', $fuente, [System.Drawing.Brushes]::White, $area, $formato)

  $memoria = New-Object System.IO.MemoryStream
  $bitmap.Save($memoria, [System.Drawing.Imaging.ImageFormat]::Png)
  $imagenes += , $memoria.ToArray()
  $g.Dispose(); $bitmap.Dispose(); $memoria.Dispose()
}

# Contenedor ICO: cabecera, una entrada de 16 bytes por imagen y luego los PNG.
$salida = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $salida
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$tamanos.Count)
$posicion = 6 + 16 * $tamanos.Count
for ($i = 0; $i -lt $tamanos.Count; $i++) {
  $t = $tamanos[$i]
  $lado = if ($t -ge 256) { 0 } else { $t }
  $w.Write([byte]$lado); $w.Write([byte]$lado); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([uint16]1); $w.Write([uint16]32)
  $w.Write([uint32]$imagenes[$i].Length); $w.Write([uint32]$posicion)
  $posicion += $imagenes[$i].Length
}
foreach ($png in $imagenes) { $w.Write($png) }
$w.Flush()
[System.IO.File]::WriteAllBytes($destino, $salida.ToArray())
Write-Output "Icono generado: $destino ($($salida.Length) bytes)"
