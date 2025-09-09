import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
  selector: 'app-chatbot-face',
  templateUrl: './chatbot-face.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatbotFaceComponent {
  mood = input.required<'idle' | 'listening' | 'thinking' | 'speaking'>();

  private expressions = {
    idle: { eyeL: 'M 8 12 Q 12 10 16 12', eyeR: 'M 24 12 Q 28 10 32 12', mouth: 'M 14 24 H 26' },
    listening: { eyeL: 'M 8 12 Q 12 14 16 12', eyeR: 'M 24 12 Q 28 14 32 12', mouth: 'M 14 24 H 26' },
    thinking: { eyeL: 'M 10 12 H 14', eyeR: 'M 26 12 H 30', mouth: 'M 16 24 Q 20 22 24 24' },
    speaking: { eyeL: 'M 8 12 Q 12 14 16 12', eyeR: 'M 24 12 Q 28 14 32 12', mouth: 'M 14 24 Q 20 28 26 24' },
  };
  
  currentExpression = computed(() => this.expressions[this.mood()] || this.expressions.idle);
}
