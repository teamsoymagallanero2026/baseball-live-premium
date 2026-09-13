BASEBALL LIVE PREMIUM — GUÍA RÁPIDA
===================================

QUÉ INCLUYE
-----------
- overlay.html  = pantalla que ve el público
- control.html  = panel privado para manejar el juego
- Firebase Realtime Database = sincronización entre PC y teléfono
- Firebase Authentication = protege los cambios del marcador
- Modo demo local = funciona sin Firebase en el mismo navegador para probar

FUNCIONES
---------
- Nombres de equipos
- Carreras, hits y errores
- Bolas, strikes y outs
- Alta / baja del inning
- Bases 1B, 2B, 3B
- Cambio automático al llegar a 3 outs
- 4 bolas = base por bolas
- 3 strikes = ponche
- Hit, doble, triple y home run con avance automático básico
- Botón Deshacer
- Animaciones HOME RUN, CARRERA, PONCHE, HIT, DOBLE, TRIPLE
- Diseño vertical y fondo transparente para usar como overlay

IMPORTANTE SOBRE LA AUTOMATIZACIÓN DE CORREDORES
-------------------------------------------------
El avance automático de corredores usa una lógica básica para ahorrar tiempo.
En una jugada real los corredores pueden avanzar distinto según la jugada.
Si eso ocurre, usa DESHACER o toca manualmente 1B / 2B / 3B.

PASO 1 — PROBAR SIN FIREBASE
-----------------------------
Si publicas los archivos tal como están, el proyecto entra en "DEMO LOCAL".
Overlay y Control se sincronizan si están abiertos en el mismo navegador/equipo.
Esto sirve para comprobar el diseño antes de configurar Firebase.

PASO 2 — CREAR FIREBASE
-----------------------
1. Entra a Firebase Console.
2. Crea un proyecto nuevo, por ejemplo: baseball-live-premium.
3. Dentro del proyecto, crea una APP WEB con el icono </>.
4. Firebase te mostrará un objeto llamado firebaseConfig.
5. Abre config.js de este proyecto y sustituye TODOS los valores PEGA_AQUI.
6. Asegúrate de incluir databaseURL.

PASO 3 — REALTIME DATABASE
--------------------------
1. Firebase Console > Build / Databases & Storage > Realtime Database.
2. Create Database.
3. Cuando esté creada, entra a Rules.
4. Copia exactamente el contenido de firebase-rules.json.
5. Publica las reglas.

Estas reglas dejan que el overlay LEA el marcador, pero solo un usuario
identificado puede ESCRIBIR cambios.

PASO 4 — CREAR TU USUARIO DE CONTROL
-------------------------------------
1. Firebase Console > Authentication.
2. Get started.
3. Sign-in method > Email/Password > Enable.
4. Ve a Users > Add user.
5. Crea un correo y contraseña SOLO para manejar el marcador.
6. No escribas esa contraseña en config.js ni en ningún archivo del proyecto.

PASO 5 — PUBLICAR GRATIS
------------------------
OPCIÓN VERCEL
1. Crea un repositorio nuevo en GitHub.
2. Sube TODOS los archivos de esta carpeta a la raíz del repositorio.
3. En Vercel, pulsa Add New > Project.
4. Importa el repositorio.
5. Framework Preset: Other.
6. Deploy.
7. Te dará una dirección parecida a:
   https://tu-proyecto.vercel.app

Tus páginas serán:
   https://tu-proyecto.vercel.app/overlay
   https://tu-proyecto.vercel.app/control

Si no usas las rutas limpias, también funcionan:
   /overlay.html
   /control.html

PASO 6 — PRUEBA EN DOS DISPOSITIVOS
------------------------------------
1. En la PC abre /overlay.
2. En el teléfono abre /control.
3. Entra con el usuario de Firebase.
4. Pulsa +1 carrera o BOLA.
5. Debe cambiar inmediatamente en el overlay.

PASO 7 — TIKTOK LIVE STUDIO
----------------------------
1. Crea tu escena vertical de 1080 x 1920.
2. Añade las cámaras / ventanas de los narradores arriba.
3. Añade una fuente de página web / URL / Link si tu versión la ofrece.
4. Usa la URL /overlay.
5. Coloca la fuente a 1080 x 1920.
6. El fondo del overlay es transparente.
7. Ajusta su posición para dejar libres los controles propios de TikTok.

Si tu versión de LIVE Studio no ofrece una fuente web/URL, puedes usar el
mismo overlay en un software compatible con fuente de navegador y llevar la
composición final a tu flujo de transmisión.

SEGURIDAD
---------
- NO dejes Realtime Database en Test Mode para una transmisión real.
- NO publiques tu contraseña.
- El firebaseConfig de una web se puede ver en el navegador; eso es normal.
  La protección real la hacen las reglas y Authentication.
- Si quieres cambiar quién controla el marcador, cambia o elimina el usuario
  desde Firebase Authentication.

ARCHIVOS QUE NORMALMENTE EDITARÁS
---------------------------------
- config.js: una sola vez, para conectar Firebase.
- control.html: normalmente NO hace falta tocarlo.
- overlay.css: solo si más adelante quieres cambiar colores/tamaños.

FIN
