"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { FhevmInstance } from "../../fhevm/fhevmTypes";
import { FHECounterInfoType } from "./useFHECounterContract";
import { ethers } from "ethers";

export const useFHECounterMutations = (params: {
  fheCounter: FHECounterInfoType;
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.Signer | undefined;
  chainId: number | undefined;
  refreshCountHandle: () => void;
}) => {
  const { fheCounter, instance, ethersSigner, chainId, refreshCountHandle } = params;

  const [isIncOrDec, setIsIncOrDec] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const isIncOrDecRef = useRef<boolean>(isIncOrDec);

  const canIncOrDec = useMemo(() => {
    return fheCounter.address && instance && ethersSigner && !isIncOrDec;
  }, [fheCounter.address, instance, ethersSigner, isIncOrDec]);

  const incOrDec = useCallback(
    (value: number) => {
      if (isIncOrDecRef.current) return;
      if (!fheCounter.address || !instance || !ethersSigner || value === 0) return;

      const thisChainId = chainId;
      const thisFheCounterAddress = fheCounter.address;
      const thisEthersSigner = ethersSigner;
      const thisFheCounterContract = new ethers.Contract(thisFheCounterAddress, fheCounter.abi, thisEthersSigner);

      const op = value > 0 ? "increment" : "decrement";
      const valueAbs = value > 0 ? value : -value;
      const opMsg = `${op}(${valueAbs})`;

      isIncOrDecRef.current = true;
      setIsIncOrDec(true);
      setMessage(`Start ${opMsg}...`);

      const run = async (op: "increment" | "decrement", valueAbs: number) => {
        await new Promise(resolve => setTimeout(resolve, 100));

        const isStale = () =>
          thisFheCounterAddress !== fheCounter.address || thisChainId !== chainId || thisEthersSigner !== ethersSigner;

        try {
          const userAddress = await thisEthersSigner.getAddress();
          const input = instance.createEncryptedInput(thisFheCounterAddress, userAddress);
          input.add32(valueAbs);

          const enc = await input.encrypt();

          if (isStale()) {
            setMessage(`Ignore ${opMsg}`);
            return;
          }

          setMessage(`Call ${opMsg}...`);

          const tx: ethers.TransactionResponse =
            op === "increment"
              ? await thisFheCounterContract.increment(enc.handles[0], enc.inputProof)
              : await thisFheCounterContract.decrement(enc.handles[0], enc.inputProof);

          setMessage(`Wait for tx:${tx.hash}...`);

          const receipt = await tx.wait();

          setMessage(`Call ${opMsg} completed status=${receipt?.status}`);

          if (isStale()) {
            setMessage(`Ignore ${opMsg}`);
            return;
          }

          refreshCountHandle();
        } catch (error) {
          console.error(`FHEVM ${opMsg} error:`, error);
          setMessage(`${opMsg} Failed! Error: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          isIncOrDecRef.current = false;
          setIsIncOrDec(false);
        }
      };

      run(op, valueAbs);
    },
    [ethersSigner, fheCounter.address, fheCounter.abi, instance, chainId, refreshCountHandle],
  );

  return { canIncOrDec, incOrDec, isIncOrDec, message, setMessage } as const;
};
