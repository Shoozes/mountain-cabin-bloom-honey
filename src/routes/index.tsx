import { createFileRoute } from "@tanstack/react-router";
import { MillApp } from "@/components/mill-app";

export const Route = createFileRoute("/")({
  component: MillApp,
});
