"use client";

import { useCallback, useMemo, useState } from "react";
import { FhevmInstance } from "../../fhevm/fhevmTypes";
import { useFHEEncryption } from "./fhevm/useFHEEncryption";
import { FHECounterInfoType } from "./useFHECounterContract";
import { ethers } from "ethers";

export const useFHECounterMutations = (params: {
  fheCounter: FHECounterInfoType;
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.Signer | undefined;
  refreshCountHandle: () => void;
}) => {
  const { fheCounter, instance, ethersSigner, refreshCountHandle } = params;

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const canUpdateCounter = useMemo(() => {
    return fheCounter.address && instance && ethersSigner && !isProcessing;
  }, [fheCounter.address, instance, ethersSigner, isProcessing]);

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner,
    contractAddress: fheCounter.address,
  });

  const updateCounter = useCallback(
    async (value: number) => {
      if (isProcessing || !canUpdateCounter || value === 0) return;

      const op = value > 0 ? "increment" : "decrement";
      const valueAbs = Math.abs(value);
      const opMsg = `${op}(${valueAbs})`;

      setIsProcessing(true);
      setMessage(`Starting ${opMsg}...`);

      try {
        // Encrypt the value using generic builder
        const enc = await encryptWith(builder => builder.add32(valueAbs));
        if (!enc) {
          setMessage("Encryption failed");
          return;
        }

        setMessage(`Calling ${opMsg}...`);

        // Create contract instance and call function
        const contract = new ethers.Contract(fheCounter.address!, fheCounter.abi, ethersSigner);
        const tx = await (op === "increment"
          ? contract.increment(enc.handles[0], enc.inputProof)
          : contract.decrement(enc.handles[0], enc.inputProof));

        setMessage(`Waiting for transaction...`);
        const receipt = await tx.wait();

        setMessage(`${opMsg} completed! Status: ${receipt?.status}`);
        refreshCountHandle();
      } catch (error) {
        console.error(`FHEVM ${opMsg} error:`, error);
        setMessage(`${opMsg} failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canUpdateCounter, fheCounter.address, fheCounter.abi, ethersSigner, encryptWith, refreshCountHandle],
  );

  return { canUpdateCounter, updateCounter, isProcessing, message, setMessage } as const;
};
