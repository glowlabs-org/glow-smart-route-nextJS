import TestView from "./view";
import { notFound } from "next/navigation";

export default function TestPage() {
  return notFound();
  return <TestView />;
}
