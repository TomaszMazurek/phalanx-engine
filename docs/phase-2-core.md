# Faza 2 — Rdzeń silnika (plan szczegółowy)

> Silnik gier w przeglądarce na three.js · nadrzędny plan: [ENGINE_PLAN.md](./ENGINE_PLAN.md)
> Status: **PLAN** (retro Fazy 1: [phase-1-foundation.md](./phase-1-foundation.md#retro-fazy-1-2026-09-05))
> Szacunek: **~7 dni** (budżet, nie obietnica — patrz retro pkt 2) · pierwszy raz subagentów

---

## Cel

**To, co odróżnia bibliotekę od silnika.** Po Fazie 1 mamy ładny viewer; po Fazie 2 mamy
pętlę symulacji niezależną od framerate, asynchroniczne sceny z paskiem postępu, cache assetów
z glTF, input przez akcje abstrakcyjne i komunikację między systemami bez sprzężeń.

**Kamień milowy (widoczny, publiczny):** dwie sceny (menu + gameplay) przełączane asynchronicznie
z paskiem ładowania; obiekt sterowany inputem (klawiatura **i** gamepad) poruszający się logiką
fixed-timestep z interpolacją renderu — z przełącznikiem pokazującym różnicę w płynności.
Demo wdrożone na publiczny URL (nadrabiamy deploy Fazy 1).

## Zakres

### W zakresie (Definition of Done)

1. **`GameLoop`** — fixed timestep dla logiki + interpolacja renderu („Fix Your Timestep",
   G. Fiedler): akumulator, stały `FIXED_DT = 1/60`, ochrona przed spiralą śmierci.
2. **`SceneManager`** — kontrakt `Scene`, asynchroniczne ładowanie/przełączanie scen
   z paskiem postępu (reuse `LoadingOverlay`), zabezpieczenie przed wyścigiem podwójnego switcha.
3. **`AssetManager`** — generyczny cache z deduplikacją (również żądań in-flight),
   progress; **glTF** jako pierwszy format modeli (loader w warstwie `render/`).
4. **`InputSystem`** — klawiatura/mysz/gamepad; **akcje abstrakcyjne**
   (`bind('jump', [Key.Space, Pad.South])` — nie `if (key === ' ')` w logice),
   osie (`getAxis('moveX')`), edge'y (`wasPressed`/`wasReleased`) ważne przez jedną ramkę.
5. **`EventBus`** — typowane zdarzenia (`EventMap`), `on/once/off/emit`, subskrypcja zwraca
   funkcję odsubskrybowania; systemy komunikują się bez znajomości siebie nawzajem.
6. **Kontrakt `System` v2** — rozszerzenie o `fixedUpdate(fixedDt)` (logika, deterministyczna)
   obok `update(dt, alpha)` (praca per-klatka: render, input-edge, camera). Breaking change
   względem Fazy 1 — świadomy, dotyka 2 plików (`RenderSystem`, `MaterialViewer`).
7. **Granice importów wymuszone ESLintem** — `src/core/**` i `src/scenes/**` nie importują
   `three` (reguła `no-restricted-imports` scoped do plików; bez nowych zależności).
8. **Deployment** — konfiguracja hostingu (Vercel lub Netlify; statyczny `dist/`),
   publiczny URL demo Fazy 1+2, odnośnik w README.
9. Przykłady: `MenuScene` + `GameplayScene` (wzorzec do kopiowania w Fazach 3–6,
   jak `MaterialViewer` w Fazie 1).

### Poza zakresem (celowo)

- Fizyka, raycasting, character controller → **Faza 4** (rapier.js).
- Environment maps / IBL, kontrola UV, MaterialEditor z zapisem JSON → **Faza 3**.
- Kompresja: KTX2/meshopt/Draco → **Faza 3+** (glTF na razie bez rozszerzeń).
- ECS → gdy prosty model komponentowy się przemęczy (decyzja strategiczna #7).
- Pointer lock / touch input → dopiero gdy pojawi się realny use case (Faza 4+).
- Audio, UI layer, save/load → **Faza 6**.

---

## Decyzje techniczne

| Temat                | Decyzja                                                                     | Uzasadnienie                                                                       |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Timestep             | `FIXED_DT = 1/60 s`, max **5 substeps**/ramkę, przy trwałym przekraczaniu — zerowanie akumulatora (panic) | standard z „Fix Your Timestep"; 5×1/60 = 83 ms robiomu na tab-switch/spike |
| Kontrakt Systemu     | `fixedUpdate?(fixedDt)` dla logiki + `update?(dt, alpha)` per klatka; alpha = `accumulator / FIXED_DT` | rozdzielenie deterministycznej symulacji od pracy związanej z framerate'em           |
| Engine a GameLoop    | `GameLoop` wydzielony z `Engine`; `Engine` = composition root (rejestracja systemów, DI) | Engine przestaje być loop-em i fabryką naraz — jedna odpowiedzialność             |
| Sceny                | `Scene` to fabryka systemów + własne zasoby; `SceneManager` zarządza cyklem `preload → enter → exit → dispose` | sceny nie są Systemami — to kontenery systemów; przeciwieństwo globalnego `app`      |
| Async przełączanie   | next-scena preloaduje w tle (bieżąca renderuje dalej), overlay postępu, swap, dopiero potem `dispose` starej; **token wyścigu** na switch | brak czarnego ekranu; podwójny klik w menu nie robi nic złego                       |
| Assety                | `AssetManager.load<T>(uri, factory)` — cache po URI + dedup żądań in-flight (ta sama `Promise`); loadery GLTF/Texture jako adaptery w `render/` | core/ i assets/ czyste od three; dodanie formatu = adapter, nie zmiana silnika        |
| Input                | słownik akcja → bindingi; stan per-ramka (`wasPressed` kasowany przez GameLoop na końcu ramki); gamepad poll w `update` | logika nie zna fizycznych klawiszy; bindingi serializowalne do JSON (Faza 5: edytor) |
| Eventy               | `EventBus<EventMap>` z typami kluczy; `on` zwraca unsubscribe; sceny odpinają się w `exit`/`dispose` | koniec z martwymi listenerami — wycieki wykrywane w acceptance                       |
| Interpolacja         | helper `Interpolated<T>` (snapshot `prev`/`current` + `lerp(alpha)`) w `core/`; demo używa go do transformów obiektów sterowanych | wzorzec na przyszłą fizykę (Faza 4 robi to samo dla ciał rapiera)                   |
| Nowe zależności      | **zero** (GLTFLoader z `three/addons`, reszta własna)                        | faza core'owa nie dokleja bibliotek                                                 |

### Kontrakt `System` v2 (zmiana breaking)

```ts
// src/core/System.ts — Faza 2
export interface System {
  readonly name: string;
  init?(): void | Promise<void>;
  start?(): void;
  /** Logika symulacji — deterministyczna, stały krok. Zero lub więcej razy na ramkę. */
  fixedUpdate?(fixedDt: number): void;
  /** Praca per-klatka: rendering, input edges, kamera. `alpha` = ułamek kroku fixed [0..1]. */
  update?(dt: number, alpha: number): void;
  stop?(): void;
  dispose?(): void;
}
```

### Kontrakt `Scene` (skrót)

```ts
// src/scenes/Scene.ts
export interface SceneContext {
  assets: AssetManager; // preload/interpolacja przez DI
  events: EventBus<GameEvents>;
  input: InputSystem;
  loop: GameLoop; // tylko do debug-HUD w przykładach
}

export abstract class Scene {
  abstract readonly id: string;
  /** Ładowanie zasobów z raportowaniem postępu (0..1). Bieżąca scena renderuje dalej. */
  abstract preload(assets: AssetManager, onProgress: (p: number) => void): Promise<void>;
  /** Zwraca systemy sceny — SceneManager montuje/demontuje je w Engine. */
  abstract createSystems(): System[];
  enter?(): void;
  exit?(): void;
  dispose?(): void;
}
```

---

## Zadania (kolejność wykonania + podział na subagentów)

Fala = jednostka parallelizmu (workery wewnątrz fali równolegle; integracja commitowana
przez orchestratora — jeden writer na repo w danym momencie).

| #    | Zadanie                                             | Fala          | Efekt                                                                                              | Szac.  |
| ---- | --------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------- | ------ |
| 0    | Retro + ten plan + aktualizacja ENGINE_PLAN.md      | — (orchestrator) | wykonane w tym commicie                                                                            | 0      |
| 1    | Kontrakt `System` v2 + `GameLoop` (fixed timestep, substeps, alpha) + refactor `Engine` | A | `MaterialViewer`/`RenderSystem` zmigrowane na nowy kontrakt; demo jednego mesh-napedzanego z `fixedUpdate` | 1 d    |
| 2    | `EventBus` (typowany, `core/`)                      | A (równolegle z 1) | `on/once/off/emit` + testy scenariusza wycieku w przykładzie                                        | 0.5 d  |
| 3    | `InputSystem` + akcje + gamepad                     | B (równolegle z 4) | klawiatura/mysz/gamepad, bind/axis/edge, bindingi w JSON                                            | 1 d    |
| 4    | `SceneManager` + kontrakt `Scene` + async switch + overlay + token wyścigu | B | przełączanie scen z paskiem, spam-klik odporny                                                       | 1 d    |
| 5    | `AssetManager` (cache, dedup in-flight, progress) + adapter glTF w `render/` | C | `loadGLTF()` z postępem; drugi load tego samego URI = cache hit (0 żądań sieciowych) | 1.5 d  |
| 6    | `MenuScene` + `GameplayScene` + ruch obiektu przez akcje | D | menu → gameplay → menu; WASD/gamepad działa                                                          | 0.75 d |
| 7    | Showcase fixed-step: przełącznik interpolacji + debug HUD (FPS, fixed steps/ramkę, alpha) | D | różnica płynności widoczna gołym okiem (tryb „logic 30 Hz + interp on/off")          | 0.5 d  |
| 8    | Deployment: config hostingu + build + publiczny URL w README | E (po 6)     | demo Fazy 1+2 online; `npm run build` produktem                                                    | 0.5 d  |
| 9    | Acceptance: checklist + review + tag `phase-2`      | F (reviewer)  | patrz kryteria poniżej                                                                              | 0.25 d |

**Suma: ~7 dni.** Fale: A(1∥2) → B(3∥4) → C(5) → D(6,7) → E(8) → F(9).
Zależności: 3 i 4 wymagają kontraktu z fali A (System v2, EventBus). 5 niezależny od 3/4
(teoretycznie mógłby być w B — ale adapter glTF korzysta z `AssetManager` → trzymamy C).

### Podział na subagentów (pierwsze realne użycie)

- **Worker ×2 w fali A** (równolegle, niezależne pliki): (1) GameLoop+System v2 — dotyka
  `core/Engine.ts`, `core/System.ts`, `render/RenderSystem.ts`, `examples/MaterialViewer.ts`;
  (2) EventBus — nowy plik `core/EventBus.ts`. Kontrakty podane w promptach (Team memory context).
- **Worker ×2 w fali B**: InputSystem (`core/InputSystem.ts`, `core/Bindings.ts`) ∥
  SceneManager (`core/SceneManager.ts` lub `scenes/` + reuse `editor/LoadingOverlay.ts`).
- **Worker ×1 fala C**: AssetManager + `render/GLTFAdapter.ts`.
- **Worker ×1 fala D**: przykłady + showcase (integracja — jeden writer).
- **Reviewer** w fali F przed tagiem: granice importów, wycieki (eventy/sceny), substeps
  clamp, edge-case'y inputu. Dopiero potem wizualna akceptacja właściciela + tag `phase-2`.

---

## Uwagi techniczne / pułapki (zawczasu)

1. **Spirala śmierci**: jeśli `frameTime` przekracza `5 × FIXED_DT`, akumulator się przepełnia
   i każda kolejna ramka robi 5 substeps → zamarzanie. Rozwiązanie: po limicie substeps
   **zerujemy akumulator** („panic") i logujemy warning. Sytuacja trwała = problem sprzętowy,
   nie do uratowania akumulatorem.
2. **Edge'e inputu vs fixed steps**: ramka przy 144 Hz może zawierać 0–2 substeps —
   `wasPressed('jump')` sprawdzone w `fixedUpdate` potrafi zostać pominięte (0 substeps) albo
   podwojone. Wzorzec: **input buffer** — edge czytamy w `update`, ustawiamy flagę-zapytanie,
   konsumujemy w najbliższym `fixedUpdate` (klasyka z platformerów). Dokumentujemy w przykładzie.
3. **Gamepad**: poll w `update` (per klatka), `gamepadconnected` event → log. W niektórych
   przeglądarkach gamepad „śpi" do pierwszego wciśnięcia — nie failujemy na pustym `navigator.getGamepads()`.
4. **Interpolacja tylko dla obiektów sterowanych z `fixedUpdate`**: meshe toczące się
   render-side (np. obrót dekoracyjny w `MaterialViewer`) nie potrzebują lerp — mieszanie
   dwóch trybów w jednym obiekcie to bug.
5. **Dispose scen**: `exit` ≠ `dispose`. Przełączenie tam-i-z-powrotem tego samego assetu
   drugi raz ma trafić w cache (`AssetManager`), a nie w sieć — jeśli nie trafia, dispose
   wyczyścił cache zbyt agresywnie. W acceptance: `renderer.info.memory` stabilne po 5 switchach.
6. **Wyścig switcha scen**: token/counter w `SceneManager.switchTo()`; przełączanie w trakcie
   przełączania ignoruje starsze żądania (lub kolejkuje najnowsze — wybieramy „ignoruj",
   prostsze i deterministyczne).
7. **glTF bez rozszerzeń**: DRM/Draco/KTX2 świadomie nie teraz — loader bez dekoratorów,
   czyli szybki. `colorSpace` na teksturach baseColor ustawia loader — weryfikujemy wizualnie,
   bo to klasyczne źródło „płaskiego" PBR.
8. **EventBus i `any`**: typy przez interfejs `EventMap` (kontrawariancja podpisów);
   żadnych stringowych magii poza literalnymi kluczami mapy.
9. **ESLint granice importów**: `no-restricted-imports` z `patterns: ['three', 'three/**']`
   w bloku `files: ['src/core/**', 'src/scenes/**']` — flat config, zero nowych zależności.
10. **Deployment (statyczny hosting)**: `dist/` z `vite build`; base path względny
    (`base: './'` w `vite.config.ts` — działa pod dowolnym subpathiem). Publiczność URL
    sprawdzać w trybie incognito (cache CDN).

---

## Kryteria akceptacji (checklist końcowy)

- [ ] Menu → gameplay z paskiem postępu; powrót do menu; 5 switchów pod rząd bez błędów w konsoli
- [ ] `renderer.info.memory` stabilne po 5 przełączeniach scen (brak wycieku geometrii/tekstur)
- [ ] Podwójne/szybkie kliknięcie „Play" nie psuje stanu (token wyścigu działa)
- [ ] Obiekt sterowany WASD **i** gamepadem; akcja `jump` bindowana do Space + przycisk pada
- [ ] Logika biegnie z `FIXED_DT = 1/60` niezależnie od refresh rate (debug HUD pokazuje
      steps/ramkę; przy 144 Hz widoczne ramki z 0 substeps)
- [ ] Przełącznik interpolacji on/off: **widoczna różnica płynności** przy throttled renderze
- [ ] glTF ładuje się z postępem; ponowny load tego samego URI = 0 żądań sieciowych (DevTools)
- [ ] `npm run lint` → 0 błędów; `tsc --noEmit` czysto; brak `three` w importach `src/core/**` i `src/scenes/**` (reguła ESLint)
- [ ] Publiczny URL działa (incognito); README linkuje demo i opisuje nową architekturę core
- [ ] Retro w 2 zdaniach w tym dokumencie po zamknięciu fazy

## Definition of Done fazy

Powyższa checklist + review subagenta-reviewer przed tagiem + wizualna akceptacja właściciela
+ commit z tagiem `phase-2` + demo online.
