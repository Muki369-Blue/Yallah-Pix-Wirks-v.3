import { Component, ChangeDetectionStrategy, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, ImageConcept, AspectRatio } from '../../services/api.service';
import { ImageModalComponent } from '../shared/image-modal/image-modal.component';

interface GeneratedImage { id: number; url: string; }

@Component({
  selector: 'app-image-generator',
  templateUrl: './image-generator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ImageModalComponent],
})
export class ImageGeneratorComponent {
  // Inputs & Outputs for State Management
  provider = input.required<string>();
  userApiKey = input.required<string>();
  generationStarted = output<string>();
  generationComplete = output<{ error?: string }>();
  
  // Local State
  songTitle = signal('');
  prompt = signal('');
  negativePrompt = signal('ugly, blurry, deformed, disfigured, poor details, bad anatomy');
  promptSuggestions = signal<ImageConcept[]>([]);
  imageUrls = signal<GeneratedImage[]>([]);
  selectedImageUrl = signal<string | null>(null);
  numOutputs = signal(2);
  aspectRatio = signal<AspectRatio>('1:1');

  private apiService = inject(ApiService);
  
  readonly defaultNegativePrompts = ['tiling', 'poorly drawn', 'out of frame', 'extra limbs', 'body out of frame', 'watermark', 'signature', 'cut off', 'draft', 'grainy'];
  readonly suggestions = {
    'Style': ['Surrealism', 'Afrofuturism', 'Glitch art', 'Minimalist line art', 'Vintage film photo', '3D Animation', 'Cyberpunk', 'Psychedelic'],
    'Mood': ['Melancholic city at night', 'Energetic and vibrant', 'Dreamy and ethereal', 'Dark and mysterious', 'Nostalgic and hazy'],
  };

  async generateConcepts() {
    if (!this.songTitle()) { this.generationComplete.emit({ error: 'Please enter a song title.' }); return; }
    this.generationStarted.emit('Generating concepts...');
    this.imageUrls.set([]);
    this.promptSuggestions.set([]);
    try {
      const concepts = await this.apiService.generateImageConcepts(this.songTitle());
      this.promptSuggestions.set(concepts);
      this.generationComplete.emit({});
    } catch (err: any) {
      this.generationComplete.emit({ error: err.message });
    }
  }

  async enhancePrompt(level: 'Subtle' | 'Artistic' | 'Extreme') {
    if (!this.prompt()) { this.generationComplete.emit({ error: 'Please enter a prompt to enhance.' }); return; }
    this.generationStarted.emit(`Enhancing prompt (${level})...`);
    try {
      const enhanced = await this.apiService.enhancePrompt(this.prompt(), level);
      this.prompt.set(enhanced);
      this.generationComplete.emit({});
    } catch (err: any) {
      this.generationComplete.emit({ error: err.message });
    }
  }
  
  async getSurprisePrompt() {
    this.generationStarted.emit('Getting a surprise prompt...');
    try {
        const surprise = await this.apiService.generateSurprisePrompt();
        this.prompt.set(surprise);
        this.generationComplete.emit({});
    } catch (err: any) {
        this.generationComplete.emit({ error: err.message });
    }
  }

  async handleGenerate(regenerateIndex?: number) {
    if (!this.prompt()) { this.generationComplete.emit({ error: 'Please enter a prompt.' }); return; }
    const isRegen = typeof regenerateIndex !== 'undefined';
    const outputs = isRegen ? 1 : this.numOutputs();
    this.generationStarted.emit(isRegen ? 'Regenerating image...' : 'Generating masterpiece...');
    if (!isRegen) {
      this.imageUrls.set([]);
      this.promptSuggestions.set([]);
    }

    try {
      const resultUrls = await this.apiService.generateImages(this.provider(), this.userApiKey(), this.prompt(), outputs, this.negativePrompt(), this.aspectRatio());
      const newImages = resultUrls.map((url, i) => ({ id: Date.now() + i, url }));
      
      if (isRegen) {
        this.imageUrls.update(current => {
          const newArray = [...current];
          newArray[regenerateIndex] = newImages[0];
          return newArray;
        });
      } else {
        this.imageUrls.set(newImages);
      }
      this.generationComplete.emit({});
    } catch (err: any) {
      this.generationComplete.emit({ error: err.message });
    }
  }
  
  downloadImage(url: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `art-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  toggleNegativePromptChip(term: string) {
    const terms = new Set(this.negativePrompt().split(', ').filter(t => t.trim()));
    if (terms.has(term)) terms.delete(term);
    else terms.add(term);
    this.negativePrompt.set(Array.from(terms).join(', '));
  }
  
  addSuggestion(suggestion: string) {
    if (!suggestion) return;
    this.prompt.update(p => p ? `${p}, ${suggestion}` : suggestion);
  }

  selectConcept(concept: ImageConcept) {
    this.prompt.set(concept.prompt);
    this.promptSuggestions.set([]);
  }
}
