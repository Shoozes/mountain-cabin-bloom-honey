import { createFileRoute } from "@tanstack/react-router";
import { TextureGallery } from "@/components/texture-gallery";

export const Route = createFileRoute("/gallery")({
  head: () => ({ meta: [{ title: "Texture gallery · Grout Shader" }] }),
  component: TextureGallery,
});
