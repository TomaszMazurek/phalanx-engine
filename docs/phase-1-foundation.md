# Faza 1 — Fundament (plan szczegółowy)

> Silnik gier w przeglądarce na three.js · nadrzędny plan: [ENGINE_PLAN.md](./ENGINE_PLAN.md)
> Status: **UKOŃCZONA** · tag `phase-1` (commit `49ec4e3`) · zaakceptowana wizualnie przez właściciela

---

## Cel

**Działający, nowoczesny material viewer = pierwsza komórka silnika.**

Nowe repo-życie starej aplikacji: ta sama funkcjonalność, którą miała `materialeditor_js`
(przeglądanie materiałów na prymitywach, skyboxy, światła, panel kontrolny),
ale na współczesnym stacku i w architekturze, która się rozrośnie w silnik.

## Zakres

### W zakresie (Definition of Done)

1. Projekt na Vite + **TypeScript** + ESLint + Prettier, uruchamialny z fresh clone
   przez `npm install && npm run dev` **bez żadnych ręcznych kroków** (koniec z `/libs` w gitignore).
2. Port funkcjonalności starego viewer:
   - wybór tekstury (16 zestawów) + skybox (5),
   - wybór prymitywu (11),
   - dwa materiały obok siebie: **Phong** i **PBR (Standard)** — jak w starej aplikacji,
   - światła: ambient + hemisphere + directional + 2× point (z kontrolą intensywności),
   - panel lil-gui: tekstura, prymityw, skybox, światła, parametry materiału
     (roughness/metalness/shininess), prędkość obrotu.
3. Ładowanie z paskiem postępu (overlay) przez `THREE.LoadingManager` — koniec z 5 sekwencyjnymi pętlami.
4. Szkielet katalogów z [ENGINE_PLAN.md](./ENGINE_PLAN.md) (`src/core`, `src/render`, `src/assets`,
   `src/editor`, `src/examples`) — z minimalną zawartością, tylko tyle, ile Faza 1 potrzebuje.
5. README (uruchomienie, struktura, cel projektu).
6. Czyszczenie `.gitignore` (patrz: zadanie 0).

### Poza zakresem (celowo)

