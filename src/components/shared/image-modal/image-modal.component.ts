import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-image-modal',
  templateUrl: './image-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageModalComponent {
  imageUrl = input.required<string>();
  closeModal = output<void>();
}
