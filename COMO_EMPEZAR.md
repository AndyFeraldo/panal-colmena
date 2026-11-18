# Cómo pasar este paquete a Claude Code (paso a paso, sin saber programar)

## 1. Crea el repositorio en GitHub
1. Entra a github.com → botón **New** (nuevo repositorio).
2. Nombre: `cuadrante-torre` · Público (para que el jurado lo vea) · **sin** README (ya lo traemos).
3. Créalo y deja la página abierta.

## 2. Prepara la carpeta en tu computadora
1. Descomprime este ZIP en una carpeta, por ejemplo `Documentos/cuadrante-torre`.
2. Verifica que dentro estén `CLAUDE.md`, `README.md`, `docs/` y `public/`.

## 3. Abre Claude Code en esa carpeta
- Desde la app de escritorio de Claude (pestaña Code) eligiendo esa carpeta, **o** desde la terminal: `cd` a la carpeta y escribe `claude`.

## 4. Pega este primer mensaje en Claude Code
```
Lee CLAUDE.md y todos los archivos de docs/ antes de empezar. Vas a construir el simulador
web TORRE f. descrito ahí. Yo no sé programar: explícame en simple qué haces y
qué necesito hacer yo en cada paso.

1) Primero dame un resumen de lo que entendiste y el plan por fases, y espera mi OK.
2) Conecta esta carpeta con mi repositorio de GitHub: https://github.com/TU_USUARIO/cuadrante-torre
3) Ve fase por fase (sección 10 de CLAUDE.md). Al final de cada fase: build sin errores,
   tests en verde, commit y push, y dime qué puedo ver y dónde.
4) Configura GitHub Pages con GitHub Actions desde la fase 1 y dame el link público.
```
(Cambia `TU_USUARIO` por tu usuario de GitHub.)

## 5. Mientras avanza
- Abre el link de GitHub Pages después de cada fase y revisa en el celular y en la laptop.
- Si algo no te gusta, díselo en simple: "en la pantalla del HUB, las barras se ven muy chicas".
- Antes del Demo Day pídele: "Haz una revisión final con los criterios de aceptación de la sección 11 y corrige lo que falte."

## 6. Para el pitch
- Usa el **Modo demo** (3 min) mientras hablas.
- Ten abierta la pantalla **Comparador** para las preguntas del jurado.
