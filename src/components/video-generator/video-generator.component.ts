import { Component, ChangeDetectionStrategy, input, output, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageUploaderComponent } from '../shared/image-uploader/image-uploader.component';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-video-generator',
  templateUrl: './video-generator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ImageUploaderComponent],
})
export class VideoGeneratorComponent {
  // Inputs & Outputs for State Management
  provider = input.required<string>();
  userApiKey = input.required<string>();
  generationStarted = output<string>();
  generationComplete = output<{ error?: string }>();
  
  // Local State
  mode = signal<'text-to-video' | 'image-to-video'>('text-to-video');
  inputImage = signal<string | null>(null);
  prompt = signal('');
  videoUrls = signal<string[]>([]);
  
  private apiService = inject(ApiService);

  constructor() {
    effect(() => {
        const p = this.provider();
        if (p === 'huggingface_video') this.mode.set('image-to-video');
    }, { allowSignalWrites: true });
  }

  async handleGenerate() {
    this.videoUrls.set([]);
    try {
      if (this.mode() === 'image-to-video' && !this.inputImage()) {
        throw new Error('Please upload an image for this mode.');
      }
      if (this.mode() === 'text-to-video' && !this.prompt()) {
        throw new Error('Please enter a prompt for this mode.');
      }
      
      const resultUrl = await this.apiService.generateVideo(this.provider(), this.userApiKey(), this.prompt(), this.inputImage(), (msg) => this.generationStarted.emit(msg));
      this.videoUrls.set([resultUrl]);
      this.generationComplete.emit({});
    } catch (err: any) {
      this.generationComplete.emit({ error: err.message });
    }
  }
}
