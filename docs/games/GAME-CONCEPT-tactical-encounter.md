# Gra — Tactical Encounter (koncept inspirowany F.E.A.R.)

> **Status:** POMYSŁ / BACKLOG, bez zobowiązania do realizacji i bez zmiany aktywnego planu Gry 1.  
> **Silnik:** Phalanx (TypeScript + three.js), przeglądarka.  
> **Inspiracja:** F.E.A.R. (2005) — *jakość interakcji i napięcia*, nie kopiowanie świata, fabuły, postaci ani zasobów Monolith.  
> **Data zapisu:** 2026-10-20.  
> **Punkt odniesienia:** [ENGINE_PLAN.md](../ENGINE_PLAN.md) i [Gra 1 — Arena Defense Shooter](./GAME-1-arena-defense.md).

## Pitch

**Jeden mały poziom, trzech przeciwników i jedna broń — tak dopracowane, żeby pojedyncza wymiana ognia była ekscytująca także po dziesiątej próbie.**

Taktyczny FPS / „combat sandbox” w pomieszczeniach biurowych i korytarzach. Wróg reaguje na zachowanie gracza, podejmuje zespołowe decyzje i komunikuje swoje zamiary. Samo starcie zostawia widoczne i słyszalne ślady w otoczeniu. Celem jest *feeling F.E.A.R.*, bez aspiracji do skopiowania całej gry.

## Filary doświadczenia

1. **30 seconds of fun.** Frajda ze strzelania w pierwszych 30 sekundach, bez fabuły, ekwipunku, skilli, lootu czy progresji.
2. **Visuals > Graphics.** Wyraziste światło i cienie, pył, szkło, ślady trafień, czytelne animacje i kompozycja sceny. Wrażenie wygrywa z liczbą polygonów.
3. **AI jako widoczne zachowanie.** Gracz ma *zauważyć*, że żołnierze oskrzydlają, tłumią ogniem, korzystają z osłon i zmieniają plan — a nie tylko mieć zapewnienie, że działa „zaawansowana AI”.
4. **Świat reaguje na walkę.** Każdy strzał wywołuje adekwatny feedback: efekt materiału, drobna destrukcja, audio, animacja przeciwnika, ewentualnie fizyka.
5. **Audio is gameplay.** Kroki, okrzyki, komunikaty oddziału, pogłos i kierunek ognia informują o sytuacji.
6. **Performance > fidelity.** Stabilne klatki i frame pacing, skalowalne efekty, projekt w duchu mainstream/iGPU Phalanxa.

## Pierwszy vertical slice: „Jedna wymiana ognia”

### Scena

- Jeden nieduży poziom: biuro z korytarzem, kilkoma przejściami, osłonami i możliwością obejścia gracza z flanki.
- Jeden gracz (FPS), **jedna broń hitscan**, **trzech przeciwników** tworzących jeden oddział.
- Wnętrze projektowane **razem z AI**: punkty osłon i alternatywne ścieżki są warunkiem sensownych manewrów.
- Rozpoczęcie starcia natychmiast, restart jednym przyciskiem; brak menu progresji.

### Oczekiwane zachowania przeciwników

- Wykrywanie gracza: pole widzenia, line-of-sight, pamięć ostatniej znanej pozycji, sygnały dźwiękowe.
- Jeden przeciwnik prowadzi ogień z osłony, drugi próbuje flankować, trzeci wspiera lub zmienia osłonę.
- Po utracie członka oddziału pozostali reagują: zmiana taktyki, odwrót, utrzymanie pozycji.
- Proste, wiarygodne komunikaty radiowe ujawniają intencje, ale nie oszukują gracza.
- Zachowania mają być **testowalne, czytelne i wystarczająco deterministyczne** do debugowania.

### Feedback walki

- Recoil / animacja kamery, błysk wylotowy, smugi pocisków, animacja trafienia, odgłos broni o odpowiednim ciężarze.
- Różne ślady trafień na szkle, tynku i metalu; odłamki, kurz, iskry i krótkotrwały dym.
- Rozbijane wybrane obiekty (np. szyby, lampy, drobne wyposażenie); pełna dynamiczna destrukcja budynku **poza zakresem prototypu**.
- Oświetlenie i audio współpracują z efektami: rozbicie lampy może zmienić charakter miejsca.

