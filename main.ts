import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { createWorker, PSM } from 'tesseract.js';

// Preprocessing utility functions
class ImagePreprocessor {
	// Otsu's method for automatic threshold calculation
	static calculateOtsuThreshold(data: Uint8ClampedArray): number {
		const histogram = new Array(256).fill(0);
		const total = data.length / 4;
		
		for (let i = 0; i < data.length; i += 4) {
			histogram[data[i]]++;
		}
		
		let sum = 0;
		for (let i = 0; i < 256; i++) {
			sum += i * histogram[i];
		}
		
		let sumB = 0, wB = 0, wF = 0;
		let maxVariance = 0, threshold = 0;
		
		for (let t = 0; t < 256; t++) {
			wB += histogram[t];
			if (wB === 0) continue;
			
			wF = total - wB;
			if (wF === 0) break;
			
			sumB += t * histogram[t];
			const mB = sumB / wB;
			const mF = (sum - sumB) / wF;
			
			const variance = wB * wF * (mB - mF) ** 2;
			if (variance > maxVariance) {
				maxVariance = variance;
				threshold = t;
			}
		}
		return threshold;
	}
	
	// Bradley adaptive binarization
	static adaptiveBinarize(imageData: ImageData, windowSize: number): void {
		const data = imageData.data;
		const width = imageData.width;
		const height = imageData.height;
		const halfWindow = Math.floor(windowSize / 2);
		
		// Create integral image
		const integral = new Array(width * height).fill(0);
		for (let y = 0; y < height; y++) {
			let rowSum = 0;
			for (let x = 0; x < width; x++) {
				const idx = (y * width + x) * 4;
				rowSum += data[idx]; // grayscale value
				const above = y > 0 ? integral[(y - 1) * width + x] : 0;
				integral[y * width + x] = rowSum + above;
			}
		}
		
		// Apply adaptive threshold
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const x1 = Math.max(0, x - halfWindow);
				const x2 = Math.min(width - 1, x + halfWindow);
				const y1 = Math.max(0, y - halfWindow);
				const y2 = Math.min(height - 1, y + halfWindow);
				
				const count = (x2 - x1) * (y2 - y1);
				const sum = integral[y2 * width + x2]
					- (x1 > 0 ? integral[y2 * width + (x1 - 1)] : 0)
					- (y1 > 0 ? integral[(y1 - 1) * width + x2] : 0)
					+ (x1 > 0 && y1 > 0 ? integral[(y1 - 1) * width + (x1 - 1)] : 0);
				
				const idx = (y * width + x) * 4;
				const threshold = (sum / count) * 0.85; // 15% below local mean
				const binary = data[idx] > threshold ? 255 : 0;
				
				data[idx] = binary;
				data[idx + 1] = binary;
				data[idx + 2] = binary;
			}
		}
	}
	
	// Morphological closing: dilation followed by erosion
	static morphologicalClosing(imageData: ImageData, kernelSize: number): void {
		this.dilate(imageData, kernelSize);
		this.erode(imageData, kernelSize);
	}
	
	// Morphological opening: erosion followed by dilation
	static morphologicalOpening(imageData: ImageData, kernelSize: number): void {
		this.erode(imageData, kernelSize);
		this.dilate(imageData, kernelSize);
	}
	
	static dilate(imageData: ImageData, kernelSize: number): void {
		const data = imageData.data;
		const width = imageData.width;
		const height = imageData.height;
		const halfKernel = Math.floor(kernelSize / 2);
		const src = new Uint8ClampedArray(data);
		
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let maxVal = 0;
				
				for (let ky = -halfKernel; ky <= halfKernel; ky++) {
					for (let kx = -halfKernel; kx <= halfKernel; kx++) {
						const ny = y + ky;
						const nx = x + kx;
						
						if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
							const idx = (ny * width + nx) * 4;
							maxVal = Math.max(maxVal, src[idx]);
						}
					}
				}
				
				const dstIdx = (y * width + x) * 4;
				data[dstIdx] = maxVal;
				data[dstIdx + 1] = maxVal;
				data[dstIdx + 2] = maxVal;
			}
		}
	}
	
	static erode(imageData: ImageData, kernelSize: number): void {
		const data = imageData.data;
		const width = imageData.width;
		const height = imageData.height;
		const halfKernel = Math.floor(kernelSize / 2);
		const src = new Uint8ClampedArray(data);
		
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let minVal = 255;
				
				for (let ky = -halfKernel; ky <= halfKernel; ky++) {
					for (let kx = -halfKernel; kx <= halfKernel; kx++) {
						const ny = y + ky;
						const nx = x + kx;
						
						if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
							const idx = (ny * width + nx) * 4;
							minVal = Math.min(minVal, src[idx]);
						}
					}
				}
				
				const dstIdx = (y * width + x) * 4;
				data[dstIdx] = minVal;
				data[dstIdx + 1] = minVal;
				data[dstIdx + 2] = minVal;
			}
		}
	}
	
	// Detect skew angle using projection profile
	static detectSkewAngle(imageData: ImageData): number {
		const data = imageData.data;
		const width = imageData.width;
		const height = imageData.height;
		const maxAngle = 15;
		const angleStep = 0.5;
		let maxVariance = 0;
		let bestAngle = 0;
		
		for (let angle = -maxAngle; angle <= maxAngle; angle += angleStep) {
			const radians = (angle * Math.PI) / 180;
			const projection = new Array(height).fill(0);
			
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const idx = (y * width + x) * 4;
					if (data[idx] === 0) { // Black pixel
						const rotatedY = Math.round(y + x * Math.tan(radians));
						if (rotatedY >= 0 && rotatedY < height) {
							projection[rotatedY]++;
						}
					}
				}
			}
			
			// Calculate variance of projection
			const mean = projection.reduce((a, b) => a + b, 0) / projection.length;
			const variance = projection.reduce((sum, val) => sum + (val - mean) ** 2, 0) / projection.length;
			
			if (variance > maxVariance) {
				maxVariance = variance;
				bestAngle = angle;
			}
		}
		
		return bestAngle;
	}
	
	static rotateImage(canvas: HTMLCanvasElement, angle: number): void {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		
		const radians = (angle * Math.PI) / 180;
		const tempCanvas = document.createElement('canvas');
		tempCanvas.width = canvas.width;
		tempCanvas.height = canvas.height;
		const tempCtx = tempCanvas.getContext('2d');
		if (!tempCtx) return;
		
		tempCtx.drawImage(canvas, 0, 0);
		
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.rotate(radians);
		ctx.drawImage(tempCanvas, -canvas.width / 2, -canvas.height / 2);
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	}
}

