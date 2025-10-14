import { Header } from "@/components/header";
import StatsView from "./view";

export default function StatsPage() {
  return (
    <>
      <Header withIsScrolled={true} />
      <StatsView />
    </>
  );
}
