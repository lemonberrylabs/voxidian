# Voxidian

## Overview

**Voxidian** is a dual-purpose project:
- **A modern web app** (in `/app`) for recording, transcribing, and sending voice notes directly to your Obsidian vault via GitHub.
- **An Obsidian plugin** (in `/plugin`) that allows you to record and transcribe voice notes directly within Obsidian, saving them intelligently to your vault.

Both components use OpenAI for transcription and intelligent note placement, and are designed to work independently.

---

## Features

### Web App (`/app`)
- Record, pause, resume, and playback voice notes in your browser.
- Transcribe and send voice notes to your Obsidian vault (via GitHub).
- Intelligently appends to daily notes, specific pages, or creates new notes based on the content.
- Built with Next.js 15, TypeScript, and shadcn/ui for a modern, accessible UI.

### Obsidian Plugin (`/plugin`)
- Record and transcribe voice notes directly inside Obsidian.
- Uses OpenAI for transcription and note analysis.
- Appends to daily notes, specific pages, or creates new notes as needed.
- Simple ribbon icon and command for quick access.

---

## Directory Structure

```
/
├── app/         # Next.js 15 web app
│   ├── page.tsx
│   ├── lib/
│   └── api/
├── plugin/      # Obsidian plugin
│   ├── main.ts
│   ├── lib/
│   ├── package.json # Obsidian plugin dependencies
│   └── manifest.json # Obsidian plugin manifest
├── package.json # Root dependencies (web app)
├── README.md
├── manifest.json # Web app manifest
└── ...
```

---

## Web App: Installation & Deployment

### Prerequisites

- Node.js 22+ and Yarn
- A GitHub repository for your Obsidian vault (with a Personal Access Token)
- OpenAI API key

### 1. Install dependencies

```sh
yarn install
```

### 2. Configure environment variables

Create a `.env.local` file in the root with:

```
GITHUB_TOKEN=ghp_...         # GitHub token with repo access
GITHUB_REPOSITORY=owner/repo # e.g. lemonberrylabs/voxidian-vault
NEXT_PUBLIC_APP_URL=https://your-deployed-url.com
OPENAI_API_KEY=sk-...
```

### 3. Run locally

```sh
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000).

### 4. Deploy

- **Vercel**: This app is ready for Vercel. Set the above environment variables in your Vercel dashboard.
- **Other platforms**: Use `yarn build && yarn start`. Ensure environment variables are set.

### 5. Usage

- Open the web app.
- Record a voice note, pause/resume as needed.
- Send the note; it will be transcribed and saved to your Obsidian vault on GitHub.

---

## Obsidian Plugin: Installation & Usage

### 1. Build the plugin

```sh
cd plugin
yarn install
yarn build
```

This will generate `main.js` and other necessary files.

### 2. Install in Obsidian

- In Obsidian, open **Settings → Community plugins → Open plugins folder**.
- Copy the contents of the `plugin/` directory (including `main.js`, `manifest.json`, and `styles.css`) into a subfolder (`voxidian`; must match the `id` in `manifest.json`) in your Obsidian plugins folder.
- Reload Obsidian or enable the plugin in the settings.

### 3. Configure

- Go to **Settings → Voxidian Plugin Settings**.
- Enter your OpenAI API key.

### 4. Usage

- Click the microphone ribbon icon or use the "Record Voice Note" command.
- Record, pause, resume, and save your voice note.
- The plugin will transcribe and intelligently save your note in your vault.

---

## Development

- **Web app** uses Next.js 15, shadcn/ui, and TypeScript. UI components are DRY and reusable.
- **Plugin** uses TypeScript and the Obsidian API. All OpenAI and note logic is shared for consistency.

### Linting & Formatting

```sh
yarn lint
yarn format
```

### Type Checking

```sh
yarn type-check
```

---

## CI/CD

- This repo is set up for GitHub Actions (see `.github/`).
- PRs and pushes are checked for lint, type, and build errors.

---

## Security

- **Never commit secrets**. Use environment variables for all tokens and keys.
- GitHub token should have minimal required permissions (repo contents).

---

## License

MIT

---

## Credits

- Built with [Next.js](https://nextjs.org/), [shadcn/ui](https://ui.shadcn.com/), [OpenAI](https://openai.com/), and [Obsidian](https://obsidian.md/).

---

## Troubleshooting

- If the web app cannot send notes, check your environment variables and GitHub token permissions.
- If the plugin fails to transcribe, ensure your OpenAI API key is valid and has quota.

---

## Contributing

PRs welcome! Please ensure code is DRY, type-safe (no `any`), and uses Yarn.
