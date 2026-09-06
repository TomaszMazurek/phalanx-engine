# Silnik gier w przeglądarce — plan główny

> Projekt: przebudowa `materialeditor_js` (viewer materiałów PBR, three.js r~120, kod prototypowy z 2021)
> w silnik gier przeglądarkowych z fundamentem **three.js**.
> Status planu: zgrubny (fazy i zakres). Szczegóły interfejsów — osobne dokumenty, po jednym na fazę.
> Ostatnia aktualizacja: po Fazie 3 (status + retro).

---

## Decyzje strategiczne (przyjęte)

1. **Fundament: three.js** — odrzucono Babylon.js / PlayCanvas (cel: budowa własnego silnika,
   nauka + pełna kontrola), odrzucono Google Filament (tylko renderer, zero reszty silnika).
2. **Stary kod przepisujemy, nie rozbudowujemy.** Przenosimy wyłącznie koncepty
   (biblioteka tekstur PBR, kontrola UV, prymitywy, skyboxy). Kod `main.js` i `scripts/`
   zostaje w repo jako referencja i nie jest ruszany.
3. **Własny renderer — nie.** three.js zamyka rendering; silnik to warstwa produktowa na nim
   (sceny, assety, input, fizyka, narzędzia).
4. **Bez globalnego `app`.** Architektura: moduły + dependency injection.
5. **Silnik nie importuje three.js bezpośrednio** — tylko przez warstwę `render/`
   (możliwość podmiany renderera w przyszłości, izolacja zależności).
6. **Fizyka: rapier.js** (WASM, kompatybilny z three), doklejana dopiero w Fazie 4.
7. **ECS — nie na start.** Zaczynamy od prostego komponentowego modelu na klasach;
   ECS (np. bitecs) dopiero jeśli prosty model się przemęczy.
8. **React/R3F ani żaden framework UI nie wchodzi do runtime'u silnika.**
   Fundament pozostaje czysty three.js + DI (patrz decyzja 5). Framework (React/Svelte)
   jest opcjonalny dopiero w Fazie 5 jako powłoka **osobnej aplikacji edytora**,
   konsumującej silnik jako bibliotekę — wzorzec Unity/Godot/PlayCanvas (edytor ≠ runtime).

---

## Filary projektowe Phalanx

Sześć zasad — filtr dla KAŻDEJ decyzji, silnikowej i gamedevowej.

### 1. 30 seconds of fun

> **"Every system must extend the fun, not compensate for its absence."**

Geneza (właściciel, 2026-09-06): zasada szkoły **Halo** ("30 seconds of fun" — jeśli gra
wciąga gracza 30-sekundową pętlą, to masz grę) i wzorzec **Doom**: feeling broni +
strzelanie + mapy + muzyka = **core**; reszta to nadbudowa, która przedłuża pętlę.

Konsekwencje projektowe:

1. **Najpierw pętla, potem systemy** — gameplay demo (Faza 4+) musi udowodnić
   30-sekundową pętlę ZANIM dosypiemy systemy wokół niej.
2. Każdy nowy system w Fazach 4–6 odpowiada na pytanie: **"co dodaje do pętli?"**
   (emergent interactions, juice, feedback) — nie "czego brakuje, żeby wypełnić listę featurow".
3. Systemy nie ratują nudnej pętli — jeśli core nie wciąga, żadna nadbudowa tego nie naprawi.

### 2. Gameplay flow > systems

Systemy istnieją po to, żeby podtrzymywać flow gracza — nie dla kompletności listy
featurow silnika. Każdy system odpowiada na pytanie: „co dodaje do pętli?".

### 3. Visuals > Graphics

Nie chodzi o liczbę polygonów, ray tracing czy „next-gen fidelity" — tylko o to,
**co gracz widzi i jak szybko to rozumie**.

Dobre visuals to:

- mocne sylwetki przeciwników,
- czytelne kolory frakcji,
- natychmiast rozpoznawalne pociski i bronie,
- dobry kontrast mapy,
- charakterystyczne efekty trafień,
- animacja, która daje feedback,
- spójny art direction,
- obraz, który nie rozpada się przy 30 przeciwnikach, rakietach i sześciu wieżach naraz.

**DOOM jest wzorcem**: ekran może być kompletnym chaosem, a mimo to wiesz, gdzie
jesteś, kto cię atakuje, co właśnie trafiłeś i dokąd masz uciekać.
Czytelność chaosu jest trudniejsza niż fidelity — i cenniejsza.

### 4. Audio is gameplay

Dźwięk to kanał feedbacku, nie ozdoba: strzał, trafienie, postawienie wieży,
kroki wroga — każde mówi graczowi coś ważnego. Audio planujemy jak system gry.

### 5. Performance > fidelity

Target: mainstream/iGPU (RTX 3060 to górna granica testu). Stabilny frame pacing
wygrywa z eyecandy; obraz degraduje się gracefully, nie dramatycznie.

### 6. Games grow the engine

> **"Phalanx nie ma być ukończonym silnikiem. Ma rosnąć przez gry."**

Każda gra:

1. **testuje inną część engine'u,**
2. **wymusza konkretne ulepszenia,**
3. **zostawia po sobie reusable code,**
4. **zwiększa tempo następnego projektu.**

Pierwsza może być toporna. Druga mniej. Trzecia już zacznie korzystać z gotowych
systemów. I nagle po kilku latach nie masz „side-projectowego Three.js engine'u",
tylko własny dojrzały warsztat do robienia gier.

Konsekwencje praktyczne:

- Faz 4–6 nie domykamy „dla kompletności silnika" — scope każdej dogaduje **gra**, którą na nim robimy.
- Po każdej grze: mini-retro **„co silnik zyskał"** — reusable systemy wyławiamy świadomie, nie przy okazji.
- Tempo następnej gry > perfekcjonizm architektoniczny; długi techniczne zapisujemy (jak nity w retro faz), nie spychamy pod dywan.

---

## Cel pozatechniczny: powrót do branży graphics

Projekt jest wehikułem zmiany pracy (fintech → grafika). Konsekwencje:

1. **Repo publiczne + działające demo po każdej fazie** — deployment jest deliverable fazy, nie dodatkiem na końcu.
2. **Stack pokazuje kompetencje rynkowe 2026**: TSL, KTX2/meshopt, Rapier, WebGPU — nie erę 2021.
3. **Każda faza kończy się czymś widocznym** (demo, benchmark, liczby) — perfekcjonizm architektoniczny to zagrożenie dla celu, nie cnota.
4. Właściciel projektu: mgr inż. z global illumination (magisterka), 2 lata zawodowego graphics programmingu (webowy edytor 3D z slicerem, Assimp/Emscripten), własny binarny format assetów (~60% kompresji). Faza 3 (EnvironmentSystem/IBL) i ewentualny side-quest „progresywny path tracer w TSL/WebGPU" to naturalne punkty ekspozycji jego kompetencji.

---

## 0. Przenosimy / wyrzucamy (bilans starego repo)

| Ze starego repo                                                  | Los                  | Dokąd trafia                                     |
| ---------------------------------------------------------------- | -------------------- | ------------------------------------------------ |
| Logika tekstur PBR + kontrola UV (repeat/offset/rotation/center) | przenosimy (koncept) | `MaterialEditor` + `TextureLibrary`              |
| Skyboxy, biblioteka tekstur                                      | przenosimy           | `AssetManager`                                   |
| Shape.js (lista prymitywów)                                      | przenosimy koncept   | `MeshFactory` (mapa konstruktorów, **bez eval**) |
| Light.js                                                         | przenosimy koncept   | `LightingSystem`                                 |
| main.js, GUI.js, Material.js (jako kod)                          | do kosza             | przepisujemy od zera                             |
| Globalny `app`, hack `ShaderLib`, eval, magiczne indeksy         | do kosza             | —                                                |