interface OCRPluginSettings {
	defaultFolder: string;
	language: string;
	preprocessImage: boolean;
	contrast: number;
	brightness: number;
	grayscale: boolean;
	sharpen: boolean;
	binarize: boolean;
	binarizeMode: 'fixed' | 'otsu' | 'adaptive';
	binarizeThreshold: number;
	adaptiveWindowSize: number;
	denoise: boolean;
	upscale: boolean;
	upscaleFactor: number;
	morphologicalOps: boolean;
	morphKernelSize: number;
	deskew: boolean;
	showPreview: boolean;
	preset: string;
	psm: string;
	oem: string;
}

const DEFAULT_SETTINGS: OCRPluginSettings = {
	defaultFolder: '',
	language: 'eng',
	preprocessImage: true,
	contrast: 2.0,
	brightness: 1.2,
	grayscale: true,
	sharpen: false,
	binarize: true,
	binarizeMode: 'otsu',  // Automatic threshold detection
	binarizeThreshold: 140,
	adaptiveWindowSize: 15,
	denoise: true,
	upscale: true,
	upscaleFactor: 3,
	morphologicalOps: true,
	morphKernelSize: 2,
	deskew: true,
	showPreview: true,
	preset: 'handwriting',
	psm: '6',
	oem: '1'
}

export default class OCRPlugin extends Plugin {
	settings: OCRPluginSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		this.addRibbonIcon('image-file', 'OCR Image to Note', () => {
			this.uploadAndProcessImage();
		});

		// Add command
		this.addCommand({
			id: 'ocr-image-to-note',
			name: 'Convert image to note',
			callback: () => {
				this.uploadAndProcessImage();
			}
		});

