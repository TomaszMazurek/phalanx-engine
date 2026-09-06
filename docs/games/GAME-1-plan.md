# Gra 1 — Arena Defense Shooter · plan wykonawczy (v1)

> Silnik: Phalanx · koncept: [GAME-1-arena-defense.md](./GAME-1-arena-defense.md) · plan główny: [../ENGINE_PLAN.md](../ENGINE_PLAN.md)
> Status: **PLAN** · proces: sprinty vertical-slice, każdy kończy się grywalnym artefaktem na żywym demo
> Filtry decyzji: [sześć filarów](../ENGINE_PLAN.md#filary-projektowe-phalanx) — zwłaszcza #1 (30 sekund) i #6 (gra hoduje silnik)

---

## Decyzje robocze (przyjęte na plan; veto właściciela przed Sprintem 0)

| # | Pytanie | Decyzja | Uzasadnienie |
| --- | --- | --- | --- |
| D1 | Czy AI przeciwnika buduje wieże w v1? | **NIE** — stała, predefiniowana obrona na połowie wroga | AI-budowniczy to osobny system (i osobna zabawa); v1 ma udowodnić core loop, nie symetrię TD |
| D2 | Ekonomia v1? | **Flat income na falę + bonus za kill**; koszty stałe; 2 wieże na klawiszach 1/2; zero menu sklepu | zero UI = zero tarcia; ekonomia jako decyzja "kiedy budować", nie "co kupować" |
| D3 | Wróg donosi rdzeń? | **Koniec rundy** (0:1). Analogicznie wygrana gracza (1:0). Restart jednym klawiszem (R) | v1 bez systemu punktowego; natychmiastowy rematch to część feelingu "odpalasz i jesteś w środku" |
| D4 | Mapa? | **Pełna symetria rotacyjna 180°** | fair + czytelna; asymetria to v2+ |

## Sprinty

Każdy sprint = grywalny build na demo (auto-deploy), bramki jak w fazach silnika (TDD, review przed commitem, tiering workerów). Sprint przechodzi dopiero, gdy **właściciel przegrał wygraną** — akceptacja czysto wizualna/gameplayowa.

### S0 — "30 sekund frajdy" (czysty shooter, ZERO TD/CTF)

**Cel: udowodnić filar #1 zanim powstanie cokolwiek innego.**

- Arena-blockout: kontrast, symetria rotacyjna, czytelne strefy (paleta frakcji od dnia 1: gracz cyan / wróg magenta — filar #3)
- Gracz: ruch (InputSystem+PlayerController — gotowe), **strzał hitscan**, FEEL: recoil kamera, muzzle flash, hit-marker, kill-flash
- **Audio proceduralne** (WebAudio: oscylatory/szum — zero assetów, zero plików; filar #4: strzał/hit/kill mówią graczowi wszystko)
- Wrogowie: runner, fale atakujące GRACZA (bez core), prosty health/damage
- Restart natychmiastowy (R), HUD: HP + fala + FPS (dev)
- **Bramka:** 30 s zabawy bez żadnej progresji — test golymsm okiem

Silnik zyskuje: **combat** (damage/health/hitscan), **wave spawner v0**, **AudioSystem (proceduralny)**, **juice utils** (screen-shake, hit-flash).

### S1 — "Buduj obronę" (warstwa TD)

**Cel: build zmienia przebieg fali.**

- Core gracza na arenie; runnerzy celują w **core** (pathing gridowy A* wokół blokad — budynki kształtują trasę, istota Defense Grid)
- Build: klawisze 1/2, ghost placement + grid-snap, koszt z ekonomii D2; 2 wieże: **turret** (dps) + **slow** (utility)
- Fale rosnące; leak = wróg dobija do core i **kradnie HP** (kradzież rdzeń-fizyczna w S2)
- Ghost/koszt/feedback audio-wizualny każdego builda

Silnik zyskuje: **grid/build system**, **A\* pathing** (grid, mały — flow-field fallback w ryzykach), **tower targeting**, **economy**.

### S2 — "Kradzież i pościg" (CTF — dusza konceptu)

**Cel: pełny core loop z konceptu.**

- Wróg: fale + moment "przełamania" → **carrier zabiera rdzeń i wraca do bazy** (zwolniony, drop-on-death); gracz odzyskuje przez zabicie carrierów
- Gracz może **kraść rdzeń wroga** (przebijając stałą obronę D1): niesiesz = zwolnienie, drop na śmierć, respawn wroga goni
- Round manager (FSM): intro → fale → breach → chase → wynik → **R = restart < 1 s**
- Muzyka: prosty proceduralny layer sterowany fazą rundy (filar #4, v1 = drone+intensywność)

Silnik zyskuje: **carrier/goal FSM**, **enemy AI manager**, **round manager**, **dynamic audio mix**.

### S3 — "Wernisaż" (polish v1)

- Balans (krzywe fal, koszty, TTK), tutorial 30 s (tekst na starcie: move/shoot/build/steal — 4 linie), kontrast/kolory final pass (filar #3)
- Performance pass: **60 fps na iGPU przy 30+ wrogach i 6 wieżach** (filar #5)
- Retro "co silnik zyskał" + tag `game-1-v1` + wpis na demo

## Mapowanie ewolucji: co Phalanx ma po Grze 1

combat (damage/hitscan/feel) · pathing (grid A*) · build system · tower AI · economy · wave/round manager (FSM) · procedural audio + mix · juice utils — **reusable dla każdej następnej gry** (filar #6).

## Ryzyka i światełka ostrzegawcze

1. **Pathing przy 30+ agentach:** grid mały + A* z cache per tick-kroku; fallback = flow-field (raz na falę). Światełko: spadki poniżej 60 fps przy pełnej fali.
2. **Feel bez assetów artystycznych:** wszystko proceduralne + materiały Fazy 3; jeśli S0 "nie czuje się" po 2 iteracjach balansu — STOP i rozmowa o mini-asset packu (nie wcześniej).
3. **Scope creep TD+CTF naraz:** twarda kolejność S0→S1→S2; nic z S2 nie wchodzi przed domknięciem S1.
4. **Dźwięk proceduralny brzmi tanio:** akceptowalne dla v1; próg minimalny = rozróżnialność (strzał ≠ hit ≠ build ≠ alarm).

## Definition of Done v1

- [ ] Core loop kompletny: move → shoot → build → react → chase → recover/capture → repeat
- [ ] Test 30 sekund: pierwsza fala wciąga bez tutorialu (poza 4 liniami startowymi)
- [ ] 60 fps na iGPU przy 30 wrogach + 6 wieżach (HUD FPS jako dowód)
- [ ] Restart rundy < 1 s; zero błędów konsoli po 3 pełnych rundach
- [ ] Demo live (auto-deploy), README z GIF-em/screenshotem
- [ ] Retro "co silnik zyskał" w GAME-1 + tag `game-1-v1`
