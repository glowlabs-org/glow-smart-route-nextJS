import { permanentRedirect } from "next/navigation";

export default function DeprecatedLaunchpadPage() {
  permanentRedirect("/");
}
