#!/bin/sh
# Builds the looping product previews from the daylight product photographs (no GPU): a slow drift and breath over the
# photograph, 6 s at 24 fps, seamless (the motion is a full cosine cycle), 640x360 H.264, plus the poster
# (the clip's first frame). Replace a clip with a real capture by dropping the same file names in assets/previews/.
set -e
cd "$(dirname "$0")/.."
N=144
i=0
for id in phorigins sickofit imaginelivetv theplacedepartment yoobaland icanbe doseofdestruction hawkesgen; do
  src="assets/products/$id-rx.jpg"
  # phase offset per product so the eight pages do not drift in step
  ph=$(awk "BEGIN{print $i*0.7}")
  vf="scale=1600:1600,zoompan=z='1.12+0.07*(1-cos(2*PI*on/$N))/2':x='(iw-iw/zoom)/2+sin(2*PI*on/$N+$ph)*iw*0.04':y='(ih-ih/zoom)/2+(1-cos(2*PI*on/$N))*ih*0.02':d=1:s=640x360:fps=24,format=yuv420p"
  ffmpeg -y -loglevel error -loop 1 -i "$src" -vf "$vf" -frames:v $N -an -c:v libx264 -crf 30 -preset slow -movflags +faststart "assets/previews/$id.mp4"
  ffmpeg -y -loglevel error -i "assets/previews/$id.mp4" -frames:v 1 -q:v 4 "assets/previews/$id-poster.jpg"
  i=$((i+1))
done