## Szkic architektury — Phalanx

| Warstwa | Propozycja | Uwagi |
| --- | --- | --- |
| `PerceptionSystem` | LOS/raycast, FOV, słyszenie, ostatni kontakt | Dane świata, nie renderer |
| `SquadBlackboard` | Wspólna wiedza i role w oddziale | Bez telepatii: aktualizacja informacjami |
| `TacticalPlanner` | Mały **GOAP** lub ograniczony planner celów/akcji | Najpierw mierzymy zachowanie, potem komplikujemy algorytm |
| `CoverSystem` | Punkty osłon, ocena ekspozycji, zajętość | Ściśle współprojektowane z mapą |
| `Navigation` | Waypointy/graf przejść lub navmesh | Najpierw prosty poziom, bez rozbudowanego systemu ogólnego |
| `CombatFeedbackSystem` | Trafienia, materiały powierzchni, decal, cząsteczki, uszkodzenia | Rozdzielić gameplay od prezentacji |
| `AudioSystem` | Przestrzenne SFX, głosy oddziału, reakcja akustyki | Z czasem realistyczniejsza propagacja |
| `Physics` | Kolizje i wtórna fizyka wybranych obiektów | Rapier tylko tam, gdzie tworzy wartość |

Korzystać z już istniejących w Phalanxie podstaw: `GameLoop`, `InputSystem`, `AudioSystem`, `WeaponSystem`, `Health`, efektów trafień i warstwy renderującej. Obecny `EnemySystem` w Grze 1 opiera się na prostym podążaniu za graczem — **nie jest jeszcze taktycznym AI**.

## Kolejność prototypowania

| Etap | Co dowozimy | Kryterium akceptacji |
| --- | --- | --- |
| P0 — gunfeel | FPS movement, jedna broń, hit reactions, audio i restart | 30 sekund bez AI nadal daje satysfakcję |
| P1 — decyzje AI | Trzech wrogów, osłony, flankowanie, wspólna informacja | W kilku powtórkach obserwujemy różne, sensowne manewry |
| P2 — reaktywne otoczenie | Materiały trafień, pył, szkło, drobne obiekty, światło | Pomieszczenie po walce widocznie różni się od stanu przed |
| P3 — integracja | Audio przestrzenne, tempo i pacing starcia, profilowanie | Starcie zachowuje jakość przy docelowej wydajności |

**Nie rozpoczynać realizacji tego konceptu przed świadomą decyzją właściciela.** Obecny [Arena Defense Shooter](./GAME-1-plan.md) pozostaje aktywną Grą 1. Ten pomysł może zostać Grą 2 albo osobnym laboratorium systemów AI i reakcji świata. Reusable systems przenosić do engine'u dopiero po sprawdzeniu w grze.

## Poza zakresem na starcie

- Pełna kampania i scenariusz horroru, cinematici i voice acting na dużą skalę.
- Multiplayer, otwarty świat, rozbudowany inwentarz, craft, live service.
- Fotorealizm i kosztowne technologie renderingu dla nich samych.
- General-purpose AI framework lub fizyka/destrukcja wszystkich obiektów.
- Kopiowanie map, nazw, postaci, grafiki, dźwięków czy innych chronionych elementów F.E.A.R.

## Główne ryzyka i odpowiedzi

- **AI „sprytna na papierze”, ale głupia w grze:** testować zachowania na konkretnych układach osłon, logować zamiary, mierzyć sukces flanki.
- **Złożoność GOAP:** mały zestaw akcji i planów; FSM może okazać się lepsze na początku.
- **Zbyt wiele efektów cząsteczkowych:** pooling, limity decal/particle, stopniowa degradacja jakości na słabszym GPU.
- **Scope creep:** zawsze tylko jedna scena, jedna broń, trzech wrogów, dopóki wymiana ognia nie broni się sama.

## Pytanie otwarte

Czy to będzie **samodzielny FPS jako kolejna gra Phalanxa**, czy **techniczne laboratorium „FEAR-like encounter”** służące rozwojowi AI, audio i reaktywnego środowiska? Decyzję odłożyć do momentu, gdy aktywna Gra 1 będzie miała udokumentowany vertical slice.
