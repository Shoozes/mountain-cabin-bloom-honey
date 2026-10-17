import { createFileRoute } from "@tanstack/react-router";
import { ArtStudio } from "@/components/art-studio";

export const Route = createFileRoute("/studio")({
  head: () => ({ meta: [{ title: "Sprite Studio · Grout Shader" }] }),
  component: ArtStudio,
});
