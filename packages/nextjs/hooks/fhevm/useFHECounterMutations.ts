"use client";

import { useCallback, useMemo, useState } from "react";
import { FhevmInstance } from "../../fhevm/fhevmTypes";
import { useFHEEncryption } from "./fhevm/useFHEEncryption";
import { buildParamsFromAbi, getEncryptionMethod } from "./fhevm/useFHEEncryption";
import { FHECounterInfoType } from "./useFHECounterContract";
import { ethers } from "ethers";

// Reusable helpers now come from useFHEEncryption

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
        // Get the function ABI to determine the correct encryption method
        const functionName = op === "increment" ? "increment" : "decrement";
        const functionAbi = fheCounter.abi.find(item => item.type === "function" && item.name === functionName);
        if (!functionAbi) {
          setMessage(`Function ABI not found for ${functionName}`);
          return;
        }
        if (!functionAbi.inputs || functionAbi.inputs.length === 0) {
          setMessage(`No inputs found for ${functionName}`);
          return;
        }
        const firstInput = functionAbi.inputs[0]!;
        const encryptionMethod = getEncryptionMethod(firstInput.internalType);

        setMessage(`Encrypting with ${encryptionMethod}...`);

        // Encrypt the value using the appropriate method based on internalType
        const enc = await encryptWith(builder => {
          (builder as any)[encryptionMethod](valueAbs);
        });

        if (!enc) {
          setMessage("Encryption failed");
          return;
        }

        setMessage(`Calling ${opMsg}...`);

        // Create contract instance and call function
        const contract = new ethers.Contract(fheCounter.address!, fheCounter.abi, ethersSigner);
        const params = buildParamsFromAbi(enc, [...fheCounter.abi] as any[], functionName);
        const tx = await (op === "increment" ? contract.increment(...params) : contract.decrement(...params));

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
