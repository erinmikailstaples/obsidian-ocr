import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { createWorker } from 'tesseract.js';

interface OCRPluginSettings {
	defaultFolder: string;
}

const DEFAULT_SETTINGS: OCRPluginSettings = {
	defaultFolder: ''
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

			new Notice('Processing image with OCR...');

			try {
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
			} catch (error) {
				new Notice('OCR processing failed: ' + error.message);
				console.error('OCR Error:', error);
			}
		};

		input.click();
	}

	async performOCR(file: File): Promise<string> {
		const worker = await createWorker('eng');
		
		try {
			const { data: { text } } = await worker.recognize(file);
			return text;
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
	}
}
