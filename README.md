# Libre Translate Page

Extension **Firefox** qui traduit une page web entière en utilisant **votre propre
serveur [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate)** —
sans Google, sans clé API externe, sans tracking.

Inspirée de [TWP – Translate Web Pages](https://github.com/FilipePS/Traduzir-paginas-web)
(service Google remplacé par LibreTranslate).

## Fonctionnalités

- 🌐 **Traduction de la page complète** : tous les nœuds de texte sont traduits
  par lots (25 textes par requête) vers votre serveur LibreTranslate.
- 🔤 **Détection automatique** de la langue source (route `/detect`), ou
  langue source fixe.
- 💬 **Bandeau de suggestion** : quand une page est dans une langue étrangère
  (différente de la langue cible), un bandeau propose de la traduire en un clic.
  Désactivable via le ✕ du bandeau ou le toggle dans le popup / les options.
- ↩︎ **Restauration de l'original** en un clic (recharge la page).
- ⚡ **Indicateur de progression** : le badge de l'icône affiche le pourcentage
  de traduction en cours, puis une ✓ verte quand la page est traduite.
- ⚙️ **Serveur configurable** : URL + clé API (optionnelle), langues par défaut.
- 🌗 Mode clair/sombre automatique dans le popup.

## Prérequis

Un serveur LibreTranslate en fonctionnement, par exemple :

```bash
docker run -p 5000:5000 libretranslate/libretranslate:latest
```

Ou une installation locale : `pip install libretranslate` puis `libretranslate-server`.

## Installation (développement)

1. Ouvrir Firefox → `about:debugging#/runtime/this-firefox`
2. « Charger un module complémentaire temporaire… »
3. Sélectionner le fichier `manifest.json` de ce dépôt.

L'extension reste active jusqu'à redémarrage de Firefox (mode temporaire).

## Utilisation

1. Cliquer sur l'icône de l'extension.
2. Saisir l'URL de votre serveur LibreTranslate (défaut : `http://localhost:5000`).
3. Choisir les langues (source : *Auto* par défaut, cible : *fr*).
4. Cliquer **🌐 Traduire la page**.
5. **↩︎ Restaurer l'original** recharge la page non traduite.

> Note : si le popup signale « Serveur injoignable », vérifiez que le serveur est
> accessible depuis Firefox (CORS activé côté serveur si besoin, ou proxifiez-le).

## Structure

```
manifest.json          # manifest MV2 (Firefox)
background.js          # appels API LibreTranslate, injection des scripts
content/translate.js   # parcourt la page, traduit par lots
content/restore.js     # restaure l'original (recharge)
content/banner.js      # bandeau de suggestion sur page en langue étrangère
popup/                 # popup : serveur, langues, traduire/restaurer
options/               # page d'options
icons/                 # icônes (SVG sources + PNG)
```

## API LibreTranslate utilisée

| Route        | Usage                              |
|--------------|------------------------------------|
| `POST /translate` | traduction d'un lot de textes |
| `POST /detect`   | détection de la langue source   |
| `GET  /languages`| liste des langues disponibles     |

## Limites connues

- Les textes dans `<code>`, `<pre>`, `<textarea>`, `<svg>` etc. ne sont pas traduits.
- La restauration repose sur un rechargement de la page (les contenus dynamiques
  générés par JavaScript sont rechargés tels quels).
- Les pages protégées (`about:`, `addons.mozilla.org`, PDF…) ne sont pas injectables.

## Licence

[GPL v3](LICENSE)
