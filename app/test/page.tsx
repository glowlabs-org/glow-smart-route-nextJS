import ClaimsTestView from "./claims-test-view";
import TestView from "./view";
import { notFound } from "next/navigation";

export default function TestPage() {
  // return notFound();
  return <ClaimsTestView />;
}
