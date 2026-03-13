import { describe, expect, it } from "vitest";
import {
  initializeTransactionSteps,
  updateTransactionStepStatus,
} from "../deposit-dialog-utils";

describe("updateTransactionStepStatus", () => {
  it("activates indexing only after the funding step completes", () => {
    const initialSteps = initializeTransactionSteps("SGCTL", "USDC", {
      sgctlSource: "mint_usdc",
    });

    const funding = updateTransactionStepStatus(
      initialSteps,
      "MINT_AND_STAKE_GCTL",
      "confirming",
      { now: 1000 }
    );
    const indexed = updateTransactionStepStatus(
      updateTransactionStepStatus(
        funding,
        "MINT_AND_STAKE_GCTL",
        "completed"
      ),
      "INDEX_STAKE",
      "confirming",
      { now: 2000 }
    );

    expect(
      indexed.filter(
        (step) =>
          step.status === "waiting_signature" || step.status === "confirming"
      )
    ).toHaveLength(1);
    expect(
      indexed.find((step) => step.id === "MINT_AND_STAKE_GCTL")?.status
    ).toBe("completed");
    expect(indexed.find((step) => step.id === "INDEX_STAKE")?.status).toBe(
      "confirming"
    );
    expect(indexed.find((step) => step.id === "INDEX_STAKE")?.startedAt).toBe(
      2000
    );
  });

  it("deactivates the delegation step when stake indexing resumes after a retry", () => {
    const startedSteps = initializeTransactionSteps("SGCTL", "USDC", {
      sgctlSource: "mint_usdc",
    });

    const afterSignature = updateTransactionStepStatus(
      startedSteps,
      "DELEGATE_SGCTL",
      "confirming",
      { now: 1000 }
    );

    const duringRetry = updateTransactionStepStatus(
      afterSignature,
      "INDEX_STAKE",
      "confirming",
      {
        deactivateStepIds: ["DELEGATE_SGCTL"],
        now: 2000,
      }
    );

    expect(
      duringRetry.filter(
        (step) =>
          step.status === "waiting_signature" || step.status === "confirming"
      )
    ).toHaveLength(1);

    expect(duringRetry.find((step) => step.id === "INDEX_STAKE")?.status).toBe(
      "confirming"
    );
    expect(
      duringRetry.find((step) => step.id === "DELEGATE_SGCTL")?.status
    ).toBe("idle");
    expect(
      duringRetry.find((step) => step.id === "DELEGATE_SGCTL")?.startedAt
    ).toBeUndefined();
  });

  it("restores delegation as the only active step after indexing completes", () => {
    const initialSteps = initializeTransactionSteps("SGCTL", "USDC", {
      sgctlSource: "mint_usdc",
    });

    const indexing = updateTransactionStepStatus(
      initialSteps,
      "INDEX_STAKE",
      "confirming",
      { now: 1000 }
    );
    const indexed = updateTransactionStepStatus(
      indexing,
      "INDEX_STAKE",
      "completed"
    );
    const delegating = updateTransactionStepStatus(
      indexed,
      "DELEGATE_SGCTL",
      "confirming",
      { now: 3000 }
    );

    expect(
      delegating.filter(
        (step) =>
          step.status === "waiting_signature" || step.status === "confirming"
      )
    ).toHaveLength(1);
    expect(
      delegating.find((step) => step.id === "DELEGATE_SGCTL")?.status
    ).toBe("confirming");
    expect(
      delegating.find((step) => step.id === "DELEGATE_SGCTL")?.startedAt
    ).toBe(3000);
    expect(
      delegating.find((step) => step.id === "INDEX_STAKE")?.status
    ).toBe("completed");
  });
});
