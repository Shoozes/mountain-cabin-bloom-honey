import { createFileRoute } from "@tanstack/react-router";
import { ArtExamples } from "@/components/art-examples";

export const Route = createFileRoute("/examples")({
  head: () => ({ meta: [{ title: "Art examples · Grout Shader" }] }),
  component: ArtExamples,
});
