import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { LightingContext } from './LightingContext';
import type { ViewportController } from '../app/ViewportController';

class MockButton {
  dataset: Record<string, string> = {};
  textContent: string = '';
  disabled: boolean = false;
  onclick: (() => Promise<void> | void) | null = null;

  async click(): Promise<void> {
    if (this.onclick) {
      await this.onclick();
    }
  }
}

class MockContainer {
  private buttons: MockButton[] = [];

  set innerHTML(html: string) {
    this.buttons = [];
    const bakeMatches = html.matchAll(/data-bake="([^"]+)"[^>]*>([^<]+)<\/button>/g);
    for (const match of bakeMatches) {
      const btn = new MockButton();
      btn.dataset.bake = match[1];
      btn.textContent = match[2];
      this.buttons.push(btn);
    }
  }

  querySelectorAll(selector: string): MockButton[] {
    if (selector.includes('data-bake')) {
      return this.buttons;
    }
    return [];
  }

  querySelector(selector: string): MockButton | null {
    if (selector.includes('data-bake="ao"')) {
      return this.buttons.find((b) => b.dataset.bake === 'ao') ?? null;
    }
    return null;
  }
}

describe('LightingContext', () => {
  it('mounts toolbar and triggers bakeScene on click', async () => {
    const scene = new THREE.Scene();
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 5),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    scene.add(plane);

    const fakeViewport = {
      scene,
      setTransformEnabled: vi.fn(),
      setLightHelpersVisible: vi.fn(),
      setGridVisible: vi.fn(),
      addLight: vi.fn(),
      setEnvironmentPreset: vi.fn(),
      setExposure: vi.fn()
    } as unknown as ViewportController;

    const ctx = new LightingContext(fakeViewport);
    const container = new MockContainer() as unknown as HTMLElement;
    ctx.mountToolbar(container);

    const aoBtn = (container as unknown as MockContainer).querySelector('button[data-bake="ao"]');
    expect(aoBtn).not.toBeNull();
    expect(aoBtn!.textContent).toContain('Bake Ambient Occlusion');

    // Click AO bake
    await aoBtn!.click();

    expect(plane.geometry.attributes.uv2).toBeDefined();
    expect((plane.material as THREE.MeshStandardMaterial).lightMap).toBeDefined();
    expect((plane.material as THREE.MeshStandardMaterial).lightMapIntensity).toBe(1.0);
  });
});
