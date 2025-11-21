# Local Presentation Recording Guide

## Recording Options (Best to Easiest)

### Option 1: Mac Built-in Screen Recording (Recommended for Quick Recording)

**Steps:**
1. Start your presentation:
   ```bash
   cd Presentation/slidev-presentation
   npm run dev
   ```
   Visit: http://localhost:3030

2. Press **Shift + Command + 5** (opens Screenshot toolbar)

3. Choose recording type:
   - **Record Entire Screen** (recommended)
   - **Record Selected Portion** (for focused recording)

4. Click **Options** to configure:
   - Microphone: Select your microphone
   - Save to: Desktop (or choose location)
   - Show mouse clicks: Enable (optional)

5. Click **Record** button

6. Present your slides:
   - Press **F** for fullscreen
   - Press **P** for presenter mode (see notes)
   - Use Space/Arrow keys to navigate

7. **Stop recording:** Click stop icon in menu bar

8. **Find your video:** Desktop (MP4 format)

**Benefits:**
- ✅ No software installation needed
- ✅ Good quality (1080p+)
- ✅ Includes audio from microphone
- ✅ Immediate playback

**Limitations:**
- ❌ No webcam overlay
- ❌ No advanced editing
- ❌ Can't pause/resume

---

### Option 2: OBS Studio (Professional Quality)

**Best for:** Final presentations, YouTube uploads, professional recordings

#### Installation:
1. Download: https://obsproject.com/
2. Install OBS Studio
3. Open and follow setup wizard

#### Configuration:
1. **Add Display Source:**
   - Sources → + → Display Capture
   - Name: "Screen"
   - Select your display

2. **Add Audio:**
   - Sources → + → Audio Input Capture
   - Name: "Microphone"
   - Select your microphone

3. **Optional - Add Webcam:**
   - Sources → + → Video Capture Device
   - Name: "Webcam"
   - Resize and position in corner (picture-in-picture)

4. **Settings:**
   - Settings → Output:
     - Recording Quality: High Quality
     - Recording Format: MP4
   - Settings → Video:
     - Base Resolution: 1920x1080
     - Output Resolution: 1920x1080
     - FPS: 30 or 60

#### Recording:
1. Start presentation (`npm run dev`)
2. In OBS, click **"Start Recording"**
3. Present your slides
4. Click **"Stop Recording"**
5. Video saved to: `~/Movies/` (check Settings → Output → Recording Path)

**Benefits:**
- ✅ Professional quality
- ✅ Webcam overlay support
- ✅ Can pause/resume recording
- ✅ Advanced scene switching
- ✅ Audio mixing controls
- ✅ Export to multiple formats

**Limitations:**
- ❌ Requires installation
- ❌ Steeper learning curve

---

### Option 3: QuickTime Player (Mac Built-in Alternative)

**Best for:** Simple recordings without extra software

1. Open **QuickTime Player** (Applications folder)
2. File → **New Screen Recording**
3. Click **dropdown arrow** next to record button:
   - Select microphone
   - Show Mouse Clicks in Recording (optional)
4. Click red **Record** button
5. Click anywhere to record entire screen (or drag to select area)
6. Start your presentation
7. **Stop:** Click stop icon in menu bar
8. File → Save (choose location)

**Benefits:**
- ✅ Built-in to Mac
- ✅ Simple interface
- ✅ Includes audio

**Limitations:**
- ❌ No webcam overlay
- ❌ No editing features
- ❌ Can't pause/resume

---

## Pro Tips for High-Quality Recording

### Before Recording:

**1. Test Audio**
- Record 10 seconds and play back
- Check microphone levels (not too quiet, no distortion)
- Close windows/doors to reduce background noise

**2. Prepare Your Environment**
- Close unnecessary apps (Slack, Email, Notifications)
- Do Not Disturb mode: Control Center → Focus → Do Not Disturb
- Hide menu bar icons if possible
- Use fullscreen mode (press **F** in slides)

**3. Practice Run**
- Do a complete rehearsal WITHOUT recording
- Time yourself (aim for 20-30 min max)
- Note which slides need more explanation

### During Recording:

