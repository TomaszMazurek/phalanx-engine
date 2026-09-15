import * as THREE from 'three';
import type { IEditorContext, EditorContextUpdateParams } from './IEditorContext';
import type { ViewportController } from '../app/ViewportController';
import type { SelectionManager, SelectionMode } from '../app/SelectionManager';
import { ensureMultiMaterial } from '../app/FaceMath';
import { openGroundTruthModal } from '../../render/pathtracer';

export interface TextureLibraryItem {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly category: string;
}

export const TEXTURE_LIBRARY: TextureLibraryItem[] = [
  // Quake 3: Gothic Floors & Bridges
  { id: 'q3_largerblock3b3', name: 'Larger Stone Blocks (q3dm6 floor)', url: 'textures/gothic_floor/largerblock3b3.jpg', category: '🏛️ Quake 3: Gothic Floors' },
  { id: 'q3_largeblock3b3broke', name: 'Broken Stone Blocks', url: 'textures/gothic_floor/largeblock3b3broke.jpg', category: '🏛️ Quake 3: Gothic Floors' },
  { id: 'q3_metalbridge06', name: 'Metal Bridge Grate (center bridge)', url: 'textures/gothic_floor/metalbridge06.jpg', category: '🏛️ Quake 3: Gothic Floors' },
  { id: 'q3_metalbridge06b', name: 'Metal Bridge Plate (dark)', url: 'textures/gothic_floor/metalbridge06b.jpg', category: '🏛️ Quake 3: Gothic Floors' },
  { id: 'q3_metalbridge06bbroke', name: 'Damaged Bridge Plate', url: 'textures/gothic_floor/metalbridge06bbroke.jpg', category: '🏛️ Quake 3: Gothic Floors' },
  { id: 'q3_metalbridge06broke', name: 'Broken Bridge Grate', url: 'textures/gothic_floor/metalbridge06broke.jpg', category: '🏛️ Quake 3: Gothic Floors' },
  { id: 'q3_xstairtop6', name: 'Stair Step Top Stone', url: 'textures/gothic_floor/xstairtop6.jpg', category: '🏛️ Quake 3: Gothic Floors' },
  { id: 'q3_xstepborder3', name: 'Stair Step Border Trim', url: 'textures/gothic_floor/xstepborder3.jpg', category: '🏛️ Quake 3: Gothic Floors' },

  // Quake 3: Gothic Walls & Blocks
  { id: 'q3_iron01_c', name: 'Cathedral Ironstone Wall C', url: 'textures/gothic_wall/iron01_c.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_iron01_c2', name: 'Ironstone Wall Accent C2', url: 'textures/gothic_wall/iron01_c2.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_iron01_e', name: 'Ironstone Wall High Trim E', url: 'textures/gothic_wall/iron01_e.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_blocks11b', name: 'Dark Ashlar Stone Blocks', url: 'textures/gothic_block/blocks11b.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_blocks11bbroke3', name: 'Cracked Ashlar Blocks', url: 'textures/gothic_block/blocks11bbroke3.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_blocks18c', name: 'Chiseled Gothic Ashlar 18c', url: 'textures/gothic_block/blocks18c.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_blocks18c_3', name: 'Chiseled Blocks Variant', url: 'textures/gothic_block/blocks18c_3.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_blocks18cgeom', name: 'Geometric Carved Blocks', url: 'textures/gothic_block/blocks18cgeom.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_blocks18d', name: 'Basalt Wall Blocks', url: 'textures/gothic_block/blocks18d.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_killblock_i2', name: 'Ancient Runestone Block I2', url: 'textures/gothic_block/killblock_i2.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_killblock_i4', name: 'Ancient Runestone Block I4', url: 'textures/gothic_block/killblock_i4.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_killblock_j2', name: 'Crypt Wall Block J2', url: 'textures/gothic_block/killblock_j2.jpg', category: '🧱 Quake 3: Gothic Walls' },
  { id: 'q3_xcurve_q3dm6', name: 'Curved Wall Blocks', url: 'textures/gothic_block/xcurve_q3dm6.jpg', category: '🧱 Quake 3: Gothic Walls' },

  // Quake 3: Gothic Doors, Portals & Arches
  { id: 'q3_xian_dm3arch', name: 'Grand Cathedral Archway', url: 'textures/gothic_door/xian_dm3arch.jpg', category: '🚪 Quake 3: Doors & Arches' },
  { id: 'q3_archpart8', name: 'Gothic Arch Keystone', url: 'textures/gothic_door/archpart8.jpg', category: '🚪 Quake 3: Doors & Arches' },
  { id: 'q3_archpart9', name: 'Gothic Arch Capital', url: 'textures/gothic_door/archpart9.jpg', category: '🚪 Quake 3: Doors & Arches' },
  { id: 'q3_smalldoor_xiandm3a', name: 'Crypt Portcullis Door', url: 'textures/gothic_door/smalldoor_xiandm3a.jpg', category: '🚪 Quake 3: Doors & Arches' },
  { id: 'q3_smalldoor_xiandm9a', name: 'Cathedral Portal Door', url: 'textures/gothic_cath/smalldoor_xiandm9a.jpg', category: '🚪 Quake 3: Doors & Arches' },
  { id: 'q3_xiandm3talldoor', name: 'Tall Iron Cathedral Door', url: 'textures/gothic_door/xiandm3talldoor.jpg', category: '🚪 Quake 3: Doors & Arches' },
  { id: 'q3_xiandm3talldoorinside', name: 'Tall Door Inner Frame', url: 'textures/gothic_door/xiandm3talldoorinside.jpg', category: '🚪 Quake 3: Doors & Arches' },
  { id: 'q3_xiandm3talldoorleft', name: 'Tall Door Left Frame', url: 'textures/gothic_door/xiandm3talldoorleft.jpg', category: '🚪 Quake 3: Doors & Arches' },
  { id: 'q3_xiandm3talldoorright', name: 'Tall Door Right Frame', url: 'textures/gothic_door/xiandm3talldoorright.jpg', category: '🚪 Quake 3: Doors & Arches' },

  // Quake 3: Gothic Metal & Structural Trims
  { id: 'q3_metalsupport4', name: 'Heavy Metal Beam Support', url: 'textures/gothic_trim/metalsupport4.jpg', category: '🔩 Quake 3: Metal & Trims' },
  { id: 'q3_metalsupport4g', name: 'Corroded Metal Girder', url: 'textures/gothic_trim/metalsupport4g.jpg', category: '🔩 Quake 3: Metal & Trims' },
  { id: 'q3_metalsupport4g_1', name: 'Riveted Metal Girder', url: 'textures/gothic_trim/metalsupport4g_1.jpg', category: '🔩 Quake 3: Metal & Trims' },
  { id: 'q3_metalsupport4g_2', name: 'Reinforced Metal Girder', url: 'textures/gothic_trim/metalsupport4g_2.jpg', category: '🔩 Quake 3: Metal & Trims' },
  { id: 'q3_metalsupport4h', name: 'Metal Strut Joint', url: 'textures/gothic_trim/metalsupport4h.jpg', category: '🔩 Quake 3: Metal & Trims' },
  { id: 'q3_metalsupsolid', name: 'Solid Metal Foundation', url: 'textures/gothic_trim/metalsupsolid.jpg', category: '🔩 Quake 3: Metal & Trims' },
  { id: 'q3_metalbase03a_blocks18c2', name: 'Metal Base on Stone', url: 'textures/gothic_trim/metalbase03a_blocks18c2.jpg', category: '🔩 Quake 3: Metal & Trims' },
  { id: 'q3_km_arena1tower4', name: 'Tower Crenelated Trim', url: 'textures/gothic_trim/km_arena1tower4.jpg', category: '🔩 Quake 3: Metal & Trims' },
  { id: 'q3_pitted_rust', name: 'Pitted Rust Metal', url: 'textures/gothic_trim/pitted_rust.jpg', category: '🔩 Quake 3: Metal & Trims' },
  { id: 'q3_pitted_rust3', name: 'Heavy Oxide Rust Metal', url: 'textures/gothic_trim/pitted_rust3.jpg', category: '🔩 Quake 3: Metal & Trims' },
  { id: 'q3_pitted_rustblack', name: 'Black Oxidized Metal', url: 'textures/gothic_trim/pitted_rustblack.jpg', category: '🔩 Quake 3: Metal & Trims' },

  // Quake 3: Base / Industrial Tech
  { id: 'q3_clangdark', name: 'Steel Diamond Deck Plate', url: 'textures/base_floor/clangdark.jpg', category: '⚡ Quake 3: Base & Tech' },
  { id: 'q3_border7_ceil50', name: 'Ceiling Luminescent Panel', url: 'textures/base_light/border7_ceil50.jpg', category: '⚡ Quake 3: Base & Tech' },
  { id: 'q3_dirty_pewter', name: 'Dirty Pewter Plate', url: 'textures/base_trim/dirty_pewter.jpg', category: '⚡ Quake 3: Base & Tech' },
  { id: 'q3_pewter', name: 'Pewter Trim Strip', url: 'textures/base_trim/pewter.jpg', category: '⚡ Quake 3: Base & Tech' },

  // Quake 3: SFX & Jump Pads
  { id: 'q3_bounce_largeblock3b', name: 'Jump Pad Glowing Accelerant', url: 'textures/sfx/bounce_largeblock3b.jpg', category: '🌀 Quake 3: SFX & Jump Pads' },
  { id: 'q3_clangdark_bounce', name: 'Metal Jump Pad Surface', url: 'textures/sfx/clangdark_bounce.jpg', category: '🌀 Quake 3: SFX & Jump Pads' },
  { id: 'q3_demonltblackfinal', name: 'Demon Sigil Wall Light', url: 'textures/sfx/demonltblackfinal.jpg', category: '🌀 Quake 3: SFX & Jump Pads' },
  { id: 'q3_largerblock3b3_pent', name: 'Pentagram Ritual Stone', url: 'textures/sfx/largerblock3b3_pent.jpg', category: '🌀 Quake 3: SFX & Jump Pads' },
  { id: 'q3_x_conduit', name: 'Energy Conduit Strip', url: 'textures/sfx/x_conduit.jpg', category: '🌀 Quake 3: SFX & Jump Pads' },
  { id: 'q3_xian_dm3padwall', name: 'Jump Pad Emitter Wall', url: 'textures/sfx/xian_dm3padwall.jpg', category: '🌀 Quake 3: SFX & Jump Pads' },

  // Original PBR Texture Sets
  { id: 'metal1', name: 'Metal 1 Clean', url: 'textures/metal/metal1/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'metal2', name: 'Metal 2 Dark', url: 'textures/metal/metal2/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'wood1', name: 'Wood Light', url: 'textures/wood/wood1/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'wood2', name: 'Wood Mahogany', url: 'textures/wood/wood2/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'bricks1', name: 'Red Bricks', url: 'textures/bricks/bricks1/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'bricks2', name: 'Dark Bricks', url: 'textures/bricks/bricks2/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'cobble1', name: 'Cobblestone 1', url: 'textures/cobblestone/cobble1/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'cobble2', name: 'Cobblestone 2', url: 'textures/cobblestone/cobble2/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'checker', name: 'Checker Tiles', url: 'textures/others/checker/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'ice', name: 'Ice Glossy', url: 'textures/others/iceTexture/Diffuse.jpg', category: '📦 Original PBR Materials' },
  { id: 'slime', name: 'Slime Surface', url: 'textures/others/slime/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'roof1', name: 'Roof Tiles 1', url: 'textures/roofing/roof1/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'roof2', name: 'Roof Tiles 2', url: 'textures/roofing/roof2/Base_Color.jpg', category: '📦 Original PBR Materials' },
  { id: 'roof3', name: 'Roof Tiles 3', url: 'textures/roofing/roof3/Base_Color.jpg', category: '📦 Original PBR Materials' },
];

export class MaterialContext implements IEditorContext {
  readonly id = 'materials' as const;
  readonly label = 'Materials';
  readonly icon = '🎨';

  private activeObject: THREE.Object3D | null = null;
  private viewport?: ViewportController;
  private selectionManager?: SelectionManager;
  private contextManager?: { switchContext(id: any): any };
  private currentInspectorContainer?: HTMLElement;

  get selected(): THREE.Object3D | null {
    return this.activeObject;
  }

  constructor(viewport?: ViewportController, selectionManager?: SelectionManager) {
    this.viewport = viewport;
    this.selectionManager = selectionManager;
  }

  setViewport(viewport: ViewportController): void {
    this.viewport = viewport;
  }

  setContextManager(contextManager: { switchContext(id: any): any }): void {
    this.contextManager = contextManager;
  }

  setSelectionManager(selectionManager: SelectionManager): void {
    this.selectionManager = selectionManager;
    this.selectionManager.onSelect(() => {
      if (this.currentInspectorContainer) {
        this.mountInspector(this.currentInspectorContainer, this.selectionManager?.selected ?? null);
      }
    });
    this.selectionManager.onModeChange(() => {
      if (this.currentInspectorContainer) {
        this.mountInspector(this.currentInspectorContainer, this.selectionManager?.selected ?? null);
      }
    });
  }

  activate(): void {
    if (this.viewport) {
      this.viewport.setTransformEnabled(false);
      this.viewport.setGridVisible(false);
    }
  }

  deactivate(): void {
    if (this.viewport) {
      this.viewport.updateFaceHighlight(null);
    }
  }

  update(_params: EditorContextUpdateParams): void {
    // Dynamic material inspector updates
  }

  onSelectionChange(selected: THREE.Object3D | null): void {
    this.activeObject = selected;
  }

  mountToolbar(container: HTMLElement): void {
    const currentMode = this.selectionManager?.mode ?? 'object';

    container.innerHTML = `
      <div class="toolbar-section">
        <div class="toolbar-title">Selection Target</div>
        <button class="tool-btn ${currentMode === 'object' ? 'active' : ''}" data-sel-mode="object">📦 Whole Object</button>
        <button class="tool-btn ${currentMode === 'face' ? 'active' : ''}" data-sel-mode="face">🧱 Single Face</button>
      </div>

      <div class="toolbar-section">
        <div class="toolbar-title">Material Tools</div>
        <button class="tool-btn active" data-mat-tool="inspect">🔍 Inspector</button>
        <button class="tool-btn" data-mat-tool="picker">🧪 Eyedropper</button>
        <button class="tool-btn" data-mat-tool="paint">🖌️ Paint Tool</button>
      </div>

      <div class="toolbar-section">
        <div class="toolbar-title">Quick Presets</div>
        <button class="tool-btn" data-mat="gothic">🏛️ Q3 Floor</button>
        <button class="tool-btn" data-mat="ironstone">🧱 Q3 Wall</button>
        <button class="tool-btn" data-mat="metalbridge">🌉 Q3 Bridge</button>
        <button class="tool-btn" data-mat="steel">⚙️ Q3 Steel</button>
        <button class="tool-btn" data-mat="jumppad">🌀 Q3 Pad</button>
        <button class="tool-btn" data-mat="bricks">🧱 Red Bricks</button>
        <button class="tool-btn" data-mat="metal">🔩 Metal PBR</button>
        <button class="tool-btn" data-mat="wood">🪵 Wood PBR</button>
        <button class="tool-btn" data-mat="tiles">🏁 Checker Tiles</button>
      </div>

      <div class="toolbar-section">
        <div class="toolbar-title">Physical Reference</div>
        <button class="tool-btn" data-pt-render="viewport">🔬 Path Trace Ground Truth</button>
      </div>
    `;

    // Path Trace Ground Truth render modal
    container.querySelectorAll<HTMLButtonElement>('button[data-pt-render]').forEach((btn) => {
      btn.onclick = () => {
        if (this.viewport && this.viewport.scene && this.viewport.camera) {
          openGroundTruthModal(this.viewport.scene, this.viewport.camera);
        } else {
          console.warn('[MaterialContext] Cannot render: missing viewport or camera');
        }
      };
    });

    // Selection Mode toggles (Object vs Face)
    container.querySelectorAll<HTMLButtonElement>('button[data-sel-mode]').forEach((btn) => {
      btn.onclick = () => {
        container.querySelectorAll('button[data-sel-mode]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.selMode as SelectionMode;
        if (this.selectionManager) {
          this.selectionManager.setMode(mode);
        }
      };
    });

    // Tool selection (Inspector vs Eyedropper vs Paint)
    container.querySelectorAll<HTMLButtonElement>('button[data-mat-tool]').forEach((btn) => {
      btn.onclick = () => {
        container.querySelectorAll('button[data-mat-tool]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tool = btn.dataset.matTool as 'select' | 'inspect' | 'picker' | 'paint';
        if (this.viewport) {
          this.viewport.setActiveTool(tool);
        }
      };
    });

    // Quick material apply buttons
    container.querySelectorAll<HTMLButtonElement>('button[data-mat]').forEach((btn) => {
      btn.onclick = () => {
        const matType = btn.dataset.mat;
        if (this.viewport && matType) {
          this.viewport.applyQuickMaterial(null, matType);
          if (this.currentInspectorContainer) {
            this.mountInspector(this.currentInspectorContainer, this.selectionManager?.selected ?? null);
          }
        }
      };
    });
  }

  mountInspector(container: HTMLElement, selected: THREE.Object3D | null): void {
    this.currentInspectorContainer = container;

    // Guard against applying textures/PBR to internal Navigation Nodes
    if (
      selected &&
      (selected.userData?.isNavNode ||
        selected.name.startsWith('NavNode_') ||
        selected.name.startsWith('NavSphere_') ||
        selected.name.startsWith('NavRing_') ||
        selected.parent?.userData?.isNavNode)
    ) {
      const nodeId: string =
        selected.userData?.nodeId ||
        selected.parent?.userData?.nodeId ||
        selected.name.replace(/^NavNode_|^NavSphere_|^NavRing_/, '');

      container.innerHTML = `
        <div class="inspector-group" style="border-color: rgba(6, 182, 212, 0.4);">
          <div class="inspector-header">📍 Nav Node: <strong style="color: #06b6d4;">${nodeId}</strong></div>
          <div style="font-size: 11px; color: var(--text-dim); line-height: 1.5; margin: 8px 0;">
            Węzły nawigacji AI to punkty orientacyjne botów, a nie siatki świata gry — nie nakłada się na nie materiałów.
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 10px;">
            <button class="tool-btn active" id="btn-goto-geometry" style="justify-content: center; background: rgba(6, 182, 212, 0.15); border: 1px solid #06b6d4; color: #06b6d4; padding: 6px; font-weight: 500;">
              📐 Przejdź do zakładki Geometry (Ścieżki i Połączenia)
            </button>
            <button class="tool-btn" id="btn-delete-nav-from-mat" style="justify-content: center; background: rgba(244, 63, 94, 0.15); border: 1px solid #f43f5e; color: #f43f5e; padding: 6px; font-weight: 500;">
              🗑 Usuń ten węzeł (Delete)
            </button>
          </div>
        </div>
      `;

      container.querySelector('#btn-goto-geometry')?.addEventListener('click', () => {
        this.contextManager?.switchContext('geometry');
      });

      container.querySelector('#btn-delete-nav-from-mat')?.addEventListener('click', () => {
        if (this.viewport) {
          this.viewport.removeNavNode(nodeId);
          this.mountInspector(container, null);
        }
      });

      return;
    }

    // Guard against applying textures/PBR to internal Navigation Edges
    if (
      selected &&
      (selected.userData?.isNavEdge ||
        selected.name.startsWith('NavEdge_') ||
        selected.parent?.userData?.isNavEdge)
    ) {
      const fromId: string = selected.userData?.fromId || selected.parent?.userData?.fromId || '';
      const toId: string = selected.userData?.toId || selected.parent?.userData?.toId || '';

      container.innerHTML = `
        <div class="inspector-group" style="border-color: rgba(6, 182, 212, 0.4);">
          <div class="inspector-header">🔗 Path Connection: <strong style="color: #06b6d4;">${fromId} ↔ ${toId}</strong></div>
          <div style="font-size: 11px; color: var(--text-dim); line-height: 1.5; margin: 8px 0;">
            Połączenia ścieżek botów to linie nawigacji AI, a nie siatki świata gry — nie nakłada się na nie materiałów.
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 10px;">
            <button class="tool-btn active" id="btn-goto-geom-edge" style="justify-content: center; background: rgba(6, 182, 212, 0.15); border: 1px solid #06b6d4; color: #06b6d4; padding: 6px; font-weight: 500;">
              📐 Przejdź do zakładki Geometry
            </button>
            <button class="tool-btn" id="btn-delete-edge-from-mat" style="justify-content: center; background: rgba(244, 63, 94, 0.15); border: 1px solid #f43f5e; color: #f43f5e; padding: 6px; font-weight: 500;">
              🗑 Rozłącz tę ścieżkę (Delete)
            </button>
          </div>
        </div>
      `;

      container.querySelector('#btn-goto-geom-edge')?.addEventListener('click', () => {
        this.contextManager?.switchContext('geometry');
      });

      container.querySelector('#btn-delete-edge-from-mat')?.addEventListener('click', () => {
        if (this.viewport && fromId && toId) {
          this.viewport.disconnectNavNodes(fromId, toId, true);
          this.mountInspector(container, null);
        }
      });

      return;
    }

    // Find target mesh inside selected object
    let targetMesh: THREE.Mesh | null = null;
    if (selected && selected instanceof THREE.Mesh) {
      targetMesh = selected;
    } else if (selected) {
      selected.traverse((child) => {
        if (!targetMesh && child instanceof THREE.Mesh && child.material) {
          targetMesh = child;
        }
      });
    }

    if (!targetMesh || !targetMesh.material) {
      container.innerHTML = `
        <div class="inspector-empty">
          <p>No mesh material selected.</p>
          <small>Select an object or click a face in the 3D viewport to inspect and change textures.</small>
        </div>
      `;
      return;
    }

    const mesh = targetMesh;
    const mode = this.selectionManager?.mode ?? 'object';
    const face = this.selectionManager?.selectedFace;
    const isFaceSelection = Boolean(mode === 'face' && face && face.mesh === mesh);

    // Ensure multi-material array if face is targeted
    let activeMaterial: THREE.Material;
    let slotLabel = 'Whole Mesh';

    if (isFaceSelection && face) {
      const materials = ensureMultiMaterial(mesh);
      activeMaterial = materials[face.materialIndex] || materials[0];
      slotLabel = `Face: ${face.label}`;
    } else {
      activeMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      slotLabel = Array.isArray(mesh.material) ? `All Faces (${mesh.material.length} slots)` : 'Single Material';
    }

    const mat = activeMaterial;
    const stdMat = mat instanceof THREE.MeshStandardMaterial ? mat : null;
    const currentColorHex = stdMat?.color ? `#${stdMat.color.getHexString()}` : '#ffffff';
    const currentRoughness = stdMat ? stdMat.roughness : 0.5;
    const currentMetalness = stdMat ? stdMat.metalness : 0.1;
    const currentRepeatX = stdMat?.map?.repeat.x ?? 1;
    const currentRepeatY = stdMat?.map?.repeat.y ?? 1;

    // Build Texture dropdown options grouped by category
    const categories = Array.from(new Set(TEXTURE_LIBRARY.map((t) => t.category)));
    const textureOptions = categories
      .map((cat) => {
        const items = TEXTURE_LIBRARY.filter((t) => t.category === cat);
        const options = items
          .map((t) => {
            const isSelected = Boolean((stdMat?.map?.image as any)?.src?.includes(t.url));
            return `<option value="${t.url}" ${isSelected ? 'selected' : ''}>${t.name}</option>`;
          })
          .join('');
        return `<optgroup label="${cat}">${options}</optgroup>`;
      })
      .join('');

    container.innerHTML = `
      <div class="inspector-group">
        <div class="inspector-header">Target: <strong>${mesh.name || 'Mesh'}</strong></div>
        <div class="inspector-field">
          <label>Scope:</label>
          <div style="display:flex; gap:4px;">
            <button class="tool-btn ${!isFaceSelection ? 'active' : ''}" id="btn-mode-mesh" style="padding:4px 8px; font-size:11px;">📦 Mesh</button>
            <button class="tool-btn ${isFaceSelection ? 'active' : ''}" id="btn-mode-face" style="padding:4px 8px; font-size:11px;">🧱 Face</button>
          </div>
        </div>
        <div class="inspector-field">
          <label>Selection:</label>
          <span style="font-size: 11px; color: var(--accent); font-weight: 600;">${slotLabel}</span>
        </div>
      </div>

      <div class="inspector-group">
        <div class="inspector-header">Texture & Albedo</div>
        <div class="inspector-field" style="flex-direction: column; align-items: stretch; gap: 6px;">
          <label>Apply Texture:</label>
          <select id="select-texture" style="width: 100%;">
            <option value="">-- Choose Texture --</option>
            ${textureOptions}
          </select>
        </div>
        <div class="inspector-field">
          <label>Base Tint:</label>
          <input type="color" value="${currentColorHex}" id="input-mat-color" />
        </div>
      </div>

      <div class="inspector-group">
        <div class="inspector-header">PBR Surface Parameters</div>
        <div class="inspector-field">
          <label>Roughness:</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="range" min="0" max="1" step="0.02" value="${currentRoughness}" id="input-mat-roughness" />
            <span id="label-mat-roughness" style="font-family:var(--font-mono); font-size:11px; width:28px;">${currentRoughness.toFixed(2)}</span>
          </div>
        </div>
        <div class="inspector-field">
          <label>Metalness:</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="range" min="0" max="1" step="0.02" value="${currentMetalness}" id="input-mat-metalness" />
            <span id="label-mat-metalness" style="font-family:var(--font-mono); font-size:11px; width:28px;">${currentMetalness.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="inspector-group">
        <div class="inspector-header">UV Mapping</div>
        <div class="inspector-field">
          <label>Tiling X:</label>
          <input type="number" step="0.5" min="0.1" value="${currentRepeatX}" id="input-mat-uv-x" />
        </div>
        <div class="inspector-field">
          <label>Tiling Y:</label>
          <input type="number" step="0.5" min="0.1" value="${currentRepeatY}" id="input-mat-uv-y" />
        </div>
      </div>

      ${
        isFaceSelection
          ? `
        <div class="inspector-group" style="border-color: rgba(56, 189, 248, 0.4);">
          <div class="inspector-header" style="color: var(--accent);">Face Actions</div>
          <button class="tool-btn" id="btn-apply-all-faces" style="justify-content: center; width: 100%;">
            🌐 Copy Material to All Faces
          </button>
        </div>
      `
          : ''
      }
    `;

    // Wire Mode Switcher buttons
    container.querySelector('#btn-mode-mesh')?.addEventListener('click', () => {
      this.selectionManager?.setMode('object');
    });

    container.querySelector('#btn-mode-face')?.addEventListener('click', () => {
      this.selectionManager?.setMode('face');
    });

    // Wire Texture Selection
    const selectTexture = container.querySelector<HTMLSelectElement>('#select-texture');
    if (selectTexture) {
      selectTexture.onchange = () => {
        const texUrl = selectTexture.value;
        if (texUrl && this.viewport) {
          this.viewport.applyMaterialToTarget({ textureUrl: texUrl }, isFaceSelection ? 'face' : 'object');
        }
      };
    }

    // Wire Color Picker
    const inputColor = container.querySelector<HTMLInputElement>('#input-mat-color');
    if (inputColor) {
      inputColor.oninput = () => {
        if (this.viewport) {
          this.viewport.applyMaterialToTarget({ color: inputColor.value }, isFaceSelection ? 'face' : 'object');
        }
      };
    }

    // Wire Roughness Slider
    const inputRoughness = container.querySelector<HTMLInputElement>('#input-mat-roughness');
    const labelRoughness = container.querySelector<HTMLSpanElement>('#label-mat-roughness');
    if (inputRoughness) {
      inputRoughness.oninput = () => {
        const val = parseFloat(inputRoughness.value);
        if (labelRoughness) labelRoughness.textContent = val.toFixed(2);
        if (this.viewport) {
          this.viewport.applyMaterialToTarget({ roughness: val }, isFaceSelection ? 'face' : 'object');
        }
      };
    }

    // Wire Metalness Slider
    const inputMetalness = container.querySelector<HTMLInputElement>('#input-mat-metalness');
    const labelMetalness = container.querySelector<HTMLSpanElement>('#label-mat-metalness');
    if (inputMetalness) {
      inputMetalness.oninput = () => {
        const val = parseFloat(inputMetalness.value);
        if (labelMetalness) labelMetalness.textContent = val.toFixed(2);
        if (this.viewport) {
          this.viewport.applyMaterialToTarget({ metalness: val }, isFaceSelection ? 'face' : 'object');
        }
      };
    }

    // Wire UV Tiling
    const inputUvX = container.querySelector<HTMLInputElement>('#input-mat-uv-x');
    const inputUvY = container.querySelector<HTMLInputElement>('#input-mat-uv-y');
    const updateUv = () => {
      const u = parseFloat(inputUvX?.value || '1');
      const v = parseFloat(inputUvY?.value || '1');
      if (this.viewport && Number.isFinite(u) && Number.isFinite(v)) {
        this.viewport.applyMaterialToTarget({ uvScale: { x: u, y: v } }, isFaceSelection ? 'face' : 'object');
      }
    };
    if (inputUvX) inputUvX.oninput = updateUv;
    if (inputUvY) inputUvY.oninput = updateUv;

    // Wire "Copy to All Faces"
    const btnApplyAll = container.querySelector<HTMLButtonElement>('#btn-apply-all-faces');
    if (btnApplyAll) {
      btnApplyAll.onclick = () => {
        if (this.viewport && isFaceSelection && stdMat) {
          const rawUrl =
            (stdMat as any).userData?.textureUrl ||
            (stdMat.map?.image as any)?.src ||
            (stdMat.map as any)?.name;
          const texUrl =
            typeof rawUrl === 'string'
              ? rawUrl.replace(/^[a-z]+:\/\/[^/]+\//, '').replace(/^\//, '')
              : undefined;

          this.viewport.applyMaterialToTarget(
            {
              textureUrl: texUrl,
              color: stdMat.color.getHex(),
              roughness: stdMat.roughness,
              metalness: stdMat.metalness,
              uvScale: stdMat.map ? { x: stdMat.map.repeat.x, y: stdMat.map.repeat.y } : undefined,
            },
            'object',
          );
          this.mountInspector(container, selected);
        }
      };
    }
  }
}
