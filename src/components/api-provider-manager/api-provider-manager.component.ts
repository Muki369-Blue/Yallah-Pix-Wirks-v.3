import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

export interface ProviderConfig { provider: string; apiKey: string; }
interface ProviderInfo { id: string; name: string; description: string; }
type KeyStatus = 'unverified' | 'valid' | 'invalid' | 'verifying';

@Component({
  selector: 'app-api-provider-manager',
  templateUrl: './api-provider-manager.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class ApiProviderManagerComponent {
  page = input.required<'image' | 'video' | 'chat'>();
  initialProvider = input.required<string>();
  configSaved = output<ProviderConfig>();

  currentProvider = signal('');
  currentKey = signal('');
  keyStatus = signal<KeyStatus>('unverified');
  
  private apiService = inject(ApiService);

  private readonly imageProviders: ProviderInfo[] = [
    { id: 'gemini', name: 'Google Gemini (Imagen 3)', description: 'Default provider, no API key needed for basic use.' },
    { id: 'openai', name: 'OpenAI (DALL·E 3)', description: 'High-quality image generation. Requires an OpenAI API key.' },
    { id: 'huggingface_image', name: 'Hugging Face (SD3 Medium)', description: 'Community-hosted open-source models. Requires a Hugging Face API key.' },
  ];
  private readonly videoProviders: ProviderInfo[] = [
    { id: 'demo_video', name: 'Demo Mode (Free Test)', description: 'A stock video is returned for UI testing.' },
    { id: 'gemini_veo', name: 'Google Gemini (VEO)', description: 'State-of-the-art video generation. Requires a Google API key.' },
    { id: 'huggingface_video', name: 'Hugging Face (SVD)', description: 'Image-to-Video only. Requires a Hugging Face API key.' },
  ];
  private readonly chatProviders: ProviderInfo[] = [
    { id: 'gemini_chat', name: 'Google Gemini', description: 'Free to use for general conversation.'},
    { id: 'replicate_chat', name: 'Replicate (Community LLM)', description: 'Less-filtered, open-source models. Requires a Replicate API key.'},
    { id: 'huggingface_chat', name: 'Hugging Face (Llama 3)', description: 'Community-hosted open-source models. Requires a Hugging Face API key.'},
  ];

  providers = computed(() => {
    switch (this.page()) {
      case 'image': return this.imageProviders;
      case 'video': return this.videoProviders;
      case 'chat': return this.chatProviders;
    }
  });

  selectedProviderInfo = computed(() => this.providers().find(p => p.id === this.currentProvider()));
  isKeyRequired = computed(() => !['gemini', 'gemini_chat', 'demo_video'].includes(this.currentProvider()));

  constructor() {
    effect(() => {
      this.currentProvider.set(this.initialProvider());
      this.currentKey.set('');
      this.keyStatus.set('unverified');
    });
  }

  async handleSave() {
    if (this.isKeyRequired()) {
        this.keyStatus.set('verifying');
        const isValid = await this.apiService.validateApiKey(this.currentProvider(), this.currentKey());
        this.keyStatus.set(isValid ? 'valid' : 'invalid');
        if (!isValid) return;
    }
    this.configSaved.emit({ provider: this.currentProvider(), apiKey: this.currentKey() });
  }

  updateProvider(provider: string) {
    this.currentProvider.set(provider);
    this.keyStatus.set('unverified');
    if (!this.isKeyRequired()) {
       this.handleSave();
    }
  }
}
