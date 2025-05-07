# Voxidian Obsidian Plugin

Voxidian is an Obsidian plugin that lets you record voice notes, transcribe them using OpenAI, and intelligently save them to your vault. It streamlines the process of capturing, transcribing, and organizing your spoken thoughts directly within Obsidian.

## Features
- Record voice notes directly in Obsidian
- Transcribe audio using OpenAI's GPT-4o transcription API
- Automatically analyze and save transcriptions to:
  - Daily notes
  - Existing pages
  - New notes (with intelligent titling)
- Securely store your OpenAI API key in plugin settings

## Installation
1. **Clone or Download** this repository and copy the contents of the `plugin/` directory to your Obsidian plugins folder (usually `.obsidian/plugins/voxidian`).
2. Run the following commands in the `plugin/` directory:
   ```sh
   yarn install
   yarn build
   ```
3. Enable the plugin in Obsidian's settings under **Community Plugins**.

## Configuration
- Open the **Voxidian Plugin Settings** in Obsidian.
- Enter your OpenAI API key (must start with `sk-`).
- The plugin will not function without a valid API key.

## Usage
- Click the microphone ribbon icon or use the `Record Voice Note` command.
- Record your note. The plugin will transcribe and analyze it, then save it to the appropriate note in your vault.
- Transcriptions may be appended to daily notes, existing pages, or saved as new notes, depending on the content.

## Development
- **Install dependencies:**
  ```sh
  yarn install
  ```
- **Build the plugin:**
  ```sh
  yarn build
  ```
- **Development mode:**
  ```sh
  yarn dev
  ```
- **Version bump:**
  ```sh
  yarn version -- <new_version>
  ```
  This updates `manifest.json` and `versions.json`.

- **TypeScript:**
  - Strict settings are enforced (see `tsconfig.json`).
  - No `any` types are allowed (ESLint enforced).

- **Build system:** Uses [esbuild](https://esbuild.github.io/) for fast bundling.

## Notes
- This plugin requires an internet connection to access OpenAI's API.
- Your OpenAI API key is stored locally in your Obsidian settings and is never shared.
- For troubleshooting, check the developer console in Obsidian for logs.

## Contributing
Pull requests and issues are welcome! Please ensure your code is DRY, type-safe, and uses yarn for dependency management.

## License
MIT 