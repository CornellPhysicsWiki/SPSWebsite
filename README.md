# Cornell SPS Website

The official website for the Cornell University Society of Physics Students, built by Austin Wu with Jekyll.

## Quick Start

```bash
# Install dependencies
bundle install

# Run locally
bundle exec jekyll serve
```

Then open [http://localhost:4000](http://localhost:4000).

## Updating Content

### E-Board Members

Edit `assets/data/eboard.csv` — this is the single source of truth for the E-Board page. Alumni also have a page

| Column | Description |
|--------|-------------|
| `name` | Full name |
| `linkedin` | LinkedIn username slug (e.g., `jane-doe`) |
| `title` | Role/position (e.g., `President`) |
| `club_status` | `member` or `alumni` |
| `image` | Path to photo (e.g., `assets/images/people/name.jpg`). Leave blank for auto-generated avatar. |

### Events

Edit `assets/data/events.csv` with columns: `date`, `title`, `description`, `link`.

### Pages

All pages are in the `pages/` directory and use simple HTML with Jekyll front matter.

### Wiki
