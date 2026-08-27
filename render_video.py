#!/usr/bin/env python3
"""
KhizerVideoPlus - Python CLI Video Renderer
Renders an MP4 video matching exact audio duration divided across N screenshots.
Usage:
    python render_video.py --audio voice.mp3 --images img1.png img2.png img3.png --output final_video.mp4
"""

import os
import sys
import argparse
import subprocess
import numpy as np
from PIL import Image, ImageFilter

def get_audio_duration(audio_path):
    """Obtain precise audio duration in seconds using imageio_ffmpeg or ffprobe"""
    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        # Use ffmpeg -i to parse duration line
        cmd = [ffmpeg_exe, "-i", audio_path]
        res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        
        for line in res.stderr.splitlines():
            if "Duration:" in line:
                # Format: Duration: 00:01:23.45, ...
                parts = line.split("Duration:")[1].split(",")[0].strip()
                h, m, s = parts.split(":")
                duration = float(h) * 3600 + float(m) * 60 + float(s)
                return duration
    except Exception as e:
        print(f"[Warning] Could not get audio duration via imageio_ffmpeg: {e}")
    
    # Fallback to wave if WAV file
    if audio_path.lower().endswith(".wav"):
        import wave
        with wave.open(audio_path, 'r') as w:
            frames = w.getnframes()
            rate = w.getframerate()
            return frames / float(rate)
            
    raise RuntimeError("Could not determine audio duration. Ensure imageio-ffmpeg is installed.")

def resize_and_contain(img, width=1920, height=1080):
    """Resize image to fit within width/height with blurred background canvas"""
    img_w, img_h = img.size
    
    # Create blurred background
    bg = img.resize((width, height), Image.Resampling.BILINEAR)
    bg = bg.filter(ImageFilter.GaussianBlur(radius=25))

    # Calculate fit box
    scale = min(width / img_w, height / img_h)
    draw_w = int(img_w * scale)
    draw_h = int(img_h * scale)
    resized = img.resize((draw_w, draw_h), Image.Resampling.LANCZOS)

    draw_x = (width - draw_w) // 2
    draw_y = (height - draw_h) // 2
    bg.paste(resized, (draw_x, draw_y))
    return bg

def apply_ken_burns(img, progress, scale_factor=0.15, width=1920, height=1080):
    """Apply zoom & pan transform to PIL image"""
    zoom = 1.0 + (progress * scale_factor)
    crop_w = int(width / zoom)
    crop_h = int(height / zoom)
    
    left = int((width - crop_w) / 2)
    top = int((height - crop_h) / 2)
    right = left + crop_w
    bottom = top + crop_h
    
    cropped = img.crop((left, top, right, bottom))
    return cropped.resize((width, height), Image.Resampling.LANCZOS)