- Kontrola UV (repeat/offset/rotation/center) i `MaterialEditor` z zapisem JSON → **Faza 3**
  (w Fazie 1 maks. suwak „repeat" do walidacji map).
- Fixed timestep, `SceneManager`, `InputSystem`, `EventBus` → **Faza 2**.
- Environment maps / IBL (RGBELoader, HDR) → **Faza 3** (`EnvironmentSystem`).
- Fizyka, raycasting → **Faza 4**.
- Loading własnych tekstur przez drag&drop — nie (martwy przycisk ze starego GUI nie wraca).

---

## Decyzje techniczne

| Temat          | Decyzja                                                            | Uzasadnienie                                                                    |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Język          | **TypeScript**, strict, `noImplicitAny`, bez `any` w nowym kodzie  | kontrakt interfejsów od dnia 1; utrzymanie ~2× tańsze                           |
| Bundler        | Vite (ESM, dev server, HMR)                                        | zero-config, natychmiastowy start                                               |
| three          | najnowszy stabilny z npm                                           | koniec z zamrożonym r~120 w `/libs`                                             |
| Panel          | lil-gui                                                            | duchowy spadkobierca dat.gui, aktywnie utrzymywany                              |
| Dane tekstur   | **manifest `textures/manifest.json`** zamiast hardcode w klasie    | nowa tekstura = wpis w JSON, zero zmian w kodzie                                |
| Model tekstury | obiekt z nazwanymi polami (patrz niżej) zamiast tablicy `[0..7]`   | koniec z magicznymi indeksami                                                   |
| Geometrie      | mapa konstruktorów `{Box: THREE.BoxGeometry, ...}`                 | koniec z `eval`                                                                 |
| Materiały      | klasy `MeshPhongMaterial`/`MeshStandardMaterial` z gotowymi mapami | koniec z hackowaniem `ShaderLib` — odzyskujemy pełną zgodność z silnikiem three |

### Model danych tekstury (koniec z magicznymi indeksami)

```ts
// src/assets/TextureSet.ts
interface TextureSet {
  id: string; // "metal1"
  path: string; // "textures/metal/metal1/"
  color: number; // 0xffffff — zapasowy diffuse, gdy brak mapy
  maps: {
    baseColor?: THREE.Texture;
    bump?: THREE.Texture;
    normal?: THREE.Texture;
    roughness?: THREE.Texture; // zarezerwowane (Faza 3)
    ao?: THREE.Texture;
    displacement?: THREE.Texture; // zarezerwowane (Faza 3)
  };
}
```

### Format manifestu (`public/textures/manifest.json`)

```jsonc
{
  "sets": [
    {
      "id": "metal1",
      "path": "textures/metal/metal1/",
      "color": 16777215,
      "maps": ["baseColor", "bump", "normal", "ao"],
    },
  ],
  "skyboxes": [{ "id": "bethnal", "path": "textures/skybox/bethnal/" }],
}
```

`maps` = lista dostępnych plików wg konwencji nazw (`Base_Color.jpg`, `Bump.jpg`,
`Normal.jpg`, `Ambient_Occlusion.jpg`). Manifest odzwierciedla to, co realnie leży na dysku —
nie ładujemy plików, których nie ma (stary kod ładował Roughness/Displacement nawet gdy ich nie było… właściwie na odwrót: zakładał że są).

---

## Zadania (kolejność wykonania)

| #   | Zadanie                                         | Efekt                                                                                                                                                           | Szac.  |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 0   | Czystka `.gitignore` + przeniesienie assetów    | usunięcie martwych wpisów (`.png`, `.jpg`, `textures/`); `git mv textures public/textures` (Vite serwuje `public/` z roota)                                     | 0.25 d |
| 1   | Init projektu                                   | `npm create vite` (vanilla-ts), `three`, `lil-gui`, ESLint+Prettier, `npm run dev` podaje pustą stronę                                                          | 0.25 d |
| 2   | `src/core`: minimalny `Engine`                  | klasa z lifecycle `init/start/stop` + prosty pętla RAF (variable step; **fixed timestep dopiero Faza 2** — świadomy dług techniczny)                            | 0.5 d  |
| 3   | `src/render`: `Renderer` + `CameraRig`          | adapter three: WebGLRenderer, PerspectiveCamera, OrbitControls; renderer jako jedyny moduł, który dotyka three bezpośrednio… poza `src/render` tylko przez typy | 0.5 d  |
| 4   | `src/assets`: `AssetManager` + `TextureLibrary` | manifest → `TextureSet[]`; ładowanie przez `LoadingManager` z `onProgress`; overlay „Loading… x%"                                                               | 0.75 d |
| 5   | `src/render`: `MeshFactory`                     | mapa konstruktorów prymitywów + parametry; `uv2` dla `aoMap` (patrz: uwaga techniczna)                                                                          | 0.5 d  |
| 6   | `src/render`: `LightingRig`                     | port koncepcji Light.js: ambient/hemi/directional/2×point + bulb-meshes, API `setIntensity()` (GUI od tego korzysta)                                            | 0.5 d  |
| 7   | `src/editor`: `DevPanel`                        | lil-gui: foldery Lights/Objects/Material/Textures/Camera; kontrolery z callbackami — zero logiki w panelu, delegacja do modułów                                 | 0.75 d |
| 8   | `src/examples`: `MaterialViewer`                | składa wszystko w scenę: 2 meshe (Phong+PBR), skybox, światła; główny przypadek użycia Faz 2–6 będzie kopiował ten wzorzec                                      | 0.5 d  |
| 9   | README + weryfikacja                            | fresh clone → `npm i && npm run dev` działa; lint 0 błędów; brak błędów w konsoli przeglądarki                                                                  | 0.5 d  |

**Suma: ~4.75 dni** — mieści się w założeniu „~1 tydzień".

---

## Mapowanie: stare → nowe (co zastępuje co)

| Stare                                                                      | Nowe                                                               | Różnica kluczowa                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `Textures.js` (307 linii, 4 pętle copy-paste, hardcode)                    | `AssetManager` + `TextureLibrary` + manifest JSON                  | ~80 linii, `Promise`-y z LoadingManager, lista zasobów w danych |
| `Shape.js` (`eval`, magiczne paramsy)                                      | `MeshFactory`                                                      | mapa konstruktorów, jawne parametry per typ                     |
| `Material.js` (hack ShaderLib, 239 linii)                                  | `MeshPhongMaterial`/`MeshStandardMaterial` + preset z `TextureSet` | zgodność z three, zero ręcznych `defines`/uniformów             |
| `Light.js` (96 linii, zakomentowane cienie)                                | `LightingRig`                                                      | czyste API, bez martwego kodu                                   |
| `GUI.js` (398 linii, bugi `texOriginY,Y`, literówki `uniformsNeedsUpdate`) | `DevPanel` (~150 linii)                                            | delegacja zamiast logiki; tylko kontrolery, które coś robią     |
| `main.js` (globalny `app`, podwójny resize)                                | `MaterialViewer` + `Engine`                                        | DI, jeden listener resize w Rendererze                          |
| `index.html` (script-tagi, brak `#loader`)                                 | `index.html` z Vite (1 skrypt entry) + overlay HTML                | aplikacja uruchamialna z repo                                   |

---

## Uwagi techniczne / pułapki (zawczasu)

0. **Brak zależności do podbicia — start od zera.** Repo nie ma `package.json`; stare libs
   (three r~120, dat.gui) były vendored w `libs/`, który jest gitignored i nie istnieje.
   Nie migrujemy starych wersji — montujemy od razu najnowszy three z npm.
   Przed startem: sprawdzić aktualną wersję `three` (npm view three version)
   i odnotować w README, na jakiej wersji projekt stoi.

1. **`aoMap` wymaga drugiego UV** (`uv2`). Od three r152 istnieje `texture.channel`;
   bez tego `MeshFactory` musi dokładać atrybut `uv2 = uv`. Zaplanowane w zadaniu 5 —
   to jedyna „niecena" techniczna pułapka tej fazy.
2. **Kolory/encoding**: `outputColorSpace` (nowe API) + `SRGBColorSpace` na mapach koloru
   (baseColor), liniowa przestrzeń na mapach danych (normal/AO/bump). Stary kod tego nie rozróżniał —
   nowy musi, inaczej PBR wygląda „płasko".
3. **Skybox**: `CubeTextureLoader` z listą 6 ścian — jak w starym kodzie, tylko bez `window.origin + "/static" + pathname` (Vite serwuje z roota; ścieżki względne).
4. **Tekstury różnej rozdzielczości**: stary kod ustawiał `anisotropy: 16` na jednym tylko baseColor — nowy kod ustawia na wszystkich mapach koloru.
5. **Anisotropy zależny od GPU**: `renderer.capabilities.getMaxAnisotropy()` zamiast hardcode 16.
6. **`tsconfig`**: `strict: true`, `moduleResolution: bundler`, ścieżki `@/` → `src/` (alias konfigurowany w `vite.config.ts`).
7. **Nie ruszamy starych plików** (`main.js`, `scripts/*`) — pozostają jako referencja; nowe żyje w `src/`.

---

## Kryteria akceptacji (checklist końcowy)

- [ ] Fresh clone + `npm install && npm run dev` → działa bez ręcznych kroków
- [ ] Widoczne 2 meshe: Phong i PBR, oba z wybraną teksturą (normal map + AO działa — widać różnicę po włączeniu/wyłączeniu)
- [ ] Przełączanie tekstury, prymitywu, skyboxa z panela działa bez błędów w konsoli
- [ ] Suwaki świateł i parametrów materiału działają na obu meshach
- [ ] Pasek postępu pokazuje realny etap ładowania (overlay znika po załadowaniu)
- [ ] `npm run lint` → 0 błędów; `npm run build` → produkt w `dist/`
- [ ] Brak `any`, brak `eval`, brak globali — wszystkie nowe pliki przechodzą `tsc --noEmit`
- [ ] README: jak uruchomić, struktura katalogów, odnośnik do `docs/ENGINE_PLAN.md`

## Definition of Done fazy

Powyższa checklist w całości odhaczona + commit z tagiem `phase-1`.
Po Fazie 1 robimy retro: co poszło dobrze, co zmieniamy w planie Faz 2–6
(szczebla szczegółowości tego dokumentu używamy też dla Faz 2+).

---

## Retro Fazy 1 (2026-09-05)

### Co poszło dobrze

1. **Dyscyplina zakresu.** Wszystko z sekcji „poza zakresem" faktycznie zostało poza zakresem —
   żaden scope creep. Świadomy dług techniczny jest udokumentowany w miejscu powstania
   (`Engine.ts` i `System.ts` mają komentarze wskazujące Fazę 2 zamiast TODO rozrzuconych po kodzie).
2. **Architektura obroniła się bez wyjątków.** Zero importów three.js w `core/`, DI zamiast
   globali, manifest zamiast hardcode — port znanego kodu nie wymusił ani jednego odstępstwa
   od decyzji przyjętych w planie. Wniosek: decyzje architektoniczne Faz 2–6 można przyjmować
   z podobną pewnością.
3. **Checklist akceptacji spisana przed startem** została użyta dosłownie do zamknięcia fazy
   (fresh clone, lint, konsola). Format dokumentu fazowego = kontrakt — powtarzamy dla Faz 2+.
4. **Tempo:** cała faza (zadania 0–9) zamknęła się w jednym dniu roboczym przy 2 commitach
   implementacyjnych — estymata ~4.75 dnia okazała się buforem, nie prognozą.

### Co zmieniamy w Fazach 2–6

1. **Deployment demo nie doszedł do skutku w Fazie 1.** Od teraz jawny deliverable każdej fazy
   (dodane do [ENGINE_PLAN.md](./ENGINE_PLAN.md)); demo Fazy 1 nadrabiane w Fazie 2,
   razem z deployem Fazy 2.
2. **Estymaty Faz 2+ traktujemy jako budżet, nie obietnicę** — ale Faza 2 to nowy grunt
   (timery, input, asynchroniczne sceny) w odróżnieniu od portu znanego kodu; bufor zostaje.
3. **Pierwsze użycie subagentów przesuwa się z Fazy 1 na Fazę 2** (zadania sekwencyjne
   Fazy 1 nie dawały parallelizmu; Faza 2 daje — patrz plan [phase-2-core.md](./phase-2-core.md)).
4. Drobiazg: literówka w nagłówku tego dokumentu (tag `phase-1` wskazuje `49ec4e3`,
   nie `9d18b69`) — poprawiona przy okazji retro.
