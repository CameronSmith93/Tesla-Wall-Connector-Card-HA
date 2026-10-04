# Wall Connector images

## `photos/`

Tesla's product photos of the Gen 3 Wall Connector, front on, one per faceplate, from Tesla's online
shop. They're the originals the card's images are made from.

| File | Faceplate | Tesla shop image |
|---|---|---|
| `white.jpg` | White (the standard glass faceplate) | Universal Wall Connector (1734412-02-E) |
| `solid_black.jpg` | Solid Black | Wall Connector Colour Matched Faceplate (1551813-10-A) |
| `midnight_silver_metallic.jpg` | Midnight Silver Metallic | Wall Connector Colour Matched Faceplate (1551813-10-A) |
| `deep_blue_metallic.jpg` | Deep Blue Metallic | Wall Connector Colour Matched Faceplate (1551813-10-A) |
| `red_multi_coat.jpg` | Red Multi-Coat | Wall Connector Colour Matched Faceplate (1551813-10-A) |

The white photo is of the Universal Wall Connector, which has the same body and glass faceplate as
the Gen 3 and the same slim handle as the colour-matched photos. (The Gen 3 photo of the white
faceplate has a chunkier Type 2 handle, which wouldn't match the others.)

The four colour-matched photos are framed identically. The white one is framed a little
differently, and white glass on a white background has almost no edge to cut along, so its outline
is the colour photos' outline mapped into its frame (fitted to the white photo's own edges to about
a pixel), while its handle and cables are cut from the white photo itself. The badges at the right
of the white photo fall outside the crop.

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
