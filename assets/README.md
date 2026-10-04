# Wall Connector images

## `photos/`

Tesla's product photos of the Gen 3 Wall Connector, front on, one per faceplate, from Tesla's online
shop. They're the originals the card's images are made from.

| File | Faceplate | Tesla shop image |
|---|---|---|
| `white.jpg` | White (the standard glass faceplate) | Gen 3 Wall Connector (1529455-02-D) |
| `solid_black.jpg` | Solid Black | Wall Connector Colour Matched Faceplate (1551813-10-A) |
| `midnight_silver_metallic.jpg` | Midnight Silver Metallic | Wall Connector Colour Matched Faceplate (1551813-10-A) |
| `deep_blue_metallic.jpg` | Deep Blue Metallic | Wall Connector Colour Matched Faceplate (1551813-10-A) |
| `red_multi_coat.jpg` | Red Multi-Coat | Wall Connector Colour Matched Faceplate (1551813-10-A) |

The four colour-matched photos are framed identically. The white one is the same render at 0.778
scale about the centre of the frame.

## `faceplates/`

The cut-outs the card uses, made from `photos/` by `tools/make_faceplates.py`:

- `<faceplate>.webp`: handle docked, for when no car is plugged in
- `<faceplate>-in-use.webp`: handle out (in a car), with the faceplate's edge redrawn where the
  handle sat

Every cut-out has the light bar switched off: the lit bar and its glow are painted out and the
unlit light guide is drawn back as a faint hairline. The card lights the bar itself. All ten are
the same size and framing, so the card uses one set of positions for every faceplate.

To make them again (from the repository root):

```sh
pip install -r tools/requirements.txt
python tools/make_faceplates.py
python tools/build.py
```

These images are Tesla's and aren't covered by this repository's MIT licence.
