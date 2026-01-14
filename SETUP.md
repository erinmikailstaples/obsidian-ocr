# Setup Guide

## Prerequisites

This plugin requires Node.js to build. If you don't have Node.js installed:

### Install Node.js

**Option 1: Using Homebrew (recommended for macOS)**
```bash
brew install node
```

**Option 2: Download from nodejs.org**
Visit https://nodejs.org/ and download the LTS version.

**Verify installation:**
```bash
node --version
npm --version
```

## Building the Plugin

Once Node.js is installed:

1. Navigate to the plugin directory:
   ```bash
   cd ~/Documents/GitHub/obsidian-ocr
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

## Installing in Obsidian

### Method 1: Symlink to Development Directory (Recommended for Development)

1. Find your Obsidian vault's plugin directory:
   ```bash
   # Replace 'YourVault' with your actual vault name
   cd /path/to/YourVault/.obsidian/plugins
   ```

2. Create a symlink:
   ```bash
   ln -s ~/Documents/GitHub/obsidian-ocr obsidian-ocr
   ```

3. Restart Obsidian and enable the plugin in Settings → Community Plugins

### Method 2: Copy to Vault

1. Build the plugin (see above)

2. Copy the following files to your vault's plugin directory:
   ```bash
   # Replace 'YourVault' with your actual vault name
   mkdir -p /path/to/YourVault/.obsidian/plugins/obsidian-ocr
   cp main.js manifest.json styles.css /path/to/YourVault/.obsidian/plugins/obsidian-ocr/
   ```

3. Restart Obsidian and enable the plugin in Settings → Community Plugins

## Development Mode

For active development with auto-rebuild:

```bash
npm run dev
```

This will watch for file changes and automatically rebuild the plugin.

## Troubleshooting

### "npm: command not found"
- Install Node.js (see Prerequisites above)
- Restart your terminal after installation

### Build fails
- Ensure all dependencies are installed: `npm install`
- Check Node.js version: `node --version` (should be v16 or higher)

### Plugin doesn't appear in Obsidian
- Ensure you've enabled community plugins in Obsidian settings
- Check that the plugin files are in the correct directory
- Restart Obsidian

### OCR not working
- The first OCR operation may take longer as Tesseract downloads language data
- Check browser console (Cmd+Option+I on macOS) for errors
- Ensure your image file is a supported format (JPG, PNG, etc.)
