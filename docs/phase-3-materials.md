# Faza 3 — Render i materiały (plan szczegółowy)

> Silnik gier w przeglądarce na three.js · nadrzędny plan: [ENGINE_PLAN.md](./ENGINE_PLAN.md)
> Status: **PLAN** · poprzednia: [phase-2-core.md](./phase-2-core.md) (UKOŃCZONA, tag `phase-2`)
> Szacunek: **~8–9 dni budżetu** (1,5–2 tyg. pracy dorywczej) · proces: fale + TDD + tiering modeli (jak Faza 2)

---

## Cel

**Material editor jako w pełni działające narzędzie — tu dożywa stare repo.**
Materiał opisany deklaratywnie (JSON), edytowalny w panelu, zapisywalny/wczytywalny,
renderowany z pełnym PBR + IBL na srodowisku HDR. Do tego ładowanie modeli glTF
w MeshFactory i tor kompresji assetów (KTX2/meshopt/Draco) jako opcja.

**Kamień milowy (widoczny):** w panelu edytora tworzę materiał (mapy PBR + kontrola UV),
widzę go na prymitywie **i na modelu glTF** pod HDR-em, zapisuję do JSON,
odczytuję z powrotem — wszystko w przeglądarce na żywym demo.

## Zakres

### W zakresie (Definition of Done)

1. **`MaterialDefinition`** — deklaratywny, wersjonowany model materiału (JSON-serializable):
   mapy (baseColor/normal/roughness/ao/displacement — ref. po `textureSetId` z manifestu
   LUB po URI), transformacja UV (repeat/offset/rotation/center — koniec z brakiem z Fazy 1),
   parametry (roughness/metalness/color/normalScale…), shading (`standard`|`phong`).
2. **`MaterialCompiler`** (render/) — `MaterialDefinition` → `THREE.Material`
   (+ update in-place dla edytora: bez realokacji materiału przy każdej zmianie suwaka).
3. **`EnvironmentSystem`** (render/) — HDR (RGBE) przez `RGBELoader`, `PMREMGenerator`,
   `scene.environment` + skybox jako tło; **bez** starego hacka envMap-z-tła;
   presety środowisk w JSON (id, hdri, background, intensity).
4. **`LightingPresets`** — data-driven presety świateł (JSON) nakładane na istniejący
   `LightingRig` (ambient/hemi/directional/points z wartościami i kolorami).
5. **`MaterialEditor`** (editor/) — panel lil-gui nad `MaterialDefinition`: wybór map,
   pełna kontrola UV, parametry PBR, presety świateł i środowiska; **eksport/import JSON**
   (download + file picker; drag&drop świadomie nie — martwy przycisk ze starego GUI nie wraca).
6. **`MeshFactory` + glTF** — ładowanie dowolnych modeli do sceny (przez AssetManager/GLTFAdapter
   z Fazy 2); viewer dostaje wybór „prymityw | model".
7. **Tor kompresji (opt-in)** — `KTX2Loader` (+ transcoder Basis vendored w `public/basis/`,
   nie CDN), `meshopt`/`Draco` dekodery podpinane pod GLTFLoader gdy manifest/URI tego wymaga.
8. **Wave 0 — nit sweep**: 12 nity P2 z retro Fazy 2 (backlog poniżej) + brakujące testy.
9. Demo: viewer.html rośnie w pełne narzędzie (edytor + środowiska + presety);
   index.html (menu/gameplay) bez zmian funkcyjnych.

### Poza zakresem (celowo)

- Fizyka, raycasting, character controller → **Faza 4** (rapier.js).
- Własny format binarny assetów (sentyment z 2021) → dopiero gdy kompresja KTX2 pokaże liczby.
- Node-based material editor / TSL → **Faza 5+** (ambicje edytorskie); tu panel = formularz.
- WebGPU renderer → side-quest (path tracer) rozstrzyga najpierw.
- PWA/mobile → opcjonalny tor **Fazy 6** (patrz aktualizacja ENGINE_PLAN).
- Zmiana `Interpolated<T>` na generyczny → **Faza 4** (dopiero gdy fizyka tego potrzebuje).

---

## Decyzje techniczne