def main():
    parser = argparse.ArgumentParser(description="KhizerVideoPlus - Audio Synced Video Renderer")
    parser.add_argument("--audio", required=True, help="Path to input audio/voiceover file")
    parser.add_argument("--images", nargs="+", required=True, help="List of screenshot/image file paths")
    parser.add_argument("--output", default="output_video.mp4", help="Output MP4 file path")
    parser.add_argument("--preset", choices=["youtube", "shorts", "status", "square"], default="youtube", help="Target preset: youtube (16:9), shorts (9:16), status (9:16), square (1:1)")
    parser.add_argument("--intro-text", default="", help="Headline text for starting intro black screen")
    parser.add_argument("--intro-subtitle", default="", help="Subtitle/tagline for starting intro black screen")
    parser.add_argument("--intro-duration", type=float, default=2.5, help="Duration of intro black screen in seconds (default: 2.5)")
    parser.add_argument("--fps", type=int, default=30, help="Frames per second (default: 30)")
    parser.add_argument("--width", type=int, default=None, help="Video width (overrides preset if set)")
    parser.add_argument("--height", type=int, default=None, help="Video height (overrides preset if set)")
    parser.add_argument("--zoom", action="store_true", default=False, help="Enable Ken Burns zoom/pan effect (disabled by default)")

    args = parser.parse_args()

    # Preset dimension resolution
    preset_dims = {
        "youtube": (1920, 1080),
        "shorts":  (1080, 1920),
        "status":  (1080, 1920),
        "square":  (1080, 1080)
    }

    w, h = preset_dims.get(args.preset, (1920, 1080))
    width = args.width if args.width else w
    height = args.height if args.height else h

    if not os.path.exists(args.audio):
        print(f"Error: Audio file '{args.audio}' does not exist.")
        sys.exit(1)

    for img_path in args.images:
        if not os.path.exists(img_path):
            print(f"Error: Image file '{img_path}' does not exist.")
            sys.exit(1)

    print(f"[*] Analyzing audio file: {args.audio}")
    total_duration = get_audio_duration(args.audio)
    num_images = len(args.images)
    slide_duration = total_duration / num_images

    print(f"[+] Total Audio Duration: {total_duration:.2f} seconds")
    print(f"[+] Number of Screenshots: {num_images}")
    print(f"[+] Slide Duration: {slide_duration:.2f} seconds per screenshot")

    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    # Pre-process base PIL images
    print(f"[*] Processing & fitting screenshots for preset '{args.preset}' ({width}x{height})...")
    base_imgs = [resize_and_contain(Image.open(p).convert("RGB"), width, height) for p in args.images]

    # Output video pipe via ffmpeg
    cmd = [
        ffmpeg_exe,
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{width}x{height}",
        "-pix_fmt", "rgb24",
        "-r", str(args.fps),
        "-i", "-",
        "-i", args.audio,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        args.output
    ]

    pipe = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    has_intro = bool(args.intro_text.strip())
    intro_dur = min(args.intro_duration, total_duration * 0.4) if has_intro else 0.0
    avail_dur = max(0.1, total_duration - intro_dur)
    slide_duration = avail_dur / num_images

    total_frames = int(total_duration * args.fps)
    print(f"[*] Rendering {total_frames} frames to {args.output}...")
    if has_intro:
        print(f"[*] Intro Black Title Screen enabled for first {intro_dur:.2f}s: '{args.intro_text}'")

    from PIL import ImageDraw, ImageFont

    def draw_intro_frame(title, subtitle, width, height):
        img = Image.new("RGB", (width, height), (0, 0, 0)) # Pitch Black (#000000)
        draw = ImageDraw.Draw(img)
        
        try:
            font_title = ImageFont.truetype("arial.ttf", 64)
            font_sub = ImageFont.truetype("arial.ttf", 34)
        except Exception:
            font_title = ImageFont.load_default()
            font_sub = ImageFont.load_default()

        center_x = width // 2
        center_y = height // 2

        if subtitle and subtitle.strip():
            draw.text((center_x, center_y - 32), title, fill=(255, 255, 255), font=font_title, anchor="mm")
            draw.text((center_x, center_y + 40), subtitle, fill=(255, 255, 255), font=font_sub, anchor="mm")
        else:
            draw.text((center_x, center_y), title, fill=(255, 255, 255), font=font_title, anchor="mm")

        return img

    for frame_idx in range(total_frames):
        t = frame_idx / float(args.fps)

        if has_intro and t < intro_dur:
            frame_img = draw_intro_frame(args.intro_text, args.intro_subtitle, width, height)
        else:
            t_slides = t - intro_dur
            slide_idx = min(int(t_slides / slide_duration), num_images - 1)
            slide_t_start = slide_idx * slide_duration
            progress = (t_slides - slide_t_start) / slide_duration

            current_img = base_imgs[slide_idx]
            if args.zoom:
                frame_img = apply_ken_burns(current_img, progress, scale_factor=0.12, width=width, height=height)
            else:
                frame_img = current_img

        # Write frame bytes to ffmpeg stdin
        frame_bytes = np.array(frame_img).tobytes()
        pipe.stdin.write(frame_bytes)

        if frame_idx % (args.fps * 2) == 0 or frame_idx == total_frames - 1:
            pct = int((frame_idx / total_frames) * 100)
            print(f" Progress: {pct}% ({frame_idx}/{total_frames} frames)")

    pipe.stdin.close()
    pipe.wait()
    print(f"[✔] Video rendering complete! Saved to {os.path.abspath(args.output)}")

if __name__ == "__main__":
    main()
