# Changelog

## [Unreleased] - Enhanced Handwriting Recognition

### Added
- **Preprocessing Preview Modal**: Live side-by-side comparison of original vs preprocessed images before OCR
- **Adaptive Binarization**: 
  - Otsu's method for automatic threshold detection (recommended)
  - Bradley adaptive binarization for images with varying lighting
  - Configurable binarization mode selection (Fixed/Otsu/Adaptive)
- **Morphological Operations**: 
  - Morphological closing to connect broken handwriting strokes
  - Configurable kernel size for fine-tuning
- **Auto-Deskewing**: Automatic detection and correction of small rotation angles (±15 degrees)
- **Enhanced Settings**:
  - Toggle for preprocessing preview
  - Binarization mode selector
  - Adaptive window size control
  - Morphological operations toggle and kernel size
  - Auto-deskew toggle

### Improved
- Default settings now optimized for handwriting with Otsu binarization
- Updated contrast default to 2.0 (from 1.5) for better handwriting recognition
- README with comprehensive feature documentation
- TROUBLESHOOTING guide with updated recommended settings for different use cases

### Technical Details
- Added `ImagePreprocessor` utility class with static methods for:
  - `calculateOtsuThreshold()`: Automatic threshold calculation
  - `adaptiveBinarize()`: Local adaptive binarization using integral images
  - `morphologicalClosing()/Opening()`: Morphological image operations
  - `dilate()/erode()`: Core morphological primitives
  - `detectSkewAngle()`: Projection profile-based skew detection
  - `rotateImage()`: Canvas rotation transformation

### Performance
- Adaptive binarization uses integral image technique for O(1) per-pixel computation
- Preprocessing preview caches processed image to avoid recomputation

## [1.0.0] - Initial Release

### Features
- Basic OCR functionality using Tesseract.js
- Image preprocessing (grayscale, contrast, brightness, sharpening)
- Configurable PSM and OEM modes
- Custom note metadata and frontmatter
- Upscaling and denoising