| Temat | Decyzja | Uzasadnienie |
| --- | --- | --- |
| Model materiału | `MaterialDefinition` = czyste dane (JSON, `version: 1`), walidacja schematem w TS | kontynuacja wzorca manifestu z Fazy 1; edytor Fazy 5 dostaje darmowy format we/wy |
| Mapy | referencja `textureSetId` (z manifestu) **lub** `uri` (dowolny plik) | reużywamy biblioteki 16 zestawów + nie blokujemy custom plików |
| Kompilacja | `MaterialCompiler.compile(def)` + `applyUpdate(def)` (in-place, bez realokacji) | suwak w edytorze ≠ nowy materiał; GC i kompilacja shadera na żywo bolą |
| UV | repeat/offset/rotation/center jako pola def; aplikowane na wszystkie mapy danych + koloru | dokładnie semantyka starego GUI (UV1), teraz na danych |
| IBL | RGBE (`.hdr`) → PMREM → `scene.environment`; tło osobno (skybox LUB blurred env) | zgodność z three 0.185; zero hacków envMap z tła |
| Środowiska | presety JSON w `public/env/manifest.json` + pliki `.hdr` (2–3 wolne HDRI na start) | nowy wpis = zero kodu, jak tekstury w Fazie 1 |
| Kompresja | opt-in per asset; transcoder Basis vendored lokalnie (`public/basis/`), meshopt/Draco z three/addons | demo działa offline; świadome ryzyko rozmiaru repo (HDRI+transcoder ~2–3 MB) |
| Edytor | lil-gui (jak DevPanel), delegacja do compiler/systemów — zero logiki w panelu | powtórzenie wzorca DevPanel z Fazy 1 |
| Testy | TDD: warstwa danych (def/presety/walidacja/UV math) — pełne unit; render — adaptery cienkie + testy kontraktu; wizualne — akceptacja właściciela | proporcja jak w Fazie 2 |
| Nowe zależności runtime | **zero** (loadery z three/addons; transcoder = pliki statyczne) | karma „zero deps" trwa |

### Szkic `MaterialDefinition`

```ts
// src/assets/MaterialDefinition.ts — pure data, no three
interface MaterialDefinition {
  version: 1;
  id: string;
  shading: 'standard' | 'phong';
  color: number;                    // zapasowy diffuse
  params: { roughness: number; metalness: number; shininess: number; normalScale: number };
  uv: { repeat: [number, number]; offset: [number, number]; rotation: number; center: [number, number] };
  maps: {
    baseColor?:  { source: { textureSetId: string } | { uri: string } };
    normal?:     { source: ...; enabled: boolean };
    bump?:       { source: ...; scale: number };
    roughness?:  { source: ... };
    ao?:         { source: ...; intensity: number };
    displacement?: { source: ...; scale: number };
  };
}
```

---

## Zadania (fale; tiering: 🅕 flash = mechanika, 🅛 glm-5.3 = semantyka)

Wave 0 — **nit sweep + długi testowy** (start fazy; ~1 d)

| # | Zadanie | Tier | Efekt |
| --- | --- | --- | --- |
| 0.1 | Nity render/integracja: `RenderOutputTarget.clear()` w RenderSystem (zamrożona klatka za menu), camera `onResize` w GameplayScene, interp-OFF przez `.value` (nie `read(1)`), poprawka komentarza zero-casts + jedyny cast w GameplayScene | 🅛 | 4 nity domknięte z testami |
| 0.2 | Nity input/eventy: blur/disconnect → releasedEdges, contextmenu-suppress (opt-in), deadzone rescale (mapowanie 0.15→1) | 🅛 | edge semantics spójne, przypięte testami |
| 0.3 | Nity AssetManager/progress: in-flight w preload nie oznacza complete, progress nie strzela po reject; stary komentarz SceneContext → Wave 3 poprawny | 🅕 | F1/F2/F3 domknięte |
| 0.4 | Dług testowy: InputSystem DOM timeline (stub KeyboardEvent — wzorzec z PlayerController.test), Engine-wiring (dispose→stop→cancel), MeshSync/HUD systemy, EMA-spike w DebugHUD.test | 🅕 | suite +~15 testów |

Wave A — **warstwa danych materiałów** (~1,5 d)

| # | Zadanie | Tier | Efekt |
| --- | --- | --- | --- |
| A1 | `MaterialDefinition` (schema, walidacja, defaults, normalize) + `MaterialLibrary` (zapis/odczyt JSON, wersjonowanie) — TDD | 🅛 | czysty model danych z pełnymi testami |
| A2 | UV math (matrix compose z repeat/offset/rotation/center) jako czysta funkcja — TDD | 🅕 | semantyka jak stare GUI, przypięta testami |

Wave B — **środowisko i światła** (~1,5 d)

| # | Zadanie | Tier | Efekt |
| --- | --- | --- | --- |
| B1 | `EnvironmentSystem` (render/): RGBELoader → PMREM → scene.environment/tło; presety z `public/env/manifest.json` | 🅛 | IBL działa, zero hacków |
| B2 | `LightingPresets` (dane JSON) + aplikacja na LightingRig — TDD warstwy danych | 🅕 | 3–4 presety out-of-the-box |

Wave C — **kompilacja i edytor** (~2 d)

| # | Zadanie | Tier | Efekt |
| --- | --- | --- | --- |
| C1 | `MaterialCompiler` (render/): def → THREE material; `applyUpdate` in-place (uv/params/mapy); testy kontraktu na danych mock | 🅛 | suwak ≠ realokacja |
| C2 | `MaterialEditor` (editor/): panel lil-gui nad def (mapy/UV/params/presety env+lights), eksport/import JSON | 🅛 | kamień milowy fazy w UI |
| C3 | MeshFactory + modele glTF: wybór „prymityw | model" w viewerze (przez AssetManager) | 🅕 | kostka demo + dowolny .glb |

