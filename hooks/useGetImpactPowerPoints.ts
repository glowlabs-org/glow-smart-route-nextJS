import { useContracts } from "./useContracts";
import { useEthersSigner } from "./useEthersSigner";

export const useGetImpactPowerPoints = () => {
  const signer = useEthersSigner();
  const { gcc } = useContracts(signer);

  const getImpactPowerPoints = async () => {
    if (!gcc) return 0;
    if (!signer) return 0;
    const signerAddress = await signer.getAddress();
    const points = await gcc.totalImpactPowerEarned(signerAddress);
    return points;
  };

  return { getImpactPowerPoints };
};
