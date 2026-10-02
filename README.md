# Portfolio — Lucas Audoubert

Portfolio technique, noir et blanc, construit autour d'une **visualisation 3D
type hologramme d'ingénierie** : filaire blanc, cotes, axes, annotations et
balayage, pilotés par le scroll.

Full-stack · Cybersécurité · Intelligence artificielle.

---

## Le site

Une seule page, six chapitres plein écran. Le scroll pilote **une** timeline
Anime.js qui anime à la fois la caméra, l'attitude des appareils et leurs
mécanismes (verrière, train, rotor, hélice, tourelle, vue éclatée).

| Couche | Rôle |
| --- | --- |
| `src/data/chapters.ts` | contenu éditorial, pose du rig et jalons par chapitre |
| `src/data/models.ts` | fiche technique des appareils, offsets d'éclatement, annotations |
| `src/animation/sequence.ts` | la timeline scroll → rig (Anime.js `onScroll`) |
| `src/three/hologram/scene.ts` | renderer, caméra |
| `src/three/hologram/model.ts` | chargement du GLB → filaire + arêtes + sommets, registre de pièces |
| `src/three/hologram/materials.ts` | le shader de glow (révélation, balayage, shimmer, profondeur, isolement au focus) |
| `src/three/hologram/overlay.ts` | axes, cotes, indicateur de rotation, règle de balayage |
| `src/three/hologram/rig.ts` | `HologramRig` + `applyRig()` (une passe par frame) |
| `src/components/HologramStage.tsx` | canvas, callouts (lignes de rappel SVG + puces cliquables), boîte de visée |
| `src/components/Hud.tsx` | HUD : cap, vitesse, lecture système, données cible, horloge UTC |
| `src/components/ScrollRail.tsx` | ruban de positions (navigation entre sections) |
| `src/components/ChapterBlock.tsx` | panneau sticky : projets, compétences, chronologie du parcours |

**Un appareil par chapitre, jamais deux à l'écran.** Le hero et « Full-stack »
montrent le Rafale, la cybersécurité le MQ-9, l'IA l'Apache ; le parcours est un
plan de vol sans appareil et le contact referme sur le Rafale. Chaque dossier
fait 2,6 écrans et son panneau reste fixe pendant trois temps : l'appareil
arrive **entier**, **explose** au scroll, puis les **callouts** (nom de pièce
relié par une ligne de rappel) se tracent un par un. Au changement d'appareil,
le sortant est effacé par la coupe de révélation avant que le suivant ne
s'« imprime » de bas en haut (`sequence.ts`, hand-off).

Le rendu est volontairement sans éclairage ni tone mapping : tout est ligne
blanche et point blanc, l'image est construite par l'épaisseur et l'opacité.

### Le carrousel de stack

`src/components/StackCarousel.tsx` : deux rangées qui défilent en sens
opposés, alimentées par `src/data/stack.ts` (icônes SVG dans `public/stack`,
copiées depuis un pack devicon). Chaque icône est posée sur une pastille et
reste désaturée au repos — un mur de couleurs de marque se battrait avec la
palette — puis reprend sa couleur au survol. L'animation est en CSS pur
(marquee dupliqué translaté de -50 %), donc elle ne coûte rien pendant le
scroll et s'arrête en `prefers-reduced-motion`. La section « 05 · Stack
technique » n'a pas de maquette 3D, comme « 04 · Parcours ».

### Le contenu

Portfolio professionnel : parcours, projets professionnels et académiques,
compétences, stack. Les maquettes sont des objets d'étude 3D et **leurs
annotations nomment des compétences et des outils** (API & services, RAG,
durcissement, CI/CD…), pas des pièces d'avion : la vue éclatée est une carte de
la façon dont le travail est assemblé. Les sections « Parcours » et « Stack »
n'ont pas de maquette — l'une a sa chronologie, l'autre son carrousel.

### Le shader de glow

Toutes les lignes et tous les points passent par `createGlowLineMaterial` /
`createGlowPointMaterial`. Le fragment shader ajoute, dans l'espace monde :

1. une **coupe de révélation** (`uCutY`) — au-dessus, rien n'est dessiné ; un
   liseré lumineux suit la coupe. C'est ce qui imprime / efface un appareil ;
2. une **réponse au balayage** — ce qui est à moins de `uScanWidth` de la règle
   s'allume, le scan devient une onde qui traverse la cellule ;
3. un **shimmer** lent qui dérive le long du modèle pour que le filaire ne
   paraisse jamais figé ;
4. une **atténuation de profondeur** : la face cachée s'enfonce au lieu de
   concurrencer la silhouette proche.

Le fondu passe par l'uniform `uOpacity` : un `ShaderMaterial` ignore
`material.opacity` — une version antérieure écrivait `.opacity` et les
transitions entre appareils ne se voyaient donc pas.

C'est un effet de shading, pas un bloom plein écran : moins coûteux, et il
préserve le côté blueprint.

### Typographie

Inter Variable et JetBrains Mono Variable sont **auto-hébergées**
(`@fontsource-variable`) : la pile déclarait `Inter` mais ne chargeait rien, le
site tombait donc sur la police système. Le texte est posé sur un panneau
opaque (`.panel`) pour rester lisible quelle que soit la densité du filaire.