---

## Faza 1 — Fundament (~1 tydzień)

**Szczegółowy plan fazy:** [phase-1-foundation.md](./phase-1-foundation.md)
**Status: UKOŃCZONA** · tag `phase-1` (commit `49ec4e3`) · zaakceptowana wizualnie przez właściciela

**Cel: działający, nowoczesny material viewer = pierwsza komórka silnika.**

- Vite + TypeScript + ESLint/Prettier + `package.json` (koniec ze script-tagami i `/libs` w gitignore).
- Zależności: `three` (najnowszy) jako jedyna zależność renderingowa + `lil-gui` do dev-paneli.
- Struktura katalogów:

```
src/
  core/        # silnik, zero zależności od three
  render/      # adapter three.js
  assets/      # loader tekstur/meshów/skyboxów
  editor/      # narzędzia dev (panele, material editor)
  examples/    # scena testowa (dziedziczy po silniku)
```

**Kamień milowy:** material viewer działa na nowym three.js, stary problem „brak libs po klonie"
znika (zależności z npm).

## Faza 2 — Rdzeń silnika (~2–3 tygodnie)

**Szczegółowy plan fazy:** [phase-2-core.md](./phase-2-core.md) (retro Fazy 1, podział na subagentów)
**Status: UKOŃCZONA** · tag `phase-2` · zaakceptowana wizualnie · demo: https://phalanx-engine.tomasz-a-mazurek.workers.dev

**Cel: to, co odróżnia bibliotekę od silnika.**