**Presentation Mode:**
- Press **P** for presenter mode (see speaker notes)
- Press **G** to jump to specific slide
- Press **O** for overview (see all slides)
- Press **D** to draw on slides (annotations)

**Pacing:**
- Speak slowly and clearly (slower than normal conversation)
- Pause 2-3 seconds between slides
- Don't rush - viewers can pause/rewind

**Navigation:**
- Use Space or Arrow keys (avoid mouse clicking)
- Use **G** key to jump if you miss a slide

**Common Mistakes to Avoid:**
- ❌ Saying "um" and "uh" (practice beforehand)
- ❌ Reading slides verbatim (explain, don't read)
- ❌ Going too fast (pause between thoughts)
- ❌ Not testing audio (always test first!)

### After Recording:

**Review:**
- Watch the entire recording
- Check audio quality
- Note any sections that need re-recording

**Edit (if needed):**
- Use iMovie (free, built-in to Mac)
- Trim beginning/end
- Add intro/outro slides
- Adjust audio levels

**Export:**
- MP4 format (best compatibility)
- 1080p resolution
- H.264 codec (standard)

---

## Recommended Recording Setup

**For 30-Minute Presentation:**

```
Equipment:
- Mac (any modern MacBook/iMac)
- Good microphone (or AirPods Pro for decent audio)
- Quiet room

Software:
- OBS Studio (if you want webcam overlay)
- OR Mac Screen Recording (if simple recording)

Presentation Setup:
1. Start Slidev: npm run dev
2. Open in fullscreen (F key)
3. Enter presenter mode (P key)
4. Have water nearby
5. Start recording
6. Present at comfortable pace
7. Stop recording
8. Review and edit if needed
```

---

## Troubleshooting

**Problem: No audio in recording**
- Solution: Check microphone permissions (System Settings → Privacy & Security → Microphone)
- Solution: Select correct microphone in recording options

**Problem: Video is choppy/laggy**
- Solution: Close other apps (especially Chrome/Slack)
- Solution: Reduce resolution to 720p
- Solution: Use wired connection (not WiFi) if uploading

**Problem: File size too large**
- Solution: 1 hour of 1080p = ~2GB (normal)
- Solution: Use Handbrake to compress: https://handbrake.fr/
- Solution: Upload to YouTube (private) for easy sharing

**Problem: Slides don't animate smoothly**
- Solution: Use `npm run build` then `npm run start` (production mode)
- Solution: Close other browser tabs
- Solution: Restart browser before recording

---

## Storage & Backup

**File Sizes (approximate):**
- 30 min @ 1080p: ~1GB
- 60 min @ 1080p: ~2GB

**Backup Locations:**
- Local: External hard drive
- Cloud: Google Drive, Dropbox, iCloud
- Private: YouTube (unlisted), Vimeo (private)

---

## Alternative: Record Slide by Slide

If you want perfect takes:

1. Record each slide separately
2. Use iMovie to stitch together
3. Add transitions between clips
4. Export final video

**Benefits:**
- Perfect each segment
- No need to redo entire presentation for one mistake
- Can update individual slides later

**Tools:**
- iMovie (free, Mac)
- Final Cut Pro (paid, $299)
- DaVinci Resolve (free, cross-platform)

---

## Summary: Quick Start

**Easiest (5 min setup):**
1. Press Shift + Command + 5
2. Click "Record Entire Screen"
3. Click Options → Enable Microphone
4. Click Record
5. Present slides (npm run dev)
6. Stop recording (menu bar icon)
7. Done! Video on Desktop

**Professional (30 min setup):**
1. Download OBS Studio
2. Add Display Capture + Audio Input
3. Optional: Add Webcam (picture-in-picture)
4. Click "Start Recording"
5. Present slides
6. Click "Stop Recording"
7. Edit in iMovie if needed
8. Export to MP4

---

## Questions?

- OBS Studio Guide: https://obsproject.com/wiki/
- Mac Screen Recording: https://support.apple.com/guide/mac-help/take-screenshots-or-screen-recordings-mh26782/mac
- iMovie Tutorial: https://support.apple.com/imovie

**Happy recording! 🎥**
