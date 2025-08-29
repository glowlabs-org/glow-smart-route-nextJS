import * as React from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function TosDialog() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [hasAccepted, setHasAccepted] = React.useState(false);
  const [isSigning, setIsSigning] = React.useState(false);

  React.useEffect(() => {
    if (!isConnected || !address) {
      setIsInitialized(true);
      setIsOpen(false);
      return;
    }

    // Check localStorage after component mount to avoid SSR issues
    let mounted = true;

    const checkTosAcceptance = () => {
      if (!mounted) return;

      try {
        const key = `tos_ack_${address.toLowerCase()}`;
        const ack = window.localStorage.getItem(key);
        const accepted = ack === "1";

        if (!accepted && mounted) {
          setIsOpen(true);
          setHasAccepted(false);
        } else {
          setIsOpen(false);
          setHasAccepted(true);
        }
      } catch (error) {
        console.error("Error checking ToS acceptance:", error);
        // On error, show the dialog to be safe
        if (mounted) {
          setIsOpen(true);
          setHasAccepted(false);
        }
      } finally {
        if (mounted) {
          setIsInitialized(true);
        }
      }
    };

    // Use a small delay to ensure stable mounting
    const timer = setTimeout(checkTosAcceptance, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [isConnected, address]);

  const handleAcceptTos = async () => {
    if (!address) return;

    setIsSigning(true);

    try {
      // Create message with ToS acceptance and timestamp
      const timestamp = new Date().toISOString();
      const message = `I accept the Glow Terms of Service at app.glow.org

By signing this message, I (${address}) confirm that I have read, understood, and agree to be bound by the Terms of Service.

Date: ${timestamp}
Application: app.glow.org
Version: ToS v1.0

This signature serves as my digital acknowledgment and acceptance of the terms.`;

      // Request signature from wallet
      const signature = await signMessageAsync({
        message,
      });

      // Save acceptance with signature proof
      const acceptanceData = {
        signature,
        timestamp,
        address: address.toLowerCase(),
        message,
      };

      window.localStorage.setItem(`tos_ack_${address.toLowerCase()}`, "1");
      window.localStorage.setItem(
        `tos_sig_${address.toLowerCase()}`,
        JSON.stringify(acceptanceData)
      );

      setHasAccepted(true);
      setIsOpen(false);
      toast.success("Terms of Service accepted successfully");
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes("User rejected") ||
          error.message.includes("User denied")
        ) {
          toast.error(
            "You must sign the message to accept the Terms of Service"
          );
        } else {
          toast.error("Failed to sign Terms of Service. Please try again.");
        }
      }
      console.error("Error signing ToS:", error);
    } finally {
      setIsSigning(false);
    }
  };

  const handleDecline = () => {
    disconnect();
    setIsOpen(false);
    try {
      disconnect();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  // Don't render until initialized to prevent flash
  if (!isInitialized) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={() => {
        // Completely prevent any closing via onOpenChange
        // Dialog can only be closed via Accept or Decline buttons
        return;
      }}
    >
      <DialogContent
        className="max-w-3xl max-h-[90vh] p-0 z-[100]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl font-semibold">
            Terms of Service
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] px-6">
          <div className="space-y-6 py-4 text-sm">
            <div>
              <h3 className="font-semibold text-base mb-2">
                1. Acceptance of Terms
              </h3>
              <p className="text-muted-foreground mb-3">
                By connecting your digital wallet to this Application (
                <strong>app.glow.org</strong>), you (<strong>{address}</strong>)
                explicitly agree to these Terms of Service. If you do not agree,
                do not use the Application.
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium">Eligibility:</span> By using the
                Application, you represent and warrant that you are at least 18
                years of age, or the age of legal majority in your jurisdiction
                (if higher), and possess the legal authority to agree to these
                Terms and use the Application lawfully.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-base mb-2">
                2. User Responsibility
              </h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>
                  The User is solely responsible for their interactions with the
                  Application, including all associated smart contracts and
                  blockchain transactions.
                </li>
                <li>
                  Users acknowledge the inherent risks in blockchain technology,
                  including but not limited to financial loss, smart contract
                  vulnerabilities, network disruptions, and regulatory risks.
                </li>
              </ul>

              <p className="text-muted-foreground mt-3">
                <span className="font-medium">Privacy Acknowledgment:</span> The
                Application does not intentionally collect personal data.
                However, blockchain transactions inherently expose certain
                transaction-related information publicly, including blockchain
                addresses and associated metadata. By using the Application,
                Users acknowledge and accept this inherent blockchain
                transparency.
              </p>

              <p className="text-muted-foreground mt-3">
                <span className="font-medium">Prohibited Activities:</span>{" "}
                Users expressly agree not to engage in any unlawful or
                prohibited activities, including fraud, money laundering, market
                manipulation, sanction evasion, or any activity otherwise
                prohibited by applicable law or regulations when using the
                Application.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-base mb-2">
                3. No Liability & Warranty Disclaimer
              </h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>
                  The Application and associated smart contracts are provided on
                  an "as-is" basis.
                </li>
                <li>
                  The Company explicitly disclaims any responsibility for
                  direct, indirect, incidental, special, consequential, or
                  exemplary damages, including financial loss, arising from or
                  relating to the use of the Application.
                </li>
                <li>
                  The Company makes no warranties, express or implied, regarding
                  the reliability, accuracy, completeness, or functionality of
                  the Application or associated smart contracts.
                </li>
              </ul>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-base mb-2">
                4. Regulatory Compliance
              </h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>
                  Users confirm they are not using the Application from any
                  jurisdiction where its use is prohibited or restricted.
                </li>
                <li>
                  It is the User's responsibility to comply with applicable
                  local laws and regulations.
                </li>
              </ul>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-base mb-2">
                5. Indemnification
              </h3>
              <p className="text-muted-foreground">
                Users agree to indemnify and hold harmless the Company and its
                affiliates, officers, employees, and representatives from and
                against all claims, liabilities, damages, losses, or expenses
                arising from their use of the Application.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-base mb-2">
                6. No Custody of Blockchain Assets
              </h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>
                  The Application does not have custody, possession, or control
                  over the User's blockchain assets at any time.
                </li>
                <li>
                  Users interact directly with smart contracts and retain full
                  control over their private keys and blockchain assets.
                </li>
              </ul>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-base mb-2">
                7. Modification of Terms
              </h3>
              <p className="text-muted-foreground">
                The Company reserves the right to modify these Terms at any
                time. Updates will be posted publicly on the Application at{" "}
                <a
                  href="https://app.glow.org/tos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  app.glow.org/tos
                </a>
                , and Users bear the responsibility to periodically review these
                Terms. Continued use after changes constitutes acceptance.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-base mb-2">
                8. Intellectual Property
              </h3>
              <p className="text-muted-foreground mb-3">
                All intellectual property associated with the Application,
                including trademarks and copyrights, remains the property of the
                Company.
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium">User Submissions:</span> Any
                feedback, suggestions, or submissions provided by Users related
                to the Application shall be deemed non-confidential. Users
                hereby grant the Company a perpetual, irrevocable, worldwide,
                royalty-free, and unrestricted right to use, incorporate, or
                otherwise exploit such submissions without restriction or
                compensation.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-base mb-2">
                9. Arbitration and Dispute Resolution
              </h3>
              <p className="text-muted-foreground">
                Any dispute arising out of or in connection with these Terms or
                your use of the Application shall be referred to and finally
                resolved by arbitration administered by the Cayman International
                Arbitration Centre (CIAC) in accordance with the CIAC
                Arbitration Rules in force at the time of arbitration. The seat
                of arbitration shall be George Town, Cayman Islands. The
                arbitration proceedings shall be conducted in English. The
                arbitration tribunal's decision shall be final and binding upon
                all parties.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-base mb-2">
                10. Governing Law and Jurisdiction
              </h3>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance
                with the laws of the Cayman Islands, without regard to conflicts
                of law principles. Users agree to submit to the exclusive
                jurisdiction of the courts located in George Town, Cayman
                Islands, for purposes of enforcing arbitration decisions or
                addressing claims not subject to arbitration.
              </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-base mb-2">
                11. Risk Acknowledgment
              </h3>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>
                  Users acknowledge and agree they fully understand the risks
                  associated with blockchain technology and related activities.
                </li>
                <li>
                  Users are encouraged to perform independent research before
                  engaging in any transactions on the Application.
                </li>
              </ul>
            </div>

            <div className="pt-4 pb-2">
              <p className="text-muted-foreground font-medium">
                By proceeding, Users acknowledge they have read, understood, and
                accepted these Terms of Service.
              </p>
              <p className="text-muted-foreground mt-2">
                These Terms of Service can be found at{" "}
                <a
                  href="https://app.glow.org/tos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  app.glow.org/tos
                </a>
                .
              </p>
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>⚠️ Digital Signature Required:</strong> By clicking
                  "Sign & Accept", you will be prompted to sign a message with
                  your wallet. This signature serves as your legally binding
                  acceptance of these Terms of Service.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-4 gap-2 border-t">
          <Button
            variant="outline"
            onClick={handleDecline}
            disabled={isSigning}
          >
            Decline & Disconnect
          </Button>
          <Button onClick={handleAcceptTos} disabled={isSigning}>
            {isSigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing...
              </>
            ) : (
              "Sign & Accept"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