1. **`Engine`** — bootstrap, lifecycle (init/start/update/stop), dependency injection.
2. **`GameLoop`** — fixed timestep dla logiki + interpolacja renderu („Fix Your Timestep").
3. **`SceneManager`** — asynchroniczne ładowanie/przełączanie scen z paskiem postępu.
4. **`AssetManager`** — cache, deduplikacja, loading progress, obsługa glTF
   (TODO z commitów z 2020 — od teraz obowiązkowe).
5. **`InputSystem`** — klawiatura/mysz/gamepad, akcje abstrakcyjne
   (bind „jump" → klawisz; nie `if (key === ' ')` w logice).
6. **`EventBus`** — komunikacja między systemami bez sprzężenia.

**Kamień milowy:** dwie sceny (menu + gameplay) przełączane z paskiem ładowania, input przez akcje, demo wdrożone na publiczny URL (nadrabiamy deploy Fazy 1).

## Faza 3 — Render i materiały (~1–2 tygodnie)

**Szczegółowy plan fazy:** [phase-3-materials.md](./phase-3-materials.md)
**Status: UKOŃCZONA** · tag `phase-3` · zaakceptowana wizualnie · demo: https://phalanx-engine.tomasz-a-mazurek.workers.dev/viewer

**Cel: material editor jako w pełni działające narzędzie — tu dożywa stare repo.**

- `MeshFactory` — prymitywy + ładowanie modeli glTF.
- `MaterialEditor` — panel z pełną kontrolą map PBR
  (baseColor/normal/roughness/AO), transformacji UV; **zapis materiału do JSON**.
- `EnvironmentSystem` — skyboxy, environment maps (bez starego hacka envMap z tła sceny).
- `LightingSystem` — ambient/hemi/directional/point z presetami.

**Kamień milowy:** można stworzyć materiał w panelu i zapisać/odczytać go z JSON.

## Gry na Phalanx (silnik rośnie przez gry)

**Gra 1 — Arena Defense Shooter** (koncept roboczy): [games/GAME-1-arena-defense.md](./games/GAME-1-arena-defense.md)
— fast sci-fi arena shooter + TD + CTF; core loop: move → shoot → build → react → chase → recover/capture.
V1 celowo prymitywna; to ona wyznaca scope Faz 4–6 (fizyka odkładana, UI/audio wciągane do przodu).

---

## Faza 4 — Fizyka i interakcja (~1 tydzień)

- **rapier.js** — kolizje, RigidBody, character controller.
- Raycasting + picking (podstawa pod przyszły edytor scen).

**Kamień milowy:** prymityw z fizyką sterowany inputem (np. kulka po rampie).

## Faza 5 — Narzędzia dev (w miarę potrzeb)

- Dev overlay: FPS, stats, inspector sceny (drzewo obiektów).
- Panel material editora jako pierwsza „prawdziwa" wtyczka edytora.
- Zapis/odczyt sceny do JSON — pierwszy krok do edytora w przeglądarce
  (ambicjonalnie: mini-PlayCanvas).

## Faza 6 — Gameplay features (w miarę rozwoju gry)

- Audio (wrapper WebAudio).
- Komponenty zachowań (skryptowanie scen).
- UI layer.
- Save/load stanu gry.
- **Tor mobile (opcjonalny, decyzja właściciela 2026-09-06):** krok 1 = **PWA** (manifest +
  service worker + ikony; ~1 dzień; „apka" na home screenie); krok 2 = **Capacitor**
  (natywna powłoka WebView, App Store/Play) tylko jeśli dystrybucja sklepowa stanie się
  celem — iOS wymaga Maca+Xcode i konta Apple ($99/rok). Prawdziwy natywny port
  (Metal/Vulkan) świadomie poza scope. Architektura już gra: granica render/,
  akcje abstrakcyjne w InputSystem (touch = nowy binding source), target iGPU,
  KTX2 z Fazy 3.

---

## Ryzyka i założenia (świadomie przyjęte)

- **Target sprzętowy: mainstream 2026 — RTX 3060 i iGPU** (balans „fajerwerki vs wydajność").
  Projektujemy pod dolną granicę (iGPU — laptopowe/integrowane grafiki); RTX 3060 to górna
  granica sensownego testu. DLSS/denoisery poza scope — nie są celem demo.
- **Nie robimy własnego renderera** — to różnica między realnym celem a projektem
  o pokolenie dłuższym.
- **Fizyka dopiero w Fazie 4** — najpierw fundamenty potrzebne każdej grze; rapier łatwo dokleić później.
- **Tekstury**: długoterminowo warto przejść na KTX2/kompresję, ale nie na starcie.
- **Stare API three.js w `scripts/`** — nie próbujemy „naprawiać" starego kodu, tylko piszemy nowy;
  stare pliki pozostają jako referencja semantyczna.

---

## Szacunki

| Faza                                                     | Czas (praca dorywcza) |
| -------------------------------------------------------- | --------------------- |
| 1 — Fundament                                            | ~1 tydzień            |
| 2 — Rdzeń silnika                                        | ~2–3 tygodnie         |
| 3 — Render i materiały                                   | ~1–2 tygodnie         |
| 4 — Fizyka                                               | ~1 tydzień            |
| 5 — Narzędzia dev                                        | wg potrzeb            |
| 6 — Gameplay                                             | wg gry                |
| **Total do działającego silnika z fizyką i narzędziami** | **~6–8 tygodni**      |

---

## Kolejność pierwszych konkretnych kroków

1. Zainicjować projekt (`npm init`, Vite, TS) obok starego kodu — `main.js`/`scripts/`
   zostają jako referencja, nie ruszamy.
2. Zdefiniować interfejsy core: `Engine`, `GameLoop`, `System` — ustalają kontrakt na wszystko dalej.
3. Przenieść material viewer jako pierwszy moduł (walidacja architektury na czymś znanym).

**Otwarta decyzja:** TypeScript (rekomendowany — przy silniku ~2× tańsze utrzymanie; plan Fazy 1 zakłada TS) vs JavaScript.
