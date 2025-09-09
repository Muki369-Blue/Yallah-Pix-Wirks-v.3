import { Injectable, inject } from '@angular/core';
import { GoogleGenAI, Type } from "@google/genai";
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface ImageConcept { name: string; prompt: string; }
export interface ChatMessage { role: 'user' | 'model'; parts: { text: string }[]; }
export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private ai: GoogleGenAI;
  private http = inject(HttpClient);
  // FIX: Store API key locally as it's private in GoogleGenAI and needed for requests.
  private apiKey: string;

  constructor() {
    this.apiKey = (window as any).process?.env?.API_KEY ?? '';
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }

  // --- Gemini-specific helpers ---

  async generateImageConcepts(songTitle: string): Promise<ImageConcept[]> {
    const response = await this.ai.models.generateContent({ model: "gemini-2.5-flash", contents: `For the song title "${songTitle}", generate 3 distinct cover art concepts. Each needs a name and a detailed, artistic prompt for an AI image generator.`, config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { concepts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, prompt: { type: Type.STRING } } } } } } } });
    const parsed = JSON.parse(response.text);
    return parsed.concepts || [];
  }

  async enhancePrompt(prompt: string, level: 'Subtle' | 'Artistic' | 'Extreme'): Promise<string> {
    let instruction = "Slightly enhance this prompt with more detail: ";
    if (level === 'Artistic') instruction = "Rewrite this prompt to be much more artistic, vivid, and descriptive: ";
    if (level === 'Extreme') instruction = "Completely reimagine this concept into an extreme, vivid, and highly detailed artistic masterpiece prompt for an AI image generator: ";
    const response = await this.ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `${instruction} "${prompt}"` });
    return response.text;
  }

  async generateSurprisePrompt(): Promise<string> {
    const response = await this.ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Generate a single, random, highly creative and visually descriptive prompt for an AI image generator. Be imaginative and specific. Examples: "a giant bioluminescent jellyfish floating over a misty forest at twilight, volumetric lighting, cinematic", "a cozy bookstore cafe on a rainy day in a cyberpunk city, neon signs reflecting on wet streets, detailed", "a majestic clockwork dragon soaring through a sky of swirling galaxies, intricate gears and filigree, epic".` });
    return response.text.replace(/"/g, ''); // Clean up quotes
  }

  // --- Multi-provider methods ---

  async generateImages(provider: string, apiKey: string, prompt: string, numOutputs: number, negativePrompt: string, aspectRatio: AspectRatio): Promise<string[]> {
    if (provider !== 'gemini' && !apiKey) throw new Error(`An API key is required for ${provider}.`);

    switch (provider) {
      case 'openai':
        const sizeMap: Record<AspectRatio, string> = { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792', '4:3': '1024x1024', '3:4': '1024x1024' }; // DALL-E 3 has limited sizes
        const body = { model: "dall-e-3", prompt: `${prompt}. Avoid: ${negativePrompt}`, n: 1, size: sizeMap[aspectRatio], response_format: "b64_json" };
        const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` });
        const promises = Array(numOutputs).fill(0).map(() => firstValueFrom(this.http.post<any>('https://api.openai.com/v1/images/generations', body, { headers })));
        const results = await Promise.all(promises);
        return results.flatMap(result => result.data.map((img: any) => `data:image/png;base64,${img.b64_json}`));

      case 'huggingface_image':
        const hfHeaders = new HttpHeaders({ 'Authorization': `Bearer ${apiKey}` });
        const hfBody = { inputs: prompt, parameters: { negative_prompt: negativePrompt } };
        const promisesHf = Array(numOutputs).fill(0).map(() => firstValueFrom(this.http.post('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-3-medium-diffusers', hfBody, { headers: hfHeaders, responseType: 'blob' })));
        const blobs = await Promise.all(promisesHf);
        return Promise.all(blobs.map(b => this.blobToDataURL(b)));

      case 'gemini':
      default:
        const response = await this.ai.models.generateImages({ model: 'imagen-3.0-generate-002', prompt: prompt, config: { numberOfImages: numOutputs, outputMimeType: 'image/png', negativePrompt, aspectRatio } });
        return response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
    }
  }

  async generateVideo(provider: string, apiKey: string, prompt: string, inputImage: string | null, onStatusUpdate: (message: string) => void): Promise<string> {
    const keyRequired = provider !== 'demo_video' && provider !== 'gemini_veo';
    if (keyRequired && !apiKey) throw new Error(`An API key is required for ${provider}.`);
    // FIX: Access locally stored apiKey instead of the private property on GoogleGenAI instance.
    if (provider === 'gemini_veo' && !this.apiKey) throw new Error(`A Google API key is required for Gemini VEO.`);

    switch (provider) {
      case 'gemini_veo':
        const requestPayload: any = { model: 'veo-2.0-generate-001', prompt: prompt, config: { numberOfVideos: 1 } };
        if (inputImage) {
            const [meta, base64Data] = inputImage.split(',');
            requestPayload.image = { imageBytes: base64Data, mimeType: meta.match(/:(.*?);/)?.[1] || 'image/png' };
        }
        onStatusUpdate('Sending request to VEO...');
        let operation = await this.ai.models.generateVideos(requestPayload);
        onStatusUpdate('Video processing started. This can take several minutes...');
        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          onStatusUpdate('Checking video status...');
          operation = await this.ai.operations.getVideosOperation({ operation: operation });
        }
        onStatusUpdate('Video ready! Downloading...');
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) throw new Error('Video generation failed to return a download link.');
        // FIX: Access locally stored apiKey instead of the private property on GoogleGenAI instance.
        const videoBlob = await firstValueFrom(this.http.get(`${downloadLink}&key=${this.apiKey}`, { responseType: 'blob' }));
        return URL.createObjectURL(videoBlob);
      
      case 'huggingface_video':
        if (!inputImage) throw new Error('An input image is required for Hugging Face SVD.');
        onStatusUpdate('Uploading image...');
        const imageBlob = this.dataURLtoBlob(inputImage);
        const headers = new HttpHeaders({ 'Authorization': `Bearer ${apiKey}`});
        for (let retries = 5; retries > 0; retries--) {
            try {
                const response = await firstValueFrom(this.http.post('https://api-inference.huggingface.co/models/stabilityai/stable-video-diffusion-img2vid-xt', imageBlob, { headers, responseType: 'blob', observe: 'response' }));
                onStatusUpdate('Processing video...');
                return URL.createObjectURL(response.body!);
            } catch (error: any) {
                if (error.status === 503 && error.error instanceof Blob) {
                    const errorJson = JSON.parse(await error.error.text());
                    const waitTime = errorJson.estimated_time || 20;
                    onStatusUpdate(`Model is loading... retrying in ${Math.round(waitTime)}s.`);
                    await new Promise(res => setTimeout(res, waitTime * 1000));
                } else throw new Error(`Hugging Face Error: ${error.message || 'An unknown error occurred.'}`);
            }
        }
        throw new Error('Hugging Face model failed to load after multiple retries.');
        
      case 'demo_video':
      default:
        onStatusUpdate('Preparing demo video...');
        await new Promise(res => setTimeout(res, 1500));
        return 'https://dummy-media.torchbox.com/media/video/1080p/big-buck-bunny.mp4';
    }
  }

  async * getChatResponseStream(provider: string, apiKey: string, history: ChatMessage[]): AsyncGenerator<string> {
    const keyRequired = !provider.startsWith('gemini');
    if (keyRequired && !apiKey) throw new Error(`An API key is required for ${provider}.`);
    // FIX: Access locally stored apiKey instead of the private property on GoogleGenAI instance.
    if (provider.startsWith('gemini') && !this.apiKey) throw new Error(`A Google API key is required for Gemini.`);

    switch (provider) {
        case 'huggingface_chat':
        case 'replicate_chat': // Note: Replicate streaming is different, this is a simplified example
            const model = provider === 'huggingface_chat' ? 'meta-llama/Meta-Llama-3-8B-Instruct' : 'meta/llama-2-70b-chat';
            const headers = new HttpHeaders({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' });
            const body = { inputs: history.map(h => h.parts[0].text).join("\n"), parameters: { return_full_text: false, max_new_tokens: 500 }};
            const result = await firstValueFrom(this.http.post<any[]>(`https://api-inference.huggingface.co/models/${model}`, body, { headers }));
            yield result[0].generated_text; // HF doesn't easily support streaming via this endpoint, so we yield the full response.
            break;
        
        case 'gemini_chat':
        default:
            const stream = await this.ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents: history });
            for await (const chunk of stream) {
                yield chunk.text;
            }
            break;
    }
  }
  
  async validateApiKey(provider: string, apiKey: string): Promise<boolean> {
      if (!apiKey) return false;
      try {
          switch(provider) {
              case 'openai':
                  const headers = new HttpHeaders({ 'Authorization': `Bearer ${apiKey}` });
                  await firstValueFrom(this.http.get('https://api.openai.com/v1/models', { headers }));
                  return true;
              case 'huggingface_image':
              case 'huggingface_video':
              case 'huggingface_chat':
                  const hfHeaders = new HttpHeaders({ 'Authorization': `Bearer ${apiKey}` });
                  await firstValueFrom(this.http.get('https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct', { headers: hfHeaders }));
                  return true;
              default: return false; // No validation for demo/gemini
          }
      } catch {
          return false;
      }
  }

  private blobToDataURL = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  private dataURLtoBlob = (dataurl: string): Blob => {
    const [header, data] = dataurl.split(',');
    const mime = header.match(/:(.*?);/)?.[1];
    const bstr = atob(data);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], {type: mime});
  };
}
