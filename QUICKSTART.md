# Quick Start Guide

## What This Plugin Does

The Obsidian OCR plugin allows you to:
1. Upload an image containing handwritten or printed text
2. Automatically extract the text using OCR (Optical Character Recognition)
3. Review and edit the extracted text and metadata
4. Create a formatted Obsidian note with proper frontmatter

## Next Steps

### 1. Install Node.js (if not already installed)

```bash
brew install node
```

### 2. Build the Plugin

```bash
npm install
npm run build
```

### 3. Install in Obsidian

Copy or symlink the plugin to your Obsidian vault:

```bash
# Option A: Symlink (for development)
ln -s ~/Documents/GitHub/obsidian-ocr /path/to/your/vault/.obsidian/plugins/obsidian-ocr

# Option B: Copy built files
mkdir -p /path/to/your/vault/.obsidian/plugins/obsidian-ocr
cp main.js manifest.json styles.css /path/to/your/vault/.obsidian/plugins/obsidian-ocr/
```

### 4. Enable the Plugin

1. Open Obsidian
2. Go to Settings → Community Plugins
3. Turn off "Restricted mode" if needed
4. Find "OCR Image to Note" in the list and enable it

### 5. Use the Plugin

**Method 1: Ribbon Icon**
- Click the image icon (📄) in the left sidebar

**Method 2: Command Palette**
- Press Cmd/Ctrl + P
- Type "Convert image to note"
- Press Enter

Then:
1. Select an image file
2. Wait for OCR processing
3. Edit the metadata modal:
   - Title: Default is "Meeting Notes"
   - Date: Defaults to today (YYYY-MM-DD)
   - Add custom fields as needed
   - Edit the extracted text
4. Click "Create Note"

## Example Output

When you upload an image, the plugin creates a note like this:

```markdown
---
title: Team Meeting Notes
date: 2026-01-14
attendees: John, Jane, Bob
location: Conference Room A
---

[Your handwritten notes converted to text appear here]
```

## Features

- ✅ OCR extraction using Tesseract.js
- ✅ Editable frontmatter (title, date, custom fields)
- ✅ Review and edit extracted text before saving
- ✅ Configurable default folder for notes
- ✅ Automatic date formatting (YYYY-MM-DD)
- ✅ File name sanitization
- ✅ Duplicate file detection

## Tips

- For best OCR results, use clear, well-lit images
- The OCR engine supports multiple languages (English by default)
- You can add any custom metadata fields you need
- Set a default folder in Settings to organize your OCR notes

For detailed installation instructions, see [SETUP.md](SETUP.md).
