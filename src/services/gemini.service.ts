
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from "@google/genai";
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface ImageConcept {
  name: string;
  prompt: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor(private http: HttpClient) {
    // This is a placeholder for the API key. In a real Applet environment,
    // process.env.API_KEY would be substituted.
    const apiKey = (window as any).process?.env?.API_KEY ?? 'YOUR_API_KEY_HERE';
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateImageConcepts(songTitle: string): Promise<ImageConcept[]> {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `For the song title "${songTitle}", generate 3 distinct cover art concepts. Each needs a name and a detailed, artistic prompt for an AI image generator.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            concepts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  prompt: { type: Type.STRING }
                }
              }
            }
          }
        }
      },
    });

    const parsed = JSON.parse(response.text);
    return parsed.concepts || [];
  }

  async enhancePrompt(prompt: string, level: 'Subtle' | 'Artistic' | 'Extreme'): Promise<string> {
    let instruction = "Slightly enhance this prompt with more detail: ";
    if (level === 'Artistic') instruction = "Rewrite this prompt to be much more artistic, vivid, and descriptive: ";
    if (level === 'Extreme') instruction = "Completely reimagine this concept into an extreme, vivid, and highly detailed artistic masterpiece prompt for an AI image generator: ";
    
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${instruction} "${prompt}"`,
    });

    return response.text;
  }

  async generateImages(prompt: string, numOutputs: number): Promise<string[]> {
    const response = await this.ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt,
      config: {
        numberOfImages: numOutputs,
        outputMimeType: 'image/png',
      },
    });
    
    return response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
  }

  async generateVideo(prompt: string, inputImage: string | null, onStatusUpdate: (message: string) => void): Promise<string> {
    onStatusUpdate('Starting video generation...');
    
    const requestPayload: any = {
      model: 'veo-2.0-generate-001',
      prompt: prompt,
      config: { numberOfVideos: 1 }
    };

    if (inputImage) {
        const [meta, base64Data] = inputImage.split(',');
        const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/png';
        requestPayload.image = { imageBytes: base64Data, mimeType };
    }

    let operation = await this.ai.models.generateVideos(requestPayload);
    onStatusUpdate('Video processing started. This may take a few minutes...');

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      onStatusUpdate('Checking video status...');
      operation = await this.ai.operations.getVideosOperation({ operation: operation });
    }

    onStatusUpdate('Video processing complete. Downloading...');
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
      throw new Error('Video generation finished, but no download link was found.');
    }

    const apiKey = (window as any).process?.env?.API_KEY ?? 'YOUR_API_KEY_HERE';
    const videoBlob = await firstValueFrom(this.http.get(`${downloadLink}&key=${apiKey}`, { responseType: 'blob' }));
    
    onStatusUpdate('Video ready!');
    return URL.createObjectURL(videoBlob);
  }

  async getChatResponse(history: ChatMessage[]): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: history,
    });
    return response.text;
  }
}
