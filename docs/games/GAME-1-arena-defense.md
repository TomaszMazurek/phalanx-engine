# Gra 1 — Arena Defense Shooter (koncept roboczy)

> Silnik: Phalanx · nadrzędny plan: [ENGINE_PLAN.md](../ENGINE_PLAN.md)
> Status: **KONCEPT ROBOCZY** (właściciel, 2026-09-06) · pierwsza gra napędzająca ewolucję silnika
> Zasady nadrzędne: [30-seconds-of-fun](../ENGINE_PLAN.md#zasada-nadrzędna-gry-na-phalanx) · [silnik rośnie przez gry](../ENGINE_PLAN.md#zasada-ewolucji-silnik-rośnie-przez-gry)

## Pitch (jedno zdanie)

**A fast sci-fi arena shooter where you build the battlefield, defend your core,
and steal the enemy's.**

## Gatunek (roboczo)

**Arena Defense Shooter** / Objective Defense Shooter — arena shooter (UT/DOOM)
+ tower defense (Defense Grid) + CTF (kradzież rdzenia z pościgiem).

## Najważniejsze założenie

**Pierwsze 30 sekund musi dawać frajdę bez progresji, fabuły i unlocków.**
Odpalasz i po chwili jesteś w środku. Feel broni niesie grę (szkoła Doom/Halo).

## Core loop

```
move → shoot → build → react → chase → recover/capture → repeat
```

Kluczowa innowacja vs klasyczne TD: przełamanie obrony NIE kończy rundy —
wróg nosi skradziony rdzeń (zwolniony, upuszcza go po śmierci), więc zaczyna się
pościg i odzyskanie. "Przeciek" to zmiana fazy, nie porażka.

## V1 — celowo prymitywna (vertical slice)

| Element | V1 |
| --- | --- |
| Areny | **jedna**, symetryczna |
| Broń | **jedna główna** (feeling = priorytet #1) |
| Wieże | **1–2 typy** |
| Przeciwnicy | **jeden typ** (runner: biegnie po rdzeń, łapie, wraca) |
| Rdzenie | **jeden** na stronę |
| Fale | proste, rosnące |
| Respawn / restart | natychmiastowy restart rundy |
| Warunek zwycięstwa | pierwszy skradziony i doniesiony rdzeń |

## Później (kolejka, NIE v1)

Rasy (różne style budowania) · więcej broni · mapa wielopoziomowa ·
jump pady / teleportery · zaawansowany pathing (flow fields) ·
muzyka reagująca na fazę walki · nowe tryby.

## Czym ta gra NIE jest (non-goals)

Nie RTS. Nie looter shooter. Nie gra-usługa. Nie „indie AAA".
**Czymś, co odpalasz i po chwili jesteś w środku.**

## Co gra wymusza na silniku (mapowanie ewolucji)

| System gry | Systemy silnika | Faza/nowe |
| --- | --- | --- |
| move/shoot | InputSystem (gotowe), PlayerController (rozszerzyć), **hitscan/projectiles**, damage/health | nowe |
| build | **placement** (ghost, grid-snap, raycast), **ekonomia** (energy), build-UI | nowe |
| react (fale) | **wave spawner**, prosty steering/pathing runnerów | nowe |
| chase/recover | **carrier state** (slow, drop-on-death), stany rundy | nowe |
| feel/juice | **audio wrapper (WebAudio, procedural?)**, hit-flash, camera shake | F6 wciągnięta do przodu |
| UI | HUD gry + build menu | F6 wciągnięta do przodu |
| fizyka (Rapier) | **NIE potrzebna w v1** (ruch kinematyczny, raycast wbudowany w three) | F4 odkładana/ względem gry |
| zapis | niepotrzebny w v1 (natychmiastowy restart) | później |

Wniosek strategiczny: Gra 1 **przemeblowuje Fazę 4+** — pełna fizyka (Rapier)
schodzi na "gdy gra jej wymaga", UI+audio wjeżdżają do przodu. Scope faz dogada gra.

## Otwarte pytania projektowe (do rozstrzygnięcia przed prototypem)

1. Asymetria obrony: czy AI przeciwnika BUDUJE wieże w v1, czy ma stałą obronę?
   (rekomendacja: v1 = stała prosta obrona, AI buduje od v2)
2. Ekonomia v1: flat income na falę + bonus za kill? (rekomendacja: tak, zero menu)
3. Carrier: jak bardzo zwolniony, co gdy dojdzie do bazy — koniec rundy czy punkt?
   (v1: koniec rundy, wynik 1:0)
4. Mapa: pełna symetria lustrzana (fair) czy lekka asymetria (charakter)?
   (v1: lustrzana)
