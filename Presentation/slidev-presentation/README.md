# DCA Backtest Tool - Presentation

Interactive presentation built with [Slidev](https://sli.dev/).

## Development

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev
```

Visit `http://localhost:3030` to view the presentation.

## Build for Production

```bash
# Build static site
npm run build

# Preview production build locally
npm run start
```

The built files will be in the `dist/` directory.

## Deploy to Render

This presentation is configured to deploy automatically to Render.com.

1. Push this directory to your GitHub repository
2. In Render.com, create a new "Static Site"
3. Connect your GitHub repository
4. Set root directory to: `Presentation/slidev-presentation`
5. Render will automatically use `render.yaml` configuration

**Deployment URL:** Will be provided by Render after deployment

## Alternative: Deploy to GitHub Pages

You can also deploy to GitHub Pages:

```bash
# Build the presentation
npm run build

# The dist/ folder can be deployed to any static hosting
# GitHub Pages, Netlify, Vercel, etc.
```

## Presentation Controls

- **Space / Arrow Keys:** Next slide
- **Shift + Space / Arrow Keys:** Previous slide
- **F:** Toggle fullscreen
- **O:** Toggle overview mode
- **G:** Go to specific slide
- **Escape:** Exit overview/presenter mode

## Exporting

Export to PDF (requires Playwright):

```bash
npm run export
```

This will generate `slides-export.pdf` in the root directory.

## Customization

Edit `slides.md` to modify the presentation content.

The presentation uses the default Slidev theme. To customize:
- Colors, fonts: Edit CSS in `slides.md` frontmatter
- Theme: Change `theme:` in frontmatter to any Slidev theme
- Layouts: Use built-in Slidev layouts or create custom ones

## Features Used

- ✅ Click animations (`<v-click>`)
- ✅ Two-column layouts
- ✅ Code highlighting
- ✅ Transitions between slides
- ✅ Presenter notes (press `P` in presenter mode)
- ✅ Drawing mode (press `D`)

## Learn More

- [Slidev Documentation](https://sli.dev/)
- [Slidev Themes](https://sli.dev/themes/gallery.html)
- [Render Static Site Docs](https://render.com/docs/static-sites)
