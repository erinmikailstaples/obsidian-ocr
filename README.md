# Obsidian OCR Plugin

Convert handwritten text images to Obsidian notes using OCR (Optical Character Recognition).

## Features

- Upload images containing handwritten or printed text
- Extract text using Tesseract.js OCR engine with configurable settings
- **Advanced image preprocessing** for improved accuracy:
  - **Live preprocessing preview** - see before/after comparison
  - **Adaptive binarization** - Otsu's method for automatic threshold detection
  - **Local adaptive binarization** - Bradley method for varying lighting
  - Grayscale conversion
  - Adjustable contrast and brightness
  - Image sharpening for blurry text
  - **Morphological operations** - connect broken strokes, remove noise
  - **Auto-deskewing** - automatic rotation correction
  - Image upscaling (up to 4x)
  - Denoising filter
- **Configurable OCR parameters**:
  - Multiple page segmentation modes (PSM)
  - OCR engine selection (OEM)
  - Multi-language support
- Edit frontmatter metadata (title, date, custom fields) before creating the note
- Automatically create formatted Obsidian notes with proper frontmatter
- Configurable default folder for new notes

## Installation

### Manual Installation

1. Clone this repository into your Obsidian plugins folder:
   ```bash
   cd /path/to/your/vault/.obsidian/plugins
   git clone https://github.com/erinmikailstaples/obsidian-ocr.git
   cd obsidian-ocr
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Enable the plugin in Obsidian Settings → Community Plugins

### Development

To run the plugin in development mode with auto-rebuild:

```bash
npm run dev
```

## Usage

### Converting Images to Notes

1. Click the image icon in the left ribbon, or
2. Use the command palette (Cmd/Ctrl + P) and search for "Convert image to note"
3. Select an image file containing handwritten or printed text
4. Wait for OCR processing to complete
5. Review and edit the metadata in the modal:
   - **Title**: Name of the note (default: "Meeting Notes")
   - **Date**: Date in YYYY-MM-DD format (default: today)
   - **Additional Metadata**: Add custom key-value pairs for frontmatter
   - **Content**: Edit the extracted OCR text
6. Click "Create Note" to generate the note

### Settings

Access settings via Settings → OCR Image to Note

**General:**
- **Default Folder**: Specify a default folder where new notes will be created
- **Show Preprocessing Preview**: See before/after comparison before running OCR

**OCR Configuration:**
- **Language**: Set OCR language (eng, spa, fra, deu, chi_sim, etc.)
- **Page Segmentation Mode (PSM)**: How Tesseract segments the page
  - PSM 3: Fully automatic (recommended for most cases)
  - PSM 6: Uniform block of text (good for paragraphs)
  - PSM 11: Sparse text (good for scattered handwritten notes)
- **OCR Engine Mode (OEM)**: Choose between Legacy, LSTM, or hybrid engine

**Image Preprocessing:**
- **Enable Preprocessing**: Toggle image enhancements on/off
- **Grayscale**: Convert to grayscale for better accuracy
- **Contrast**: Adjust contrast (2.0-2.5 recommended for handwriting)
- **Brightness**: Adjust brightness (1.2 recommended)
- **Sharpening**: Enable for blurry or low-quality images (usually off for handwriting)
- **Denoising**: Remove noise using median filter
- **Upscale**: Increase resolution before OCR (3x recommended for handwriting)
- **Binarization Mode**: 
  - Otsu (automatic - recommended)
  - Adaptive (local threshold - best for varying lighting)
  - Fixed threshold (manual control)
- **Morphological Operations**: Connect broken strokes and remove noise
- **Auto-deskew**: Automatically correct small rotation angles

## Note Format

Created notes have the following structure:

```markdown
---
title: Meeting Notes
date: 2026-01-14
tags: value
---

[OCR extracted text content]
```

## Troubleshooting

If OCR results are poor or you're getting gibberish text, see the **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** guide for detailed solutions and recommended settings.

## Requirements

- Obsidian v0.15.0 or higher
- Node.js v16 or higher (for development)

## Technologies

- [Tesseract.js](https://tesseract.projectnaptha.com/) - Pure JavaScript OCR engine
- TypeScript
- Obsidian API

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
