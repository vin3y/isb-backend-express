#!/bin/bash
set -e

echo "Installing FFmpeg static build..."

# Download latest static build
curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz

# Extract and move to /usr/local/bin
tar -xJf /tmp/ffmpeg.tar.xz -C /tmp
mv /tmp/ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/
mv /tmp/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/

# Make them executable
chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe

# Verify
echo "FFmpeg installed at: $(which ffmpeg)"
ffmpeg -version | head -n 1
