# Images

This folder is empty on purpose. The site currently renders labelled
placeholder blocks wherever a photograph will go.

## Adding a real photo

1. Drop the file in this folder, e.g. `public/images/outdoor-sauna-hero.jpg`
2. Open the relevant file and add a `src`:

```yaml
heroImage:
  src: "/images/outdoor-sauna-hero.jpg"     # <- add this line
  alt: "Outdoor sauna cabin at dusk"
```

The placeholder disappears automatically. Nothing else changes.

## Art direction

Every placeholder on the site carries a `note` describing the shot it is
standing in for. Those notes are the brief — hand them to a photographer.

## Practical notes

- Export at roughly 2000px on the long edge; larger is wasted.
- Use `.webp` where you can, `.jpg` otherwise.
- Keep the treatment consistent across a row of cards. Mixed lighting and
  crops are the fastest way to make a premium site look assembled.
- **Only use images you own or have licensed.** Do not lift photography from
  manufacturer or competitor sites.
