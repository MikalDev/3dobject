Set-Location -Path .\src
$version = $args[0]  # Store the first argument in a variable
Compress-Archive -Path * -DestinationPath "..\dist\3DObject-$version.zip" -Force
Move-Item -Path "..\dist\3DObject-$version.zip" -Destination "..\dist\3DObject-$version.c3addon" -Force
Set-Location .. 