Wave D — **tor kompresji** (~1,5 d, opcjonalny na koniec fazy jeśli czas)

| # | Zadanie | Tier | Efekt |
| --- | --- | --- | --- |
| D1 | KTX2Loader + transcoder Basis (vendored `public/basis/`), meshopt + Draco pod GLTFLoader (opt-in) | 🅛 | assety demo: draco+meshopt gotowe; **próbka .ktx2 odroczona do Gry 1** (potrzebuje natywnego enkodera toktx — wiring+vendory kompletne) |
| D2 | Porównanie liczbowe: rozmiar/czas loadu PNG vs KTX2 — wpis do README/demo | 🅕 | liczby do portfolio |

Wave E — **integracja + zamknięcie** (~1,5 d)

| # | Zadanie | Tier | Efekt |
| --- | --- | --- | --- |
| E1 | viewer.html = pełne narzędzie (edytor + env + presety + glTF); sceny demo zapisane jako MaterialDefinition | 🅛 | showcase fazy |
| E2 | Reviewer całej fazy + akceptacja właściciela na żywym demo + tag `phase-3` + retro | review | jak Faza 2 |

**Suma: ~8,5 dnia budżetu.** Kolejność sztywna do B; C1→C2→C3 sekwencyjnie;
D można wyłączyć z fazy bez ryzyka dla kamienia milowego (świadomy buffer).

### Backlog: 12 nity P2 z Fazy 2 (wave 0.1–0.4)

Zamrożona klatka za menu (clear-output) · camera onResize · interp-OFF `read(1)` ·
cast + komentarz w GameplayScene · Space vs Play (hint w menu) · blur/disconnect edges ·
contextmenu · deadzone rescale · F1 preload in-flight complete · F2 progress po reject ·
F3 stary komentarz SceneContext · braki testów (InputSystem DOM, Engine-wiring, MeshSync/HUD, EMA spike).

---

## Uwagi techniczne / pułapki (zawczasu)

1. **PMREM i resize**: env map z PMREMGenerator nie lubi zmiany `renderer` size — generować
   raz po inicie; przy DPR change — regenerować świadomie (memory!).
2. **colorSpace**: HDR RGBE ładuje się jako linear — nie dotykać; baseColor z tekstur = sRGB
   (już robimy); KTX2 — liczyć na poprawne kolory po transcode (weryfikacja wizualna!).
3. **`aoMap` wymaga `uv1`** (channel 1) — MeshFactory robi to od Fazy 1 (texture.channel);
   przy modelach glTF atrybut TEXCOORD_1 mapuje się sam — pilnować tylko prymitywów.
4. **KTX2 transcoder**: wersja plików Basis musi pasować do wersji three (0.185) —
   vendorować z `three/examples/jsm/libs/basis/`, nie z CDN.
5. **meshopt vs Draco**: meshopt lżejszy i szybszy, Draco lepszy dla statycznych meshy —
   w demo oba opt-in, w README liczby.
6. **Materiał in-place**: zmiana `map` (nie tylko parametrów) wymaga `needsUpdate = true`
   i rebindu uniformów — to główny haczyk `applyUpdate`; test kontraktu to łapie.
7. **HDRI w repo**: 2–3 pliki ~1–4 MB (polyhaven CC0) — świadomy przyrost repo;
   alternatywa (link zewnętrzny) psuje offline demo.
8. **Panel ≠ logika**: MaterialEditor deleguje wszystko (compiler/env/lighting), sam trzyma
   tylko stan def + subskrypcje — wzorzec DevPanel, zero regresu w stronę GUI.js z 2021.
9. **Eksport JSON**: `Blob` + `URL.createObjectURL` (download), `FileReader` (import);
   nazwa pliku = `def.id + '.json'`.

---

## Kryteria akceptacji (checklist końcowy)

- [ ] Wave 0: wszystkie 12 nity domknięte, suite rośnie o testy z 0.4 (bez regresji 51)
- [ ] Editor: pełna kontrola map PBR + UV (repeat/offset/rotation/center) widoczna na żywo na prymitywie **i modelu glTF**
- [ ] IBL: co najmniej 2 środowiska HDR przełączalne; różnica oświetlenia wyraźna gołym okiem; zero hacków envMap
- [ ] Presety świateł: min. 3, przełączalne z panelu, zapisywane w JSON
- [ ] Zapis materiału do JSON → odświeżenie strony → wczytanie → identyczny wygląd (round-trip)
- [ ] Kompresja (jeśli fala D weszła): asset KTX2 i glTF/meshopt ładują się; liczby w README
- [ ] `npm test` zielone (poprzednie + nowe); lint/typecheck/build czyste; `three` tylko w render/examples
- [ ] Demo live zaktualizowane (auto-deploy), README pokazuje feature-set fazy
- [ ] Retro w 2 zdaniach + tag `phase-3`

## Definition of Done fazy

Checklist + review workera-reviewer + wizualna akceptacja właściciela na żywym demo
+ tag `phase-3` + demo online.
