import { Component, ChangeDetectionStrategy, output, signal } from '@angular/core';

@Component({
  selector: 'app-image-uploader',
  templateUrl: './image-uploader.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageUploaderComponent {
  imageUploaded = output<string>();
  isDragging = signal(false);

  private handleFile(file: File) {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e: any) => this.imageUploaded.emit(e.target.result);
      reader.readAsDataURL(file);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.handleFile(input.files[0]);
    }
  }

  handleDrag(event: DragEvent, isDragging: boolean) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(isDragging);
  }

  handleDrop(event: DragEvent) {
    this.handleDrag(event, false);
    if (event.dataTransfer?.files?.[0]) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }
}
