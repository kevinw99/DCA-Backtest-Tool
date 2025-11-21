# Presentation Deployment Guide

## ✅ All Updates Complete!

Your presentation has been created with all requested features:

### What's New

1. ✅ **Demo 4: Full Nasdaq 100 Backtest (100 stocks)**
   - Survivorship bias handling with historical index tracking
   - Beta grouping analysis (5 volatility ranges)
   - DCA suitability scores (0-100 composite metric)
   - Idle cash optimization strategies
   - Slides 16-17

2. ✅ **Demo 5: NVDA AI Boom** (renumbered from Demo 4)
   - Illustrative example with disclaimers
   - Slide 17

3. ✅ **Context Engineering Slides (Slides 20-27)**
   - Comparison with traditional Agile/JIRA
   - Specifications as "JIRA tickets"
   - Skills as "QA process"
   - Bug tracking without SAAS overhead
   - MCP integration (including Render MCP)
   - Honest assessment of TDD/Code Review gaps
   - Future improvements

4. ✅ **All Strategies Broken Down** (Slides 4-11)
   - Each strategy gets its own slide with examples

5. ✅ **Slidev Conversion** (Interactive Web-Based)
   - Click animations
   - Two-column layouts
   - Code highlighting
   - Presenter mode
   - Overview mode
   - Drawing mode

---

## Deployment Options

### Option 1: Deploy to Render.com (Recommended)

**Steps:**

1. **Push to GitHub:**
   ```bash
   cd /Users/kweng/AI/DCA-Backtest-Tool
   git add Presentation/slidev-presentation/
   git commit -m "Add Slidev presentation"
   git push origin main
   ```

2. **Create Render Static Site:**
   - Go to https://render.com/
   - Click "New" → "Static Site"
   - Connect your GitHub repository
   - Settings:
     - **Root Directory:** `Presentation/slidev-presentation`
     - **Build Command:** `npm install && npm run build`
     - **Publish Directory:** `dist`
   - Click "Create Static Site"

3. **Access Your Presentation:**
   - Render will provide a URL like: `https://dca-presentation-xxxx.onrender.com`
   - Presentation will be live in 2-3 minutes

**Benefits:**
- ✅ Free hosting
- ✅ Auto-deploys on git push
- ✅ Custom domain support
- ✅ HTTPS enabled

---

### Option 2: Deploy to GitHub Pages

**Steps:**

1. **Build the presentation:**
   ```bash
   cd Presentation/slidev-presentation
   npm run build
   ```

2. **Create gh-pages branch:**
   ```bash
   git checkout --orphan gh-pages
   git rm -rf .
   cp -r dist/* .
   git add .
   git commit -m "Deploy presentation to GitHub Pages"
   git push origin gh-pages
   ```

3. **Enable GitHub Pages:**
   - Go to your repository settings
   - Pages → Source: `gh-pages` branch
   - Your presentation will be at: `https://[username].github.io/[repo-name]/`

---

### Option 3: View Locally

**For Development/Testing:**

```bash
cd Presentation/slidev-presentation

# Start dev server (hot reload)
npm run dev
# Visit: http://localhost:3030

# Or preview production build
npm run build
npm run start
# Visit: http://localhost:3000
```

---

## Presentation Controls

- **Space / Arrow Keys:** Next slide
- **Shift + Space / Arrow Keys:** Previous slide
- **F:** Toggle fullscreen
- **O:** Toggle overview mode (see all slides)
- **P:** Presenter mode (with speaker notes)
- **D:** Drawing mode (annotate slides)
- **G:** Go to specific slide
- **Escape:** Exit overview/presenter mode

---

## Files Created

### Core Files
- `Presentation/slidev-presentation/slides.md` - Main presentation (27 slides)
- `Presentation/slidev-presentation/package.json` - Dependencies & scripts
- `Presentation/slidev-presentation/render.yaml` - Render deployment config
- `Presentation/slidev-presentation/README.md` - Documentation

### Alternative Formats
- `Presentation/Slides-Content.md` - Original markdown (reference)
- `Presentation/Slides-Content-v2.md` - Updated version with requested changes

---

## Slide Breakdown

1. **Problem Statement** (Slides 1-2)
2. **Enhanced DCA Overview** (Slide 3)
3. **Strategy Deep Dives** (Slides 4-11)
   - Grid-Based DCA
   - Trailing Stops
   - Momentum Trading
   - Incremental Profit
   - Scenario Detection
   - Short Selling
   - Beta Scaling
   - Technical Indicators
4. **Backtesting Framework** (Slide 12)
5. **Demonstrations** (Slides 13-17)
   - Demo 1: TSLA (actual data)
   - Demo 2: Batch Optimization
   - Demo 3: Nasdaq 100 Portfolio (10 stocks)
   - Demo 4: Full Nasdaq 100 (100 stocks) ⭐ NEW
   - Demo 5: NVDA AI Boom (illustrative)
6. **Deployment** (Slide 18)
7. **Development Methodology** (Slides 19-27) ⭐ EXPANDED
   - Context Engineering Framework
   - Specifications vs. JIRA
   - Skills vs. QA Process
   - MCP Integration (Render, Yahoo Finance, etc.)
   - Honest workflow assessment
   - Future improvements
8. **Appendix & Closing** (Slides 28-30)

---

## Export to PDF

If you need a PDF version for offline distribution:

```bash
cd Presentation/slidev-presentation
npm run export
```

This will generate `slides-export.pdf` (requires Playwright to be installed).

---

## Customization

### Change Theme
Edit `slides.md` frontmatter:
```yaml
---
theme: default  # Change to: seriph, apple-basic, shibainu, etc.
---
```

Browse themes: https://sli.dev/themes/gallery.html

### Add Logo
Add your logo to the frontmatter:
```yaml
---
logo: /path/to/logo.png
---
```

### Custom CSS
Add custom styles in frontmatter:
```yaml
---
style: |
  .slidev-layout {
    background: linear-gradient(to bottom, #1a1a2e, #16213e);
  }
---
```

---

## Troubleshooting

### Build fails with module errors
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Slides not showing animations
- Animations use `<v-click>` components
- Make sure you're using `npm run dev` or `npm run build` (not direct markdown viewer)

### Fonts not loading
- Slidev includes KaTeX fonts automatically
- If missing, check `dist/assets/` folder after build

---

## Next Steps

1. **Deploy to Render** (recommended) or GitHub Pages
2. **Share the URL** with your audience
3. **Practice presentation** using presenter mode (`P` key)
4. **Export to PDF** if you need offline backup

---

## Questions?

- Slidev Docs: https://sli.dev/
- Render Docs: https://render.com/docs/static-sites
- GitHub Pages: https://pages.github.com/

**Enjoy your presentation! 🎉**