### Interaction

* **Clic sur un callout** → la caméra vient cadrer la pièce (`CAMERA CADRÉE`
  dans le HUD) ; le
  décalage latéral suit la distance, la pièce reste donc dans la zone libre à
  côté du texte. La timeline de scroll reprend la main dès que l'on scrolle ;
* `<main>` est en `pointer-events: none` (seuls les panneaux réactivent les
  événements) : sans ça, il recouvrait la scène et avalait les clics ;
* les callouts évitent le panneau, les bandes du HUD et le bloc `TGT DATA` ;
  en dessous de 1180 px de large, seule la boîte de visée est affichée ;
* **mobile** : les panneaux des dossiers défilent normalement en haut de la
  section puis laissent l'écran à la vue éclatée (un panneau sticky plus haut
  que l'écran était coupé) ; le hero et le contact gardent leur panneau en bas,
  l'appareil est alors remonté (`mobileLift`).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint
```

## Les modèles 3D

Les sources brutes (Sketchfab, `.glb`/`.obj`, plusieurs Mo) ne sont **pas**
versionnées. `npm run models` les retouche en GLB compacts et canoniques,
versionnés dans `public/models` car ils partent en production.

```bash
npm run models            # écrit public/models/*.glb
npm run models -- --report  # statistiques seulement
```

| Modèle | Tris | Taille | Résultat |
| --- | --- | --- | --- |
| Rafale M | 40 794 → 23 989 | 6,16 Mo → 178 Ko | `public/models/rafale.glb` |
| AH-64D Apache | 21 882 | 3,38 Mo → 86 Ko | `public/models/apache.glb` |
| MQ-9 Reaper | 51 996 → 27 684 | 3,67 Mo → 129 Ko | `public/models/mq9.glb` |

Ce que fait le pipeline (`tools/optimize-models.mjs`) :

1. supprime textures et matériaux — un filaire n'a pas de surface ;
2. nomme les pièces (`airframe`, `rotor`, `canopy`, `flap-l1`…) ;
3. cuit les transformations dans les sommets et aplatit la hiérarchie ;
4. soude, déduplique et simplifie jusqu'au budget de triangles ;
5. normalise le repère : **nez −Z, haut +Y, envergure X, 10 unités, centré** ;
6. découpe les pièces que le runtime anime mais qui étaient soudées au
   fuselage (les pales du rotor de l'Apache) ;
7. ne garde que `POSITION` + indices, quantifiés 14 bits et compressés meshopt.

Les sources attendues dans `assets/models-src/` :

```text
dassault_rafale_m_-_fighter_jet_-_free.glb
boeing_ah-64d_apache_combat_helicopter.glb
MQ-9.obj
```

### Découpe des sous-ensembles

Deux appareils arrivent avec des pièces soudées dans un seul mesh ; le pipeline
les découpe par région, dans le repère canonique, pour que la vue éclatée
puisse les adresser :

* **Apache** — les **quatre** pales du rotor (`rotor`) : la paire latérale
  s'étend loin en X et tombe vers ses extrémités (test combinant distance à
  l'axe, hauteur et normale ≈ ±Y), la paire avant/arrière vit dans une bande
  fine au-dessus du fuselage ; le rotor anticouple (`tail-rotor`, à gauche de la
  dérive) ; et un matériau qui mélangeait trois ensembles est redécoupé en
  `mast-radar`, `cockpit` et `launchers`.
* **MQ-9** — repère source corrigé (nez −X, pas +Z) ; le pivot de l'hélice est
  le centre du moyeu (pas la boîte des pales, asymétrique à trois pales) et
  seule la boule de la tourelle tourne, pas son support.
* **Rafale** — `radome`, `wing-left/right`, `fin`, `engines` : les coupes sont
  ordonnées, chacune retire sa région de ce qu'il reste de `airframe`
  (nez −Z, envergure X, dérive au-dessus du pont moteur).

Résultat : 15 pièces adressables sur le Rafale, 11 sur l'Apache, 39 sur le MQ-9.

## Outils de développement

```bash
npm run dev            # puis http://localhost:5173/inspector.html
npm run shot -- --url "http://localhost:5173/inspector.html?model=rafale.glb&view=paint" --out tools/shots/rafale.png
```

* `inspector.html` + `tools/inspector/main.ts` : charge un GLB brut ou retouché,
  colore chaque pièce, affiche ses bornes et son nombre de triangles
  (`view=paint|wire|solid`, `show=`, `hide=`, `az=`, `el=`, `dist=`).
* `tools/shoot.mjs` : capture d'écran headless via le Edge installé
  (`--scroll` pour se placer dans la page, `--click` + `--evalclick` pour
  déclencher une annotation).
* `tools/probe-scroll.mjs` : relève les valeurs du rig à plusieurs positions de
  scroll, pour vérifier les timings de pose au lieu de les estimer à l'œil
  (le rig est exposé en dev sur `window.__hologram`).
* `tools/band-probe.mjs` : profil des triangles par tranche selon un axe
  (`node tools/band-probe.mjs public/models/rafale.glb airframe z`), pour
  régler une découpe par région.
