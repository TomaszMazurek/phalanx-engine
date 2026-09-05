# Silnik gier w przeglądarce — plan główny

> Projekt: przebudowa `materialeditor_js` (viewer materiałów PBR, three.js r~120, kod prototypowy z 2021)
> w silnik gier przeglądarkowych z fundamentem **three.js**.
> Status planu: zgrubny (fazy i zakres). Szczegóły interfejsów — osobne dokumenty, po jednym na fazę.
> Ostatnia aktualizacja: plan wstępny.

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

**Cel: to, co odróżnia bibliotekę od silnika.**

1. **`Engine`** — bootstrap, lifecycle (init/start/update/stop), dependency injection.
2. **`GameLoop`** — fixed timestep dla logiki + interpolacja renderu („Fix Your Timestep").
3. **`SceneManager`** — asynchroniczne ładowanie/przełączanie scen z paskiem postępu.
4. **`AssetManager`** — cache, deduplikacja, loading progress, obsługa glTF
   (TODO z commitów z 2020 — od teraz obowiązkowe).
5. **`InputSystem`** — klawiatura/mysz/gamepad, akcje abstrakcyjne
   (bind „jump" → klawisz; nie `if (key === ' ')` w logice).
6. **`EventBus`** — komunikacja między systemami bez sprzężenia.

**Kamień milowy:** dwie sceny (menu + gameplay) przełączane z paskiem ładowania, input przez akcje.

## Faza 3 — Render i materiały (~1–2 tygodnie)

**Cel: material editor jako w pełni działające narzędzie — tu dożywa stare repo.**

- `MeshFactory` — prymitywy + ładowanie modeli glTF.
- `MaterialEditor` — panel z pełną kontrolą map PBR
  (baseColor/normal/roughness/AO), transformacji UV; **zapis materiału do JSON**.
- `EnvironmentSystem` — skyboxy, environment maps (bez starego hacka envMap z tła sceny).
- `LightingSystem` — ambient/hemi/directional/point z presetami.

**Kamień milowy:** można stworzyć materiał w panelu i zapisać/odczytać go z JSON.

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

---

## Ryzyka i założenia (świadomie przyjęte)

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
