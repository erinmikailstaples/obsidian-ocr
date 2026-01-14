# OCR Troubleshooting Guide

## Poor OCR Results / Gibberish Text

If the OCR is producing nonsensical text, try these solutions in order:

### 1. Enable Image Preprocessing (Recommended)

Go to **Settings → OCR Image to Note → Image Preprocessing**:
- ✅ Enable preprocessing
- ✅ Convert to grayscale
- Set **Contrast** to **1.5** or higher
- Set **Brightness** to **1.1**
- ✅ Apply sharpening

### 2. Adjust Page Segmentation Mode

Go to **Settings → OCR Configuration → Page Segmentation Mode**:

**For handwritten notes:**
- Try **PSM 6** (Uniform block of text)
- Or **PSM 11** (Sparse text)

**For printed text:**
- Use **PSM 3** (Fully automatic) - default

**For single lines:**
- Try **PSM 7** (Single text line)

### 3. Check Your Image Quality

Good OCR requires:
- ✅ Well-lit images (avoid shadows)
- ✅ Clear, in-focus text
- ✅ Good contrast between text and background
- ✅ Straight orientation (not rotated)
- ✅ High resolution (at least 300 DPI for best results)

Avoid:
- ❌ Blurry or out-of-focus images
- ❌ Low contrast (light text on light background)
- ❌ Very small text
- ❌ Heavy compression artifacts

### 4. Adjust Preprocessing Settings for Your Image

**For faint handwriting:**
- Increase **Contrast** to 2.0-2.5
- Increase **Brightness** to 1.3-1.5

**For blurry images:**
- ✅ Enable **Sharpening**
- Increase **Contrast** to 1.5-2.0

**For dark images:**
- Increase **Brightness** to 1.5-2.0
- Increase **Contrast** to 1.8

**For very light/washed out images:**
- Increase **Contrast** to 2.5-3.0
- Keep **Brightness** at 1.0

### 5. Language Settings

If your text is not in English:

Go to **Settings → OCR Configuration → Language** and set the appropriate language code:
- `spa` - Spanish
- `fra` - French
- `deu` - German
- `chi_sim` - Simplified Chinese
- `chi_tra` - Traditional Chinese
- `jpn` - Japanese
- `ara` - Arabic
- `rus` - Russian

For multiple languages, use `+` (e.g., `eng+spa`)

### 6. Pre-process Your Image Before Upload

For best results, edit your image before uploading:
1. Take a straight, well-lit photo
2. Crop to just the text area
3. Increase contrast using a photo editor
4. Convert to black and white if needed
5. Ensure resolution is at least 300 DPI

## Common Issues

### "OCR processing failed"

**Causes:**
- Invalid image file
- Image too large
- Language pack not available

**Solutions:**
1. Try a different image format (PNG or JPG recommended)
2. Reduce image size to under 5MB
3. Check that the language code is correct

### Very Slow Processing

**Causes:**
- Large image files
- First-time language data download
- Multiple preprocessing steps enabled

**Solutions:**
1. Resize images to 1920x1080 or smaller before upload
2. Wait for initial language data to download (one-time)
3. Disable sharpening if not needed

### Text Is Backwards or Rotated

**Solution:**
- Rotate your image before uploading
- The plugin doesn't auto-rotate images

### Missing Characters or Words

**Solutions:**
1. Increase **Contrast** to make text more visible
2. Try **PSM 11** (Sparse text) for scattered notes
3. Check if your image has sufficient resolution
4. Enable **Sharpening** for better edge detection

## Recommended Settings by Use Case

### Handwritten Meeting Notes
```
PSM: 6 or 11
OEM: 1 (LSTM)
Preprocessing: ON
Grayscale: ON
Contrast: 1.8-2.2
Brightness: 1.1-1.3
Sharpening: ON
```

### Printed Documents
```
PSM: 3
OEM: 1 (LSTM)
Preprocessing: ON
Grayscale: ON
Contrast: 1.2-1.5
Brightness: 1.0-1.1
Sharpening: OFF
```

### Phone Photos of Whiteboards
```
PSM: 6
OEM: 1 (LSTM)
Preprocessing: ON
Grayscale: ON
Contrast: 2.0-2.5
Brightness: 1.2-1.5
Sharpening: ON
```

### Screenshots
```
PSM: 3
OEM: 1 (LSTM)
Preprocessing: OFF
(Screenshots are already digital and clear)
```

## Still Having Issues?

1. Check the browser console (Cmd+Option+I on macOS) for error messages
2. Try disabling preprocessing to see if that's causing issues
3. Test with a simple, high-quality printed text image first
4. Experiment with different PSM and contrast settings
5. Consider using an external tool to enhance your image first

## Best Practices

1. **Start with good source material** - Better input = better output
2. **Test settings with a sample image** before processing many images
3. **Use the edit modal** to correct OCR errors before creating the note
4. **Keep preprocessing enabled** for handwritten text
5. **Adjust contrast first** - it has the biggest impact on accuracy