		// Add settings tab
		this.addSettingTab(new OCRSettingTab(this.app, this));
	}

	async uploadAndProcessImage() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.multiple = false;

		input.onchange = async (e: Event) => {
			const target = e.target as HTMLInputElement;
			const file = target.files?.[0];
			
			if (!file) {
				new Notice('No file selected');
				return;
			}

			try {
				if (this.settings.showPreview) {
					// Show preview modal first
					new PreprocessingPreviewModal(
						this.app,
						this,
						file,
						async (processedFile: File) => {
							new Notice('Processing image with OCR...');
							const ocrText = await this.performOCR(processedFile);
							
							// Show metadata modal
							new OCRMetadataModal(
								this.app,
								ocrText,
								this.settings.defaultFolder,
								async (title: string, date: string, metadata: Record<string, string>, content: string) => {
									await this.createNote(title, date, metadata, content);
								}
							).open();
						}
					).open();
				} else {
					// Process directly without preview
					new Notice('Processing image with OCR...');
					const ocrText = await this.performOCR(file);
					
					// Show modal to edit metadata before creating note
					new OCRMetadataModal(
						this.app,
						ocrText,
						this.settings.defaultFolder,
						async (title: string, date: string, metadata: Record<string, string>, content: string) => {
							await this.createNote(title, date, metadata, content);
						}
					).open();
				}
			} catch (error) {
				new Notice('OCR processing failed: ' + error.message);
				console.error('OCR Error:', error);
			}
		};

		input.click();
	}

	async preprocessImage(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement('canvas');
					const ctx = canvas.getContext('2d');
					
					if (!ctx) {
						reject(new Error('Failed to get canvas context'));
						return;
					}
					
					// Apply upscaling if enabled
					const scale = this.settings.upscale ? this.settings.upscaleFactor : 1;
					canvas.width = img.width * scale;
					canvas.height = img.height * scale;
					
					// Draw image with upscaling
					ctx.imageSmoothingEnabled = true;
					ctx.imageSmoothingQuality = 'high';
					ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
					
					if (this.settings.preprocessImage) {
						const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
						const data = imageData.data;
						
						// Apply grayscale
						if (this.settings.grayscale) {
							for (let i = 0; i < data.length; i += 4) {
								const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
								data[i] = avg;
								data[i + 1] = avg;
								data[i + 2] = avg;
							}
						}
						
						// Apply contrast and brightness
						const contrast = this.settings.contrast;
						const brightness = this.settings.brightness;
						const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
						
						for (let i = 0; i < data.length; i += 4) {
							data[i] = factor * (data[i] - 128) + 128 + (brightness - 1) * 50;
							data[i + 1] = factor * (data[i + 1] - 128) + 128 + (brightness - 1) * 50;
							data[i + 2] = factor * (data[i + 2] - 128) + 128 + (brightness - 1) * 50;
						}
						
						// Apply sharpening
						if (this.settings.sharpen) {
							const weights = [
								0, -1, 0,
								-1, 5, -1,
								0, -1, 0
							];
							const side = Math.round(Math.sqrt(weights.length));
							const halfSide = Math.floor(side / 2);
							
							const src = new Uint8ClampedArray(data);
							const w = canvas.width;
							const h = canvas.height;
							
							for (let y = 0; y < h; y++) {
								for (let x = 0; x < w; x++) {
									const sy = y;
									const sx = x;
									const dstOff = (y * w + x) * 4;
									let r = 0, g = 0, b = 0;
									
									for (let cy = 0; cy < side; cy++) {
										for (let cx = 0; cx < side; cx++) {
											const scy = sy + cy - halfSide;
											const scx = sx + cx - halfSide;
											
											if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
												const srcOff = (scy * w + scx) * 4;
												const wt = weights[cy * side + cx];
												r += src[srcOff] * wt;
												g += src[srcOff + 1] * wt;
												b += src[srcOff + 2] * wt;
											}
										}
									}
									
									data[dstOff] = r;
									data[dstOff + 1] = g;
									data[dstOff + 2] = b;
								}
							}
						}
						
						// Apply denoising
						if (this.settings.denoise) {
							const w = canvas.width;
							const h = canvas.height;
							const src = new Uint8ClampedArray(data);
							
							// Simple median filter for denoising
							for (let y = 1; y < h - 1; y++) {
								for (let x = 1; x < w - 1; x++) {
									const values: number[] = [];
									
									for (let dy = -1; dy <= 1; dy++) {
										for (let dx = -1; dx <= 1; dx++) {
											const idx = ((y + dy) * w + (x + dx)) * 4;
											values.push(src[idx]);
										}
									}
									
									values.sort((a, b) => a - b);
									const median = values[4]; // Middle value of 9 pixels
									
									const dstOff = (y * w + x) * 4;
									data[dstOff] = median;
									data[dstOff + 1] = median;
									data[dstOff + 2] = median;
								}
							}
						}
						
						// Apply binarization (crucial for OCR)
						if (this.settings.binarize) {
							if (this.settings.binarizeMode === 'otsu') {
								// Automatic threshold detection using Otsu's method
								const threshold = ImagePreprocessor.calculateOtsuThreshold(data);
								for (let i = 0; i < data.length; i += 4) {
									const gray = data[i];
									const binary = gray > threshold ? 255 : 0;
									data[i] = binary;
									data[i + 1] = binary;
									data[i + 2] = binary;
								}
							} else if (this.settings.binarizeMode === 'adaptive') {
								// Local adaptive binarization (Bradley method)
								ImagePreprocessor.adaptiveBinarize(imageData, this.settings.adaptiveWindowSize);
							} else {
								// Fixed threshold
								const threshold = this.settings.binarizeThreshold;
								for (let i = 0; i < data.length; i += 4) {
									const gray = data[i];
									const binary = gray > threshold ? 255 : 0;
									data[i] = binary;
									data[i + 1] = binary;
									data[i + 2] = binary;
								}
							}
						}
						
						// Apply morphological operations to clean up and connect strokes
						if (this.settings.morphologicalOps) {
							ImagePreprocessor.morphologicalClosing(imageData, this.settings.morphKernelSize);
						}
						
						// Apply deskewing if enabled
						if (this.settings.deskew) {
							ctx.putImageData(imageData, 0, 0);
							const angle = ImagePreprocessor.detectSkewAngle(imageData);
							if (Math.abs(angle) > 0.5) { // Only rotate if angle is significant
								ImagePreprocessor.rotateImage(canvas, -angle);
							}
							return; // Skip second putImageData below
						}
						
						ctx.putImageData(imageData, 0, 0);
					}
					
					resolve(canvas.toDataURL());
				};
				img.onerror = () => reject(new Error('Failed to load image'));
				img.src = e.target?.result as string;
			};
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsDataURL(file);
		});
	}

	async performOCR(file: File): Promise<string> {
		const worker = await createWorker(this.settings.language, 1, {
			logger: m => console.log(m)
		});
		
		try {
			// Configure Tesseract parameters for better accuracy
			await worker.setParameters({
				tessedit_pageseg_mode: this.settings.psm as PSM,
				tessedit_ocr_engine_mode: parseInt(this.settings.oem),
				preserve_interword_spaces: '1',
				tessedit_char_whitelist: '',  // Add characters here if needed
			});
			
			// Preprocess image if enabled
			const imageData = this.settings.preprocessImage 
				? await this.preprocessImage(file)
				: file;
			
			const { data: { text } } = await worker.recognize(imageData);
			return text.trim();
		} finally {
			await worker.terminate();
		}
	}

	async createNote(title: string, date: string, metadata: Record<string, string>, content: string) {
		// Build frontmatter
		let frontmatter = '---\n';
		frontmatter += `title: ${title}\n`;
		frontmatter += `date: ${date}\n`;
		
		// Add custom metadata fields
		for (const [key, value] of Object.entries(metadata)) {
			if (key && value) {
				frontmatter += `${key}: ${value}\n`;
			}
		}
		
		frontmatter += '---\n\n';

		// Combine frontmatter and content
		const noteContent = frontmatter + content;

		// Sanitize filename
		const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, '-');
		const filename = `${sanitizedTitle}.md`;

		// Determine file path
		let folder = this.settings.defaultFolder;
		if (folder && !folder.endsWith('/')) {
			folder += '/';
		}
		const filepath = folder + filename;

		try {
			// Check if file exists
			const existingFile = this.app.vault.getAbstractFileByPath(filepath);
			if (existingFile instanceof TFile) {
				new Notice(`File already exists: ${filename}`);
				return;
			}

			// Create the note
			const file = await this.app.vault.create(filepath, noteContent);
			
			// Open the note
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(file);
			
			new Notice(`Note created: ${filename}`);
		} catch (error) {
			new Notice('Failed to create note: ' + error.message);
			console.error('Create Note Error:', error);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class PreprocessingPreviewModal extends Modal {
	plugin: OCRPlugin;
	originalFile: File;
	onSubmit: (processedFile: File) => void;
	originalCanvas: HTMLCanvasElement;
	processedCanvas: HTMLCanvasElement;
	
	constructor(
		app: App,
		plugin: OCRPlugin,
		file: File,
		onSubmit: (processedFile: File) => void
	) {
		super(app);
		this.plugin = plugin;
		this.originalFile = file;
		this.onSubmit = onSubmit;
		this.originalCanvas = document.createElement('canvas');
		this.processedCanvas = document.createElement('canvas');
	}
	
	async onOpen() {
		const { contentEl } = this;
		
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Preprocessing Preview' });
		contentEl.createEl('p', { 
			text: 'Review the preprocessed image before running OCR. Adjust settings in the plugin settings if needed.',
			cls: 'setting-item-description'
		});
		
		// Create image comparison container
		const compareContainer = contentEl.createDiv();
		compareContainer.addClass('ocr-compare-container');
		compareContainer.style.display = 'flex';
		compareContainer.style.gap = '10px';
		compareContainer.style.marginBottom = '20px';
		
		const originalDiv = compareContainer.createDiv();
		originalDiv.style.flex = '1';
		originalDiv.createEl('h3', { text: 'Original' });
		originalDiv.appendChild(this.originalCanvas);
		this.originalCanvas.style.maxWidth = '100%';
		this.originalCanvas.style.border = '1px solid var(--background-modifier-border)';
		
		const processedDiv = compareContainer.createDiv();
		processedDiv.style.flex = '1';
		processedDiv.createEl('h3', { text: 'Preprocessed' });
		processedDiv.appendChild(this.processedCanvas);
		this.processedCanvas.style.maxWidth = '100%';
		this.processedCanvas.style.border = '1px solid var(--background-modifier-border)';
		
		// Load and process images
		await this.loadImages();
		
		// Buttons
		const buttonContainer = contentEl.createDiv();
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '10px';
		
		new Setting(buttonContainer)
			.addButton(button => button
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				}))
			.addButton(button => button
				.setButtonText('Proceed with OCR')
				.setCta()
				.onClick(async () => {
					// Convert processed canvas to file
					const blob = await new Promise<Blob>((resolve) => {
						this.processedCanvas.toBlob((b) => resolve(b!), 'image/png');
					});
					const processedFile = new File([blob], this.originalFile.name, { type: 'image/png' });
					this.close();
					this.onSubmit(processedFile);
				}));
	}
	
	async loadImages() {
		return new Promise<void>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = async () => {
					// Draw original
					const maxWidth = 400;
					const scale = img.width > maxWidth ? maxWidth / img.width : 1;
					this.originalCanvas.width = img.width * scale;
					this.originalCanvas.height = img.height * scale;
					const origCtx = this.originalCanvas.getContext('2d');
					if (origCtx) {
						origCtx.drawImage(img, 0, 0, this.originalCanvas.width, this.originalCanvas.height);
					}
					
					// Process and draw processed version
					try {
						const processedDataUrl = await this.plugin.preprocessImage(this.originalFile);
						const processedImg = new Image();
						processedImg.onload = () => {
							const procScale = processedImg.width > maxWidth ? maxWidth / processedImg.width : 1;
							this.processedCanvas.width = processedImg.width * procScale;
							this.processedCanvas.height = processedImg.height * procScale;
							const procCtx = this.processedCanvas.getContext('2d');
							if (procCtx) {
								procCtx.drawImage(processedImg, 0, 0, this.processedCanvas.width, this.processedCanvas.height);
							}
							resolve();
						};
						processedImg.onerror = () => reject(new Error('Failed to load processed image'));
						processedImg.src = processedDataUrl;
					} catch (error) {
						reject(error);
					}
				};
				img.onerror = () => reject(new Error('Failed to load image'));
				img.src = e.target?.result as string;
			};
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsDataURL(this.originalFile);
		});
	}
	
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class OCRMetadataModal extends Modal {
	ocrText: string;
	defaultFolder: string;
	onSubmit: (title: string, date: string, metadata: Record<string, string>, content: string) => void;
	
	titleValue: string;
	dateValue: string;
	contentValue: string;
	metadataFields: Array<{key: string, value: string}>;

	constructor(
		app: App,
		ocrText: string,
		defaultFolder: string,
		onSubmit: (title: string, date: string, metadata: Record<string, string>, content: string) => void
	) {
		super(app);
		this.ocrText = ocrText;
		this.defaultFolder = defaultFolder;
		this.onSubmit = onSubmit;
		
		// Set defaults
		this.titleValue = 'Meeting Notes';
		this.dateValue = this.getCurrentDate();
		this.contentValue = ocrText;
		this.metadataFields = [];
	}

	getCurrentDate(): string {
		const now = new Date();
		return now.toISOString().split('T')[0]; // YYYY-MM-DD format
	}

	onOpen() {
		const { contentEl } = this;
		
		contentEl.empty();
		contentEl.createEl('h2', { text: 'Create Note from OCR' });

		// Title field
		new Setting(contentEl)
			.setName('Title')
			.setDesc('Title of the note')
			.addText(text => text
				.setValue(this.titleValue)
				.onChange(value => {
					this.titleValue = value;
				}));

		// Date field
		new Setting(contentEl)
			.setName('Date')
			.setDesc('Date of the meeting')
			.addText(text => text
				.setValue(this.dateValue)
				.onChange(value => {
					this.dateValue = value;
				}));

		// Additional metadata section
		contentEl.createEl('h3', { text: 'Additional Metadata' });
		
		const metadataContainer = contentEl.createDiv();
		metadataContainer.addClass('metadata-container');

		const renderMetadataFields = () => {
			metadataContainer.empty();
			
			this.metadataFields.forEach((field, index) => {
				const fieldDiv = metadataContainer.createDiv();
				fieldDiv.addClass('metadata-field');
				
				new Setting(fieldDiv)
					.setName(`Field ${index + 1}`)
					.addText(text => text
						.setPlaceholder('Key')
						.setValue(field.key)
						.onChange(value => {
							this.metadataFields[index].key = value;
						}))
					.addText(text => text
						.setPlaceholder('Value')
						.setValue(field.value)
						.onChange(value => {
							this.metadataFields[index].value = value;
						}))
					.addButton(button => button
						.setButtonText('Remove')
						.onClick(() => {
							this.metadataFields.splice(index, 1);
							renderMetadataFields();
						}));
			});
		};

		renderMetadataFields();

		// Add metadata field button
		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Add Metadata Field')
				.setCta()
				.onClick(() => {
					this.metadataFields.push({ key: '', value: '' });
					renderMetadataFields();
				}));

		// Content field
		contentEl.createEl('h3', { text: 'Content' });
		new Setting(contentEl)
			.setName('OCR Text')
			.setDesc('Edit the extracted text')
			.addTextArea(text => {
				text
					.setValue(this.contentValue)
					.onChange(value => {
						this.contentValue = value;
					});
				text.inputEl.rows = 10;
				text.inputEl.cols = 50;
			});

		// Submit button
		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Create Note')
				.setCta()
				.onClick(() => {
					// Build metadata object
					const metadata: Record<string, string> = {};
					this.metadataFields.forEach(field => {
						if (field.key) {
							metadata[field.key] = field.value;
						}
					});
					
					this.onSubmit(this.titleValue, this.dateValue, metadata, this.contentValue);
					this.close();
				}))
			.addButton(button => button
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class OCRSettingTab extends PluginSettingTab {
	plugin: OCRPlugin;

	constructor(app: App, plugin: OCRPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'OCR Plugin Settings' });

		// General Settings
		containerEl.createEl('h3', { text: 'General' });

		new Setting(containerEl)
			.setName('Default folder')
			.setDesc('Default folder for new notes (leave empty for vault root)')
			.addText(text => text
				.setPlaceholder('folder/subfolder')
				.setValue(this.plugin.settings.defaultFolder)
				.onChange(async (value) => {
					this.plugin.settings.defaultFolder = value;
					await this.plugin.saveSettings();
				}));

		// OCR Settings
		containerEl.createEl('h3', { text: 'OCR Configuration' });

		new Setting(containerEl)
			.setName('Language')
			.setDesc('Tesseract language code (e.g., eng, spa, fra, deu, chi_sim)')
			.addText(text => text
				.setPlaceholder('eng')
				.setValue(this.plugin.settings.language)
				.onChange(async (value) => {
					this.plugin.settings.language = value || 'eng';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Page Segmentation Mode (PSM)')
			.setDesc('How Tesseract segments the page. 3=Fully automatic (default), 6=Assume uniform block of text, 11=Sparse text')
			.addDropdown(dropdown => dropdown
				.addOption('0', '0 - Orientation and script detection only')
				.addOption('1', '1 - Automatic with OSD')
				.addOption('3', '3 - Fully automatic (recommended)')
				.addOption('4', '4 - Single column of text')
				.addOption('6', '6 - Uniform block of text')
				.addOption('7', '7 - Single text line')
				.addOption('8', '8 - Single word')
				.addOption('11', '11 - Sparse text')
				.addOption('13', '13 - Raw line (no segmentation)')
				.setValue(this.plugin.settings.psm)
				.onChange(async (value) => {
					this.plugin.settings.psm = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('OCR Engine Mode (OEM)')
			.setDesc('OCR engine to use. 1=LSTM only (recommended), 0=Legacy, 2=Legacy+LSTM')
			.addDropdown(dropdown => dropdown
				.addOption('0', '0 - Legacy engine only')
				.addOption('1', '1 - LSTM engine (recommended)')
				.addOption('2', '2 - Legacy + LSTM')
				.addOption('3', '3 - Default (based on what is available)')
				.setValue(this.plugin.settings.oem)
				.onChange(async (value) => {
					this.plugin.settings.oem = value;
					await this.plugin.saveSettings();
				}));

	// Image Preprocessing
	containerEl.createEl('h3', { text: 'Image Preprocessing' });
	containerEl.createEl('p', { 
		text: 'These settings are optimized for handwriting. Adjust contrast (2.0+) and binarization threshold (130-150) for best results with your handwriting style.',
		cls: 'setting-item-description'
	});

	new Setting(containerEl)
			.setName('Show preprocessing preview')
			.setDesc('Show before/after comparison before running OCR')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showPreview)
				.onChange(async (value) => {
					this.plugin.settings.showPreview = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Enable preprocessing')
			.setDesc('Apply image enhancements before OCR (essential for handwriting)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.preprocessImage)
				.onChange(async (value) => {
					this.plugin.settings.preprocessImage = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Convert to grayscale')
			.setDesc('Convert image to grayscale (improves accuracy for most cases)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.grayscale)
				.onChange(async (value) => {
					this.plugin.settings.grayscale = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Contrast')
			.setDesc('Higher contrast crucial for handwriting (2.0-2.5 recommended for handwriting)')
			.addSlider(slider => slider
				.setLimits(0.5, 3.0, 0.1)
				.setValue(this.plugin.settings.contrast)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.contrast = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Brightness')
			.setDesc('Adjust brightness (1.2 recommended for handwriting)')
			.addSlider(slider => slider
				.setLimits(0.5, 2.0, 0.1)
				.setValue(this.plugin.settings.brightness)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.brightness = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Apply sharpening')
			.setDesc('Usually OFF for handwriting (can create artifacts). Enable only for very blurry text')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.sharpen)
				.onChange(async (value) => {
					this.plugin.settings.sharpen = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Apply denoising')
			.setDesc('Remove noise from the image (recommended for photos of documents)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.denoise)
				.onChange(async (value) => {
					this.plugin.settings.denoise = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Upscale image')
			.setDesc('Increase image resolution before OCR (helps with small text)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.upscale)
				.onChange(async (value) => {
					this.plugin.settings.upscale = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Upscale factor')
			.setDesc('3x recommended for handwriting (higher resolution = better accuracy)')
			.addSlider(slider => slider
				.setLimits(1, 4, 0.5)
				.setValue(this.plugin.settings.upscaleFactor)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.upscaleFactor = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Binarize (Black & White)')
			.setDesc('Convert to pure black & white - crucial for OCR accuracy (recommended)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.binarize)
				.onChange(async (value) => {
					this.plugin.settings.binarize = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Binarization mode')
			.setDesc('Otsu (automatic) works best for most cases. Try adaptive for varying lighting.')
			.addDropdown(dropdown => dropdown
				.addOption('fixed', 'Fixed threshold')
				.addOption('otsu', 'Otsu (automatic - recommended)')
				.addOption('adaptive', 'Adaptive (local threshold)')
				.setValue(this.plugin.settings.binarizeMode)
				.onChange(async (value: 'fixed' | 'otsu' | 'adaptive') => {
					this.plugin.settings.binarizeMode = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Fixed binarization threshold')
			.setDesc('Only used if mode is "Fixed". For handwriting: 130-150')
			.addSlider(slider => slider
				.setLimits(50, 200, 5)
				.setValue(this.plugin.settings.binarizeThreshold)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.binarizeThreshold = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Adaptive window size')
			.setDesc('Only used if mode is "Adaptive". Larger = more global, smaller = more local')
			.addSlider(slider => slider
				.setLimits(5, 50, 5)
				.setValue(this.plugin.settings.adaptiveWindowSize)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.adaptiveWindowSize = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Morphological operations')
			.setDesc('Connect broken strokes and remove noise (recommended for handwriting)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.morphologicalOps)
				.onChange(async (value) => {
					this.plugin.settings.morphologicalOps = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Morphological kernel size')
			.setDesc('Size of morphological operations (2-3 recommended)')
			.addSlider(slider => slider
				.setLimits(1, 5, 1)
				.setValue(this.plugin.settings.morphKernelSize)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.morphKernelSize = value;
					await this.plugin.saveSettings();
				}));

	new Setting(containerEl)
			.setName('Auto-deskew (rotation correction)')
			.setDesc('Automatically detect and correct small rotation angles')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.deskew)
				.onChange(async (value) => {
					this.plugin.settings.deskew = value;
					await this.plugin.saveSettings();
				}));

	// Tips section
	containerEl.createEl('h3', { text: 'Tips for Better Handwriting OCR' });
	containerEl.createEl('p', { 
		text: '⚠️ Note: Tesseract is trained primarily for printed text. Handwriting recognition accuracy varies greatly depending on writing style and legibility.',
		cls: 'setting-item-description'
	});
	const tipsList = containerEl.createEl('ul', { cls: 'ocr-tips' });
	tipsList.createEl('li', { text: 'Enable "Show preprocessing preview" to see how your settings affect the image' });
	tipsList.createEl('li', { text: 'Use Otsu binarization mode (automatic) for best results with varying images' });
	tipsList.createEl('li', { text: 'Try adaptive binarization if image has uneven lighting or shadows' });
	tipsList.createEl('li', { text: 'Take photos in bright, even lighting with the text perpendicular to camera' });
	tipsList.createEl('li', { text: 'Use 3x upscaling for small or tightly-spaced handwriting' });
	tipsList.createEl('li', { text: 'Set contrast to 2.0-2.5 for faint pen/pencil' });
	tipsList.createEl('li', { text: 'Enable morphological operations to connect broken handwriting strokes' });
	tipsList.createEl('li', { text: 'Auto-deskew helps with slightly rotated photos' });
	tipsList.createEl('li', { text: 'Keep sharpening OFF - it creates artifacts with handwriting' });
	tipsList.createEl('li', { text: 'PSM 6 (default) works for paragraphs, try PSM 11 for sparse notes' });
	tipsList.createEl('li', { text: 'Cursive and highly stylized handwriting will have poor results' });
	tipsList.createEl('li', { text: 'Print-style handwriting with clear separation between letters works best' });
	}
}
