import { Component, ChangeDetectionStrategy, signal, inject, effect, ElementRef, viewChild, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatbotFaceComponent } from '../shared/chatbot-face/chatbot-face.component';
import { ErrorDisplayComponent } from '../shared/error-display/error-display.component';
import { ApiService, ChatMessage } from '../../services/api.service';

declare const marked: {
  parse(markdown: string): string;
};

type BotMood = 'idle' | 'listening' | 'thinking' | 'speaking';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChatbotFaceComponent, ErrorDisplayComponent],
})
export class ChatComponent {
  provider = input.required<string>();
  userApiKey = input.required<string>();

  history = signal<ChatMessage[]>([]);
  userInput = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  botMood = signal<BotMood>('idle');
  
  private apiService = inject(ApiService);
  chatContainer = viewChild<ElementRef<HTMLDivElement>>('chatContainer');

  constructor() {
    effect(() => { this.scrollToBottom(); });
    effect(() => {
        if (this.loading()) this.botMood.set('thinking');
        else if (this.userInput()) this.botMood.set('listening');
        else {
             // FIX: Replace .at(-1) with array index access for broader JS compatibility.
             const lastMessage = this.history()[this.history().length - 1];
             if (lastMessage?.role !== 'model') this.botMood.set('idle');
        }
    });
  }

  async handleSend() {
    if (!this.userInput().trim()) return;

    const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: this.userInput() }] };
    this.history.update(h => [...h, newUserMessage]);
    const currentHistory = this.history();
    this.userInput.set('');
    this.loading.set(true);
    this.error.set(null);

    // Add a placeholder for the streaming response
    this.history.update(h => [...h, { role: 'model', parts: [{ text: '...' }] }]);

    try {
      let fullResponse = '';
      const stream = this.apiService.getChatResponseStream(this.provider(), this.userApiKey(), currentHistory);
      
      for await (const chunk of stream) {
        fullResponse += chunk;
        this.history.update(h => {
          const newHistory = [...h];
          newHistory[newHistory.length - 1] = { role: 'model', parts: [{ text: fullResponse }] };
          return newHistory;
        });
        this.botMood.set('speaking');
      }
    } catch (err: any) {
      this.history.update(h => h.slice(0, -1)); // Remove placeholder
      this.error.set(err.message);
      this.botMood.set('idle');
    } finally {
      this.loading.set(false);
      setTimeout(() => this.botMood.set('idle'), 3000);
    }
  }

  renderMarkdown(content: string): string {
    return marked.parse(content);
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
  
  clearHistory() {
    this.history.set([]);
    this.error.set(null);
  }
  
  private scrollToBottom() {
    if (this.chatContainer()) {
        const el = this.chatContainer()!.nativeElement;
        el.scrollTop = el.scrollHeight;
    }
  }
}
