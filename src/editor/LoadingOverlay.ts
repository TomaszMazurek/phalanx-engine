/**
 * LoadingOverlay — thin wrapper over the `#loading` element in index.html.
 * Reports AssetManager progress and hides once the engine starts.
 */
export class LoadingOverlay {
  private readonly root: HTMLElement;
  private readonly label: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    const label = root.querySelector('h1');
    if (!label) {
      throw new Error('LoadingOverlay: #loading is missing its <h1> label');
    }
    this.label = label;
  }

  setProgress(ratio: number): void {
    const percent = Math.min(100, Math.round(ratio * 100));
    this.label.textContent = `Loading… ${percent}%`;
  }

  fail(message: string): void {
    this.label.textContent = `Failed to start: ${message}`;
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
