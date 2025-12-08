import { Header } from "@/components/header";
import BuyGctlView from "./view";
import { notFound } from "next/navigation";

export default function BuyGctlPage() {
  // return notFound();

  return (
    <>
      <Header withIsScrolled={true} />

      <BuyGctlView />
    </>
  );
}
