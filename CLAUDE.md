# CLAUDE.md

Guía para trabajar en este repositorio con Claude Code.

## Qué es este proyecto

**FutMon World**: un RPG web de fútbol tipo *monster-catcher* (estilo Pokémon clásico) en español. Exploras un mundo de 48×48 casillas con cuatro regiones, encuentras futbolistas famosos en la hierba alta, los debilitas en duelos por turnos y los fichas con "balones contrato". Historia de 10 capítulos con un jefe final (el Entrenador Sombra).

Proyecto fan no oficial: sin fotografías ni escudos oficiales; los retratos son ilustraciones propias en `assets/portraits/`.

## Stack y filosofía

- **Vanilla JS + Canvas 2D + CSS. Sin dependencias, sin build, sin bundler, sin framework.** No añadas npm/node_modules: el juego debe seguir funcionando abriendo `index.html` directamente.
- Todo el texto de la interfaz está **en español**.
- Sin assets externos salvo los retratos `.webp`: los gráficos del mundo se dibujan por código en canvas y el audio se sintetiza con WebAudio.

## Ficheros

| Fichero | Contenido |
|---|---|
| `index.html` | Todas las vistas (título, entrenador, historia, final, mundo, batalla, paneles, diálogos, tienda). Solo estructura; nada de JS inline. |
| `app.js` | Todo el motor. Organizado en secciones comentadas: helpers → mapa → datos → estado → audio → vistas → render → movimiento → interacción → batalla → historia → paneles → entrada → arranque. |
| `styles.css` | Estilos por bloques, encabezados `/* ---------- */`. Variables en `:root`. |
| `assets/portraits/*.webp` | Un retrato por jugador; el nombre de fichero es el `id` del jugador en `STARS`. |
| `.github/workflows/pages.yml` | Publica en GitHub Pages en cada push a `main`. |

## Arquitectura de app.js

- **Mapa**: generado proceduralmente con un `noise()` determinista (mismo input → mismo mapa). Códigos de casilla documentados junto a `MAP`. `T` y `W` son intransitables.
- **Estado**: un único objeto `state` persistido en `localStorage` clave `futmon-world`. `load()` hace `{...DEFAULT, ...guardado}`, así que **añadir campos nuevos a `DEFAULT` es la forma de migrar saves antiguos**: nunca renombres ni cambies el significado de campos existentes sin migración.
- **Movimiento**: el jugador vive en casillas (`state.x/y`) pero se renderiza con interpolación en píxeles (`player.px/py`). Los eventos de casilla (encuentros, cofres, curación) ocurren en `onArrive()`.
- **Render**: bucle único `requestAnimationFrame(loop)`; solo dibuja cuando `#world-view` está activa. Cámara suave con `camera()`. La viñeta y el minimapa base están cacheados en canvas offscreen.
- **Batalla**: objeto global `battle` (o `null`). Flujo: `startEncounter()`/`startBossBattle()` → `beginBattle()` → `setupBattle()` → turnos `attack()`/`useDrink()`/`contract()` ↔ `rivalTurn()` → `endBattle()`. El candado de turno es `battle.busy`; guarda cada callback diferido con `if (!battle) return` porque el jugador puede huir.
- **Matemática del duelo**: triángulo de posiciones en `BEATS` (DEL>MED>DEF>DEL, ×1.3 / ×0.75; el POR resiste disparos). Probabilidad de fichaje en `captureChance()` — se muestra en vivo en el botón Fichar; si cambias la fórmula, la UI se actualiza sola.
- **Historia**: `CHAPTERS` (10 entradas) + `checkProgress()` (condiciones de avance por capítulo) + `advanceChapter()`. Las escenas no se muestran en mitad de un duelo o diálogo: se encolan en `pendingStory`/`pendingEnding` y las dispara `maybeShowStory()` al volver al mapa.
- **Audio**: `sfx(nombre)` sintetiza pitidos con WebAudio según las secuencias de `SFX`. Sin ficheros de sonido. Respeta `state.muted`.

## Cómo probar

No hay suite de tests. Verificación manual:

```bash
python3 -m http.server 8080   # o abrir index.html directamente
```

Smoke test recomendado con Playwright (Chromium): cargar la página, comprobar que no hay errores de consola, pulsar NUEVA PARTIDA → elegir entrenador → EMPEZAR → CONTINUAR y verificar que el canvas del mundo dibuja. Para forzar una batalla desde consola del navegador: `startEncounter()`. Para saltar capítulos: `state.chapter = N; save()` y recargar.

## Convenciones

- Mantén el juego **mobile-first**: controles táctiles superpuestos (media query `pointer:coarse`) y teclado en escritorio. Cualquier función nueva debe ser usable con ambos.
- Los `id` de jugadores/entrenadores son claves estables (saves, retratos): no los renombres.
- El canvas del mundo es 960×528 (20×11 casillas de 48px); si cambias `TILE`/`VIEW_*`, actualiza también el atributo del canvas en `index.html` y el tamaño de `vignette`.
- Al añadir jugadores a `STARS`: añade su retrato `.webp`, inclúyelo en algún pool de `ENCOUNTER_POOLS` y revisa los objetivos de capítulo que cuentan plantilla (`checkProgress`).

## Despliegue

Push a `main` ⇒ GitHub Actions publica en Pages automáticamente. No hay paso de build: se sube el repo tal cual (`.nojekyll` presente). El trabajo de features se hace en ramas `claude/*` y se fusiona vía PR.
