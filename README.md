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
| `src/data/chapters.ts` | contenu éditorial + pose du rig par chapitre |
| `src/data/models.ts` | fiche technique des appareils, offsets d'éclatement, annotations |
| `src/animation/sequence.ts` | la timeline scroll → rig (Anime.js `onScroll`) |
| `src/three/hologram/scene.ts` | renderer, caméra |
| `src/three/hologram/model.ts` | chargement du GLB → filaire + arêtes + sommets, registre de pièces |
| `src/three/hologram/materials.ts` | le shader de glow (réponse au balayage, shimmer, atténuation de profondeur) |
| `src/three/hologram/overlay.ts` | axes, cotes, indicateur de rotation, règle de balayage |
| `src/three/hologram/rig.ts` | `HologramRig` + `applyRig()` (une passe par frame) |
| `src/components/HologramStage.tsx` | canvas + annotations HTML projetées + HUD |

Le rendu est volontairement sans éclairage ni tone mapping : tout est ligne
blanche et point blanc, l'image est construite par l'épaisseur et l'opacité.

### Le shader de glow

Toutes les lignes et tous les points passent par `createGlowLineMaterial` /
`createGlowPointMaterial`. Le fragment shader ajoute, dans l'espace monde :

1. une **réponse au balayage** — ce qui est à moins de `uScanWidth` de la règle
   s'allume, le scan devient une onde qui traverse la cellule ;
2. un **shimmer** lent qui dérive le long du modèle pour que le filaire ne
   paraisse jamais figé ;
3. une **atténuation de profondeur** : la face cachée s'enfonce au lieu de
   concurrencer la silhouette proche.

C'est un effet de shading, pas un bloom plein écran : moins coûteux, et il
préserve le côté blueprint.

### Interaction

* **Clic sur une annotation** → la caméra vient cadrer la pièce (le rig
  interpole cible et distance, la timeline de scroll reprend la main dès que
  l'on scrolle) ;
* glisser/rouler → orbite et zoom pilotés par le scroll ;
* chaque chapitre remplace l'appareil, ses annotations et ses mécanismes
  (verrière, train, rotor, hélice, tourelle capteur, vue éclatée).

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

* **Apache** — les pales du rotor (`rotor`) : elles s'étendent loin en X et
  tombent vers leurs extrémités, donc le test combine distance à l'axe, hauteur
  et orientation des facettes (normale ≈ ±Y) pour ne pas emporter la dérive.
* **Rafale** — `radome`, `wing-left/right`, `fin`, `engines` : les coupes sont
  ordonnées, chacune retire sa région de ce qu'il reste de `airframe`
  (nez −Z, envergure X, dérive au-dessus du pont moteur).

Résultat : 15 pièces adressables sur le Rafale, 8 sur l'Apache, 39 sur le MQ-9.

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
* `tools/band-probe.mjs` : profil des triangles par tranche selon un axe
  (`node tools/band-probe.mjs public/models/rafale.glb airframe z`), pour
  régler une découpe par région.
