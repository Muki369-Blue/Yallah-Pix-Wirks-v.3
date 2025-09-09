import { Component, signal, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImageGeneratorComponent } from './components/image-generator/image-generator.component';
import { VideoGeneratorComponent } from './components/video-generator/video-generator.component';
import { ChatComponent } from './components/chat/chat.component';
import { ErrorDisplayComponent } from './components/shared/error-display/error-display.component';
import { SpinnerComponent } from './components/shared/spinner/spinner.component';
import { ApiService } from './services/api.service';
import { ApiProviderManagerComponent, ProviderConfig } from './components/api-provider-manager/api-provider-manager.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ImageGeneratorComponent,
    VideoGeneratorComponent,
    ChatComponent,
    ErrorDisplayComponent,
    SpinnerComponent,
    ApiProviderManagerComponent
  ],
  providers: [ApiService],
})
export class AppComponent {
  page = signal<'image' | 'video' | 'chat'>('image');
  loading = signal(false);
  loadingMessage = signal('');
  error = signal<string | null>(null);

  provider = signal('gemini');
  userApiKey = signal('');

  constructor() {
    effect(() => {
      const currentPage = this.page();
      if (currentPage === 'image') this.provider.set('gemini');
      else if (currentPage === 'video') this.provider.set('demo_video');
      else if (currentPage === 'chat') this.provider.set('gemini_chat');
      
      this.userApiKey.set('');
      this.error.set(null);
      this.loading.set(false);
    }, { allowSignalWrites: true });
  }

  setPage(newPage: 'image' | 'video' | 'chat') {
    this.page.set(newPage);
  }
  
  handleConfigSaved(config: ProviderConfig) {
    this.provider.set(config.provider);
    this.userApiKey.set(config.apiKey);
    this.error.set(null);
  }

  handleGenerationStarted(message: string) {
    this.loading.set(true);
    this.loadingMessage.set(message);
    this.error.set(null);
  }

  handleGenerationComplete(result: { error?: string }) {
    this.loading.set(false);
    if (result.error) {
      this.error.set(result.error);
    }
  }
}
