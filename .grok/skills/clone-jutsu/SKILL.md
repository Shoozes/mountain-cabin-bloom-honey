# Clone jutsu

Use this when a catalog shader should match an imagined seamless tile, not when inventing a new material from scratch.

## Steps

1. Keep one square reference per material in `public/judge/<id>.jpg`. If the existing photo is the wrong material, generate a new one and point `JUDGE_REFS` at it. Do not score slate against rubble.
2. Sample the reference mean and the 10th / 50th / 90th percentile colors. Put the four palette stops inside that band. The hyper-real finish multiplies by about 0.96, so aim the shader a little lighter than the photo mean.
3. Copy the reference's structure with tileable helpers only: `N`, `FBM`, `worley`, `wrap2`, `brickUv`, `face`. Frequencies stay integer multiples of `SC()`. No raw `floor()` color blocks that meet a different color at the tile edge.
4. Keep the style's name honest. Granite stays speckled. Slate stays stacked sheets. Water stays ripples.
5. Run Judge. A pass is seam at or under 0.16 and match at or above 0.58.